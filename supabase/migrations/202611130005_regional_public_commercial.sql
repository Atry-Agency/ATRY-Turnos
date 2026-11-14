BEGIN;
SET LOCAL lock_timeout='2s';
SET LOCAL statement_timeout='30s';
CREATE OR REPLACE FUNCTION public.atry_offer(token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
#variable_conflict use_variable
DECLARE w public.waitlist;slot jsonb;
BEGIN IF EXISTS(SELECT 1 FROM public.waitlist WHERE offer_token_hash=private.hash(atry_offer.token)) THEN PERFORM private.require_feature((SELECT business_id FROM public.waitlist WHERE offer_token_hash=private.hash(atry_offer.token)),'waitlist');END IF;
 IF coalesce(token,'')!~'^[A-Za-z0-9_-]{32,100}$' THEN RAISE EXCEPTION 'INVALID_TOKEN';END IF;
 SELECT * INTO w FROM public.waitlist WHERE offer_token_hash=private.hash(token) AND status='offered' AND offer_expires_at>now();IF w.id IS NULL THEN RAISE EXCEPTION 'INVALID_TOKEN';END IF;
 slot:=private.check_slot(w.business_id,w.offer_staff_id,w.service_id,w.offer_starts_at,'',true);
 RETURN jsonb_build_object('business_country',(SELECT country FROM public.businesses WHERE id=w.business_id),'business_timezone',private.business_zone(w.business_id),'business_name',(SELECT name FROM public.businesses WHERE id=w.business_id),'service_name',(SELECT name FROM public.services WHERE id=w.service_id),'starts_at',w.offer_starts_at,'expires_at',w.offer_expires_at);
END $function$
;
CREATE OR REPLACE FUNCTION public.atry_entitlements(bid text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
#variable_conflict use_variable
DECLARE result jsonb;c record;
BEGIN
 IF private.member_role(bid) IS NULL THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501';END IF;
 SELECT * INTO c FROM private.commercial_cycle(bid);
 SELECT to_jsonb(p)||jsonb_build_object('features',CASE WHEN (SELECT subscription_status FROM public.businesses WHERE id=bid)='pending' THEN (SELECT jsonb_object_agg(key,false) FROM jsonb_object_keys(p.features) key) ELSE p.features END,'access_enabled',private.subscription_live(bid),'revision',(SELECT revision FROM private.commercial_settings WHERE id=1),'staff_count',(SELECT count(*) FROM public.staff WHERE business_id=bid AND active=1),'mail_usage',jsonb_build_object('accepted',coalesce(u.accepted,0),'reserved',coalesce(u.reserved,0),'limit',p.mail_limit,'cycle_start',c.cycle_start,'cycle_end',c.cycle_end)) INTO result FROM public.businesses b JOIN public.plans p ON p.code=b.plan LEFT JOIN public.business_mail_usage u ON u.business_id=b.id AND u.cycle_start=c.cycle_start WHERE b.id=bid;
 IF (SELECT country FROM public.businesses WHERE id=bid)='PA' THEN result:=(result-'price_uyu')||jsonb_build_object('currency','USD','catalog_available',false);ELSE result:=result||jsonb_build_object('currency','UYU','catalog_available',true);END IF;
 RETURN result;
END $function$
;
CREATE OR REPLACE FUNCTION public.atry_subscription(bid text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
#variable_conflict use_variable
DECLARE caps jsonb:=public.atry_entitlements(bid);biz public.businesses;contact jsonb;
BEGIN
 SELECT * INTO biz FROM public.businesses WHERE id=bid;SELECT jsonb_build_object('whatsapp',whatsapp,'tax_status',tax_status) INTO contact FROM private.commercial_settings WHERE id=1;
 RETURN jsonb_build_object('catalog_available',biz.country='UY','currency',biz.currency,'plans',CASE WHEN biz.country='UY' THEN (SELECT jsonb_agg(to_jsonb(p) ORDER BY price_uyu) FROM public.plans p WHERE code<>'trial') ELSE '[]'::jsonb END,'settings',contact,'entitlements',caps,'requests',coalesce((SELECT jsonb_agg(to_jsonb(r)||jsonb_build_object('message','Hola, quiero contratar Atry Turnos.'||chr(10)||'Negocio: '||biz.name||chr(10)||'Plan solicitado: '||(SELECT name FROM public.plans WHERE code=r.plan)||chr(10)||'Precio mensual propuesto: $'||r.price_uyu||' UYU'||chr(10)||'Código de solicitud: '||r.code||chr(10)||'Me gustaría coordinar la transferencia y habilitación de mi cuenta.') ORDER BY r.created_at DESC) FROM public.plan_requests r WHERE r.business_id=bid),'[]'::jsonb));
END $function$
;
CREATE OR REPLACE FUNCTION public.atry_runtime_config()
 RETURNS jsonb
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
 SELECT jsonb_build_object('app','Atry Turnos','version','1.3.0','regional_contract',1,'currency','UYU','timezone','America/Montevideo','payments_live',false,'whatsapp_live',false,'mail_provider',CASE WHEN mail_enabled THEN 'brevo' ELSE 'disabled' END,'automatic_email_live',mail_enabled,'tax_status',(SELECT tax_status FROM private.commercial_settings WHERE id=1),'plans',(SELECT jsonb_agg(to_jsonb(p) ORDER BY price_uyu) FROM public.plans p WHERE code<>'trial')) FROM private.runtime_settings WHERE id=1
$function$
;
COMMIT;
