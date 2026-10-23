-- Manual WhatsApp communication only. No provider, delivery or read receipts.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
CREATE TABLE public.whatsapp_settings(business_id text PRIMARY KEY REFERENCES public.businesses(id) ON DELETE CASCADE,config jsonb NOT NULL DEFAULT '{}');
CREATE TABLE public.whatsapp_consent(business_id text NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,customer_id text NOT NULL,allowed boolean NOT NULL DEFAULT false,updated_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(business_id,customer_id),FOREIGN KEY(customer_id,business_id) REFERENCES public.customers(id,business_id) ON DELETE CASCADE);
CREATE TABLE public.whatsapp_actions(id text PRIMARY KEY DEFAULT gen_random_uuid()::text,business_id text NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,customer_id text NOT NULL,booking_id text,starts_at timestamptz,kind text NOT NULL,state text NOT NULL CHECK(state IN ('prepared','opened','manual_sent','skipped','snoozed')),actor_id text REFERENCES public.users(id),created_at timestamptz NOT NULL DEFAULT clock_timestamp(),snoozed_until timestamptz,FOREIGN KEY(customer_id,business_id) REFERENCES public.customers(id,business_id) ON DELETE CASCADE,FOREIGN KEY(booking_id,business_id) REFERENCES public.bookings(id,business_id) ON DELETE CASCADE);
CREATE INDEX whatsapp_actions_due ON public.whatsapp_actions(business_id,booking_id,starts_at,kind,created_at DESC);
CREATE INDEX whatsapp_actions_history ON public.whatsapp_actions(business_id,customer_id,created_at DESC);
CREATE INDEX whatsapp_actions_stats ON public.whatsapp_actions(business_id,created_at);
CREATE TABLE public.whatsapp_previous(booking_id text PRIMARY KEY REFERENCES public.bookings(id) ON DELETE CASCADE,starts_at timestamptz NOT NULL);
ALTER TABLE public.whatsapp_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_consent ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_previous ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.whatsapp_settings,public.whatsapp_consent,public.whatsapp_actions,public.whatsapp_previous FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION private.whatsapp_snapshot() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN IF OLD.starts_at IS DISTINCT FROM NEW.starts_at THEN INSERT INTO public.whatsapp_previous VALUES(NEW.id,OLD.starts_at) ON CONFLICT(booking_id) DO UPDATE SET starts_at=excluded.starts_at;END IF;RETURN NEW;END $$;
REVOKE ALL ON FUNCTION private.whatsapp_snapshot() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER whatsapp_reschedule_snapshot AFTER UPDATE OF starts_at ON public.bookings FOR EACH ROW EXECUTE FUNCTION private.whatsapp_snapshot();

CREATE FUNCTION public.atry_whatsapp(bid text,action text,verb text,payload jsonb DEFAULT '{}') RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
#variable_conflict use_variable
DECLARE role text:=private.member_role(bid);plan_code text;cfg jsonb;cap integer;cid text;bk text;b public.bookings;c public.customers;item jsonb;key text;txt text;allowed_vars text[]:=ARRAY['cliente','negocio','profesional','servicio','fecha','hora','duracion','direccion','fecha_anterior','hora_anterior','enlace'];token text;last_state text;country text;digits text;raw_phone text;kind text;st text;result jsonb;context_data jsonb:='{}';reminder_action public.whatsapp_actions;actor_uid text:=private.user_id();
BEGIN
 IF coalesce(role,'') NOT IN ('owner','manager','staff') THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501';END IF;
 SELECT plan INTO plan_code FROM public.businesses WHERE id=bid;
 IF role='staff' AND plan_code='individual' THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501';END IF;
 cap:=CASE plan_code WHEN 'pro' THEN 100 WHEN 'negocio' THEN 10 ELSE 2 END;
 SELECT config INTO cfg FROM public.whatsapp_settings WHERE business_id=bid;cfg:=coalesce(cfg,'{}');
 IF action='settings' THEN
  IF verb='PUT' THEN
   PERFORM private.require_manager(bid);
   IF jsonb_typeof(payload->'custom') IS DISTINCT FROM 'array' OR jsonb_array_length(payload->'custom')>cap THEN RAISE EXCEPTION 'Límite de plantillas del plan';END IF;
   IF coalesce(payload->>'country','')!~'^[0-9]{1,3}$' OR (payload->>'reminder_hours')::integer NOT BETWEEN 1 AND 168 OR length(coalesce(payload->>'name',''))>100 THEN RAISE EXCEPTION 'Configuración inválida';END IF;
   IF jsonb_typeof(payload->'enabled') IS DISTINCT FROM 'boolean' OR jsonb_typeof(payload->'reminders') IS DISTINCT FROM 'boolean' OR jsonb_typeof(payload->'templates') IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Configuración inválida';END IF;
   raw_phone:=coalesce(payload->>'phone','');country:=payload->>'country';digits:=regexp_replace(raw_phone,'[^0-9]','','g');
   IF raw_phone<>'' THEN
    IF raw_phone!~'^[+0-9 ().-]+$' THEN RAISE EXCEPTION 'Teléfono inválido';END IF;
    IF raw_phone LIKE '00%' THEN digits:=substring(digits from 3);ELSIF raw_phone NOT LIKE '+%' THEN
     IF country='598' THEN digits:=regexp_replace(digits,'^0','');END IF;
     IF NOT(country='598' AND digits LIKE '598%' AND length(digits)=11) THEN digits:=country||digits;END IF;
    END IF;
    IF digits!~'^[1-9][0-9]{6,14}$' OR (digits LIKE '598%' AND length(digits)<>11) THEN RAISE EXCEPTION 'Teléfono internacional inválido';END IF;
   END IF;
   FOR key,txt IN SELECT * FROM jsonb_each_text(payload->'templates') LOOP
    IF key NOT IN ('confirmation','reminder','reschedule','cancellation','request','free') THEN RAISE EXCEPTION 'Plantilla inválida';END IF;
    IF length(btrim(txt)) NOT BETWEEN 1 AND 3000 THEN RAISE EXCEPTION 'Texto inválido';END IF;
    FOR token IN SELECT (regexp_matches(txt,'\{([^{}]+)\}','g'))[1] LOOP IF NOT(token=ANY(allowed_vars)) THEN RAISE EXCEPTION 'Variable desconocida';END IF;END LOOP;
    IF regexp_replace(txt,'\{[^{}]+\}','','g')~'[{}]' THEN RAISE EXCEPTION 'Variable inválida';END IF;
   END LOOP;
   IF (SELECT count(DISTINCT t->>'id') FROM jsonb_array_elements(payload->'custom') t)<>jsonb_array_length(payload->'custom') THEN RAISE EXCEPTION 'Plantillas duplicadas';END IF;
   FOR item IN SELECT * FROM jsonb_array_elements(payload->'custom') LOOP
    txt:=item->>'text';IF coalesce(item->>'id','')!~'^custom_[a-zA-Z0-9_-]{1,50}$' OR length(btrim(coalesce(item->>'name',''))) NOT BETWEEN 1 AND 80 OR length(btrim(coalesce(txt,''))) NOT BETWEEN 1 AND 3000 THEN RAISE EXCEPTION 'Plantilla inválida';END IF;
    FOR token IN SELECT (regexp_matches(txt,'\{([^{}]+)\}','g'))[1] LOOP IF NOT(token=ANY(allowed_vars)) THEN RAISE EXCEPTION 'Variable desconocida';END IF;END LOOP;
    IF regexp_replace(txt,'\{[^{}]+\}','','g')~'[{}]' THEN RAISE EXCEPTION 'Variable inválida';END IF;
   END LOOP;
   cfg:=jsonb_build_object('enabled',(payload->>'enabled')::boolean,'country',country,'phone',CASE WHEN digits<>'' THEN '+'||digits ELSE '' END,'name',coalesce(payload->>'name',''),'reminders',(payload->>'reminders')::boolean,'reminder_hours',(payload->>'reminder_hours')::integer,'templates',payload->'templates','custom',(payload->'custom')||coalesce((SELECT jsonb_agg(t.value) FROM jsonb_array_elements(coalesce(cfg->'custom','[]')) WITH ORDINALITY t WHERE t.ordinality>cap AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(payload->'custom') n WHERE n->>'id'=t.value->>'id')),'[]'));
   INSERT INTO public.whatsapp_settings VALUES(bid,cfg) ON CONFLICT(business_id) DO UPDATE SET config=excluded.config;
  ELSIF verb<>'GET' THEN RAISE EXCEPTION 'Acción inválida';END IF;
  cfg:=jsonb_set(cfg,'{custom}',coalesce((SELECT jsonb_agg(t) FROM (SELECT value t FROM jsonb_array_elements(coalesce(cfg->'custom','[]')) LIMIT cap) x),'[]'));
  RETURN jsonb_build_object('config',cfg,'limit',cap,'plan',plan_code,'can_edit',role IN ('owner','manager'));
 END IF;
 IF action='/stats' AND verb='GET' THEN
  IF plan_code<>'pro' THEN RAISE EXCEPTION 'Las estadísticas de comunicación requieren Pro';END IF;
  RETURN coalesce((SELECT jsonb_agg(x) FROM(SELECT a.state,count(*) count FROM public.whatsapp_actions a LEFT JOIN public.bookings qb ON qb.id=a.booking_id LEFT JOIN public.staff s ON s.id=qb.staff_id WHERE a.business_id=bid AND a.created_at>=now()-interval '30 days' AND(role<>'staff' OR a.actor_id=actor_uid OR s.user_id=actor_uid) GROUP BY a.state)x),'[]');
 END IF;
 IF action='/reminders' AND verb='GET' THEN
  IF NOT coalesce((cfg->>'enabled')::boolean,false) OR NOT coalesce((cfg->>'reminders')::boolean,true) THEN RETURN '{"pending":[],"snoozed":[],"managed":[]}';END IF;
  WITH items AS (
   SELECT (to_jsonb(qb)-'manage_token'-'notes')||jsonb_build_object('customer_name',qc.name,'customer_phone',qc.phone,'service_name',v.name,'staff_name',s.name,'reminder_action_id',j.id,'reminder_state',j.state,'snoozed_until',j.snoozed_until) reminder_entry,
    CASE WHEN j.state IN ('manual_sent','skipped') THEN 'managed' WHEN j.state='snoozed' AND j.snoozed_until>now() THEN 'snoozed' ELSE 'pending' END bucket
   FROM public.bookings qb JOIN public.customers qc ON qc.id=qb.customer_id JOIN public.services v ON v.id=qb.service_id JOIN public.staff s ON s.id=qb.staff_id
   LEFT JOIN LATERAL(SELECT a.id,a.state,a.snoozed_until FROM public.whatsapp_actions a WHERE a.business_id=bid AND a.booking_id=qb.id AND a.starts_at=qb.starts_at AND a.created_at>=qb.updated_at AND a.kind='reminder' AND a.state IN ('manual_sent','skipped','snoozed') ORDER BY a.created_at DESC LIMIT 1) j ON true
   WHERE qb.business_id=bid AND qb.status IN ('pending','confirmed') AND qb.starts_at>now() AND qb.starts_at<=now()+make_interval(hours=>coalesce((cfg->>'reminder_hours')::integer,24)) AND(role<>'staff' OR s.user_id=actor_uid AND s.active=1)
   ORDER BY qb.starts_at LIMIT 500
  ) SELECT jsonb_build_object('pending',coalesce(jsonb_agg(reminder_entry) FILTER(WHERE bucket='pending'),'[]'),'snoozed',coalesce(jsonb_agg(reminder_entry) FILTER(WHERE bucket='snoozed'),'[]'),'managed',coalesce(jsonb_agg(reminder_entry) FILTER(WHERE bucket='managed'),'[]')) INTO result FROM items;RETURN result;
 END IF;
 IF action LIKE '/reminders/%/restore' AND verb='POST' THEN
  SELECT * INTO reminder_action FROM public.whatsapp_actions WHERE business_id=bid AND id=split_part(action,'/',3) AND state='snoozed';
  IF reminder_action.id IS NULL THEN RAISE EXCEPTION 'Recordatorio pospuesto no encontrado';END IF;
  SELECT * INTO b FROM public.bookings WHERE id=reminder_action.booking_id AND business_id=bid FOR UPDATE;
  IF b.id IS NULL OR role='staff' AND NOT EXISTS(SELECT 1 FROM public.staff s WHERE s.id=b.staff_id AND s.user_id=actor_uid AND s.active=1) THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501';END IF;
  IF b.starts_at<>reminder_action.starts_at OR b.starts_at<=now() OR b.status NOT IN ('pending','confirmed') THEN RAISE EXCEPTION 'La reserva cambió';END IF;
  IF reminder_action.id IS DISTINCT FROM(SELECT a.id FROM public.whatsapp_actions a WHERE a.business_id=bid AND a.booking_id=b.id AND a.starts_at=b.starts_at AND a.kind='reminder' AND a.state IN ('manual_sent','skipped','snoozed') ORDER BY a.created_at DESC LIMIT 1) THEN RAISE EXCEPTION 'El recordatorio ya fue gestionado';END IF;
  UPDATE public.whatsapp_actions SET snoozed_until=now() WHERE id=reminder_action.id AND business_id=bid;
  INSERT INTO public.audit_log VALUES(gen_random_uuid()::text,bid,actor_uid,'whatsapp.reminder.restored','booking',b.id,now());
  RETURN '{"ok":true}';
 END IF;
 IF action='/pending' AND verb='GET' THEN
  IF NOT coalesce((cfg->>'enabled')::boolean,false) OR NOT coalesce((cfg->>'reminders')::boolean,true) THEN RETURN '[]';END IF;
  RETURN coalesce((SELECT jsonb_agg(x ORDER BY x->>'starts_at') FROM (
   SELECT (to_jsonb(qb)-'manage_token'-'notes')||jsonb_build_object('customer_name',qc.name,'customer_phone',qc.phone,'staff_name',s.name,'service_name',v.name) x
   FROM public.bookings qb JOIN public.customers qc ON qc.id=qb.customer_id JOIN public.staff s ON s.id=qb.staff_id JOIN public.services v ON v.id=qb.service_id
   WHERE qb.business_id=bid AND qb.status IN ('pending','confirmed') AND qb.starts_at>now() AND qb.starts_at<=now()+make_interval(hours=>coalesce((cfg->>'reminder_hours')::integer,24))
   AND (role<>'staff' OR s.user_id=actor_uid AND s.active=1)
   AND NOT EXISTS(SELECT 1 FROM public.whatsapp_actions a WHERE a.business_id=bid AND a.booking_id=qb.id AND a.starts_at=qb.starts_at AND a.created_at>=qb.updated_at AND a.kind='reminder' AND (a.state IN ('manual_sent','skipped') OR a.state='snoozed' AND a.snoozed_until>now()))
   ORDER BY qb.starts_at LIMIT 500) t),'[]');
 END IF;
 IF action LIKE '/booking/%' OR action LIKE '/context/%' THEN bk:=substring(action from 10);ELSIF action='/actions' THEN bk:=nullif(payload->>'booking_id','');END IF;
 IF bk IS NOT NULL THEN
  IF action='/actions' AND verb='POST' THEN SELECT * INTO b FROM public.bookings WHERE id=bk AND business_id=bid FOR UPDATE;
  ELSE SELECT * INTO b FROM public.bookings WHERE id=bk AND business_id=bid;END IF;
  IF b.id IS NULL OR role='staff' AND NOT EXISTS(SELECT 1 FROM public.staff WHERE id=b.staff_id AND business_id=bid AND staff.user_id=private.user_id() AND active=1) THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501';END IF;
  cid:=b.customer_id;
  IF action LIKE '/booking/%' AND verb='GET' THEN RETURN jsonb_build_object('booking',(to_jsonb(b)-'manage_token'-'notes')||jsonb_build_object('service_name',(SELECT name FROM public.services WHERE id=b.service_id),'staff_name',(SELECT name FROM public.staff WHERE id=b.staff_id)),'previous',(SELECT starts_at FROM public.whatsapp_previous WHERE booking_id=b.id));END IF;
 END IF;
 IF action LIKE '/context/%' THEN context_data:=public.atry_whatsapp(bid,'settings','GET','{}')||jsonb_build_object('booking',(to_jsonb(b)-'manage_token'-'notes')||jsonb_build_object('service_name',(SELECT name FROM public.services WHERE id=b.service_id),'staff_name',(SELECT name FROM public.staff WHERE id=b.staff_id)),'previous',(SELECT starts_at FROM public.whatsapp_previous WHERE booking_id=b.id));action:='/customer/'||b.customer_id;END IF;
 IF action LIKE '/customer/%' THEN cid:=substring(action from 11);ELSIF cid IS NULL THEN cid:=payload->>'customer_id';END IF;
 IF action='/actions' AND verb='POST' OR action LIKE '/customer/%' AND verb='PUT' THEN
  SELECT * INTO c FROM public.customers WHERE id=cid AND business_id=bid FOR UPDATE;
 ELSE SELECT * INTO c FROM public.customers WHERE id=cid AND business_id=bid;END IF;
 IF c.id IS NULL OR role='staff' AND NOT EXISTS(SELECT 1 FROM public.bookings qb JOIN public.staff s ON s.id=qb.staff_id WHERE qb.customer_id=cid AND qb.business_id=bid AND s.user_id=actor_uid AND s.active=1) THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501';END IF;
 IF action LIKE '/customer/%' THEN
  IF verb='PUT' THEN
   IF jsonb_typeof(payload->'allowed') IS DISTINCT FROM 'boolean' THEN RAISE EXCEPTION 'Consentimiento inválido';END IF;
   INSERT INTO public.whatsapp_consent VALUES(bid,cid,(payload->>'allowed')::boolean,now()) ON CONFLICT(business_id,customer_id) DO UPDATE SET allowed=excluded.allowed,updated_at=excluded.updated_at;RETURN '{"ok":true}';
  ELSIF verb='GET' THEN
   RETURN context_data||jsonb_build_object('customer',CASE WHEN role='staff' THEN to_jsonb(c)-'notes'-'marketing_consent' ELSE to_jsonb(c) END,'consent',coalesce((SELECT allowed FROM public.whatsapp_consent WHERE business_id=bid AND customer_id=cid),false),'bookings',coalesce((SELECT jsonb_agg(x) FROM(SELECT (to_jsonb(qb)-'manage_token'-'notes')||jsonb_build_object('service_name',v.name,'staff_name',s.name) x FROM public.bookings qb JOIN public.services v ON v.id=qb.service_id JOIN public.staff s ON s.id=qb.staff_id WHERE qb.business_id=bid AND qb.customer_id=cid AND(role<>'staff' OR s.user_id=actor_uid AND s.active=1) ORDER BY qb.starts_at DESC LIMIT 30)t),'[]'),'history',CASE WHEN plan_code='individual' THEN '[]'::jsonb ELSE coalesce((SELECT jsonb_agg(x) FROM(SELECT jsonb_build_object('id',a.id,'kind',a.kind,'state',a.state,'created_at',a.created_at) x FROM public.whatsapp_actions a LEFT JOIN public.bookings qb ON qb.id=a.booking_id LEFT JOIN public.staff s ON s.id=qb.staff_id WHERE a.business_id=bid AND a.customer_id=cid AND(role<>'staff' OR a.actor_id=actor_uid OR s.user_id=actor_uid) ORDER BY a.created_at DESC LIMIT CASE WHEN plan_code='pro' THEN 200 ELSE 30 END)t),'[]') END);
  END IF;
 END IF;
 IF action='/actions' AND verb='POST' THEN
  IF NOT coalesce((cfg->>'enabled')::boolean,false) THEN RAISE EXCEPTION 'WhatsApp está desactivado';END IF;
  kind:=payload->>'kind';st:=payload->>'state';
  IF st NOT IN ('prepared','opened','manual_sent','skipped','snoozed') OR st IS NULL THEN RAISE EXCEPTION 'Estado inválido';END IF;
  IF kind NOT IN ('confirmation','reminder','reschedule','cancellation','request','free') AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(cfg->'custom','[]')) WITH ORDINALITY t WHERE t.value->>'id'=kind AND t.ordinality<=cap) THEN RAISE EXCEPTION 'Plantilla no disponible';END IF;
  IF kind<>'free' AND b.id IS NULL THEN RAISE EXCEPTION 'Seleccioná una reserva';END IF;
  IF b.id IS NOT NULL AND b.starts_at IS DISTINCT FROM (payload->>'starts_at')::timestamptz THEN RAISE EXCEPTION 'La reserva cambió';END IF;
  IF b.id IS NOT NULL AND payload ? 'booking_updated_at' AND b.updated_at IS DISTINCT FROM (payload->>'booking_updated_at')::timestamptz THEN RAISE EXCEPTION 'Los datos del turno cambiaron. Volvé a preparar el mensaje.';END IF;
  IF kind IN ('reminder','request','reschedule') AND (b.status NOT IN ('pending','confirmed') OR b.starts_at<=now()) OR kind='confirmation' AND b.status<>'confirmed' OR kind='cancellation' AND b.status<>'cancelled' THEN RAISE EXCEPTION 'Estado del turno incompatible';END IF;
  IF kind='reschedule' AND NOT EXISTS(SELECT 1 FROM public.whatsapp_previous WHERE booking_id=b.id) THEN RAISE EXCEPTION 'No hay horario anterior';END IF;
  IF kind='reminder' AND st IN ('skipped','snoozed') AND EXISTS(SELECT 1 FROM public.whatsapp_actions a WHERE a.business_id=bid AND a.booking_id=b.id AND a.starts_at=b.starts_at AND a.created_at>=b.updated_at AND a.kind='reminder' AND a.state IN ('manual_sent','skipped')) THEN RAISE EXCEPTION 'El recordatorio ya fue gestionado';END IF;
  IF st NOT IN ('skipped','snoozed') THEN
   IF NOT coalesce((SELECT allowed FROM public.whatsapp_consent WHERE business_id=bid AND customer_id=cid),false) THEN RAISE EXCEPTION 'Falta autorización del cliente';END IF;
   raw_phone:=coalesce(c.phone,'');digits:=regexp_replace(raw_phone,'[^0-9]','','g');country:=coalesce(cfg->>'country','598');
   IF raw_phone LIKE '00%' THEN digits:=substring(digits from 3);ELSIF raw_phone NOT LIKE '+%' THEN IF country='598' THEN digits:=regexp_replace(digits,'^0','');END IF;IF NOT(country='598' AND digits LIKE '598%' AND length(digits)=11) THEN digits:=country||digits;END IF;END IF;
   IF raw_phone!~'^[+0-9 ().-]+$' OR digits!~'^[1-9][0-9]{6,14}$' OR digits LIKE '598%' AND length(digits)<>11 THEN RAISE EXCEPTION 'Teléfono inválido';END IF;
   IF payload ? 'recipient_phone' AND payload->>'recipient_phone' IS DISTINCT FROM digits THEN RAISE EXCEPTION 'El teléfono del cliente cambió. Volvé a preparar el mensaje.';END IF;
  END IF;
  -- Writes lock the customer before reading consent; GET contexts do not lock bookings.
  SELECT a.state INTO last_state FROM public.whatsapp_actions a WHERE a.business_id=bid AND a.customer_id=cid AND a.booking_id IS NOT DISTINCT FROM b.id AND a.starts_at IS NOT DISTINCT FROM b.starts_at AND a.kind=kind AND a.actor_id=actor_uid ORDER BY a.created_at DESC LIMIT 1;
  IF st='opened' AND last_state IS DISTINCT FROM 'prepared' OR st='manual_sent' AND last_state IS DISTINCT FROM 'opened' THEN RAISE EXCEPTION 'Prepará y abrí WhatsApp con tu usuario antes de confirmar el envío manual';END IF;
  INSERT INTO public.whatsapp_actions(business_id,customer_id,booking_id,starts_at,kind,state,actor_id,snoozed_until) VALUES(bid,cid,b.id,b.starts_at,kind,st,actor_uid,CASE WHEN st='snoozed' THEN now()+interval '1 hour' END) RETURNING jsonb_build_object('id',id,'state',state,'created_at',created_at,'snoozed_until',snoozed_until) INTO result;RETURN result;
 END IF;
 RAISE EXCEPTION 'Acción de comunicación inválida';
END $$;
REVOKE ALL ON FUNCTION public.atry_whatsapp(text,text,text,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.atry_whatsapp(text,text,text,jsonb) TO authenticated;
COMMIT;
