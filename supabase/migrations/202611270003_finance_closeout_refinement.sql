BEGIN;
-- Non-cash reductions use the existing immutable event/charge-adjustment ledger.
ALTER TABLE public.finance_events DROP CONSTRAINT finance_events_kind_check;
ALTER TABLE public.finance_events ADD CONSTRAINT finance_events_kind_check CHECK(kind IN ('receipt','income','expense','refund','reversal','opening','variance','discount','courtesy'));
ALTER FUNCTION private.finance_command(text,text,jsonb) RENAME TO finance_command_core;
REVOKE ALL ON FUNCTION private.finance_command_core(text,text,jsonb) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION private.finance_command(bid text,operation text,payload jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
#variable_conflict use_variable
DECLARE uid text;cfg public.finance_settings;biz public.businesses;prior private.finance_operations;key text:=payload->>'request_key';fingerprint text:=private.hash(operation||':'||(payload-'request_key')::text);charge public.finance_charges;balance bigint;amount bigint;bps bigint;eid text:=gen_random_uuid()::text;account text;kind text:=payload->>'kind';result jsonb;
BEGIN
 IF operation<>'adjust' THEN RETURN private.finance_command_core(bid,operation,payload);END IF;
 uid:=private.finance_assert(bid,'refund',true);SELECT * INTO biz FROM public.businesses WHERE id=bid;
 IF key IS NULL OR key !~ '^[A-Za-z0-9_-]{16,100}$' OR payload->>'currency' IS DISTINCT FROM biz.currency OR payload->>'confirmed' IS DISTINCT FROM 'true' OR kind NOT IN ('discount','courtesy') OR kind IS NULL OR length(trim(coalesce(payload->>'note','')))<4 OR length(payload->>'note')>500 THEN RAISE EXCEPTION 'FINANCE_INVALID_REQUEST';END IF;
 PERFORM 1 FROM public.bookings WHERE business_id=bid AND id=payload->>'booking_id' FOR KEY SHARE;
 SELECT * INTO cfg FROM public.finance_settings WHERE business_id=bid FOR UPDATE;
 IF cfg.business_id IS NULL THEN RAISE EXCEPTION 'FINANCE_NOT_INITIALIZED';END IF;
 SELECT * INTO prior FROM private.finance_operations WHERE business_id=bid AND request_key=key;
 IF prior.business_id IS NOT NULL THEN IF prior.actor_id<>uid OR prior.fingerprint<>fingerprint THEN RAISE EXCEPTION 'FINANCE_KEY_REUSED';END IF;RETURN prior.result;END IF;
 charge:=private.finance_charge(bid,payload->>'booking_id');SELECT pending_minor INTO balance FROM public.finance_charge_balances WHERE charge_id=charge.id;
 IF balance::text IS DISTINCT FROM payload->>'expected_pending_minor' THEN RAISE EXCEPTION 'FINANCE_CLOSEOUT_CHANGED';END IF;
 IF kind='courtesy' THEN amount:=balance;
 ELSIF payload->>'mode'='percent' THEN bps:=private.finance_amount(payload->>'basis_points');IF bps<=0 OR bps>10000 THEN RAISE EXCEPTION 'FINANCE_INVALID_AMOUNT';END IF;amount:=floor((balance::numeric*bps+5000)/10000)::bigint;
 ELSIF payload->>'mode'='fixed' THEN amount:=private.finance_amount(payload->>'amount_minor');
 ELSE RAISE EXCEPTION 'FINANCE_INVALID_REQUEST';END IF;
 IF amount<=0 OR amount>balance THEN RAISE EXCEPTION 'FINANCE_DISCOUNT_LIMIT';END IF;
 SELECT a.id INTO account FROM public.finance_accounts a WHERE a.business_id=bid AND a.kind='bank' ORDER BY a.id LIMIT 1;
 INSERT INTO public.finance_events(id,business_id,kind,amount_minor,currency,method_name,account_id,charge_id,note,actor_id) VALUES(eid,bid,kind,amount,biz.currency,'',account,charge.id,trim(payload->>'note'),uid);
 INSERT INTO public.finance_charge_adjustments(business_id,event_id,charge_id,delta_minor) VALUES(bid,eid,charge.id,-amount);
 UPDATE public.finance_settings SET revision=revision+1 WHERE business_id=bid;
 result:=jsonb_build_object('event_id',eid,'amount_minor',amount::text,'pending_minor',(balance-amount)::text,'kind',kind);
 INSERT INTO private.finance_operations(business_id,request_key,actor_id,operation,fingerprint,result) VALUES(bid,key,uid,operation,fingerprint,result);
 INSERT INTO public.audit_log VALUES(gen_random_uuid()::text,bid,uid,'finance.'||kind,'finance',eid,now());
 RETURN result;
END$$;
REVOKE ALL ON FUNCTION private.finance_command(text,text,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION private.finance_command(text,text,jsonb) TO authenticated;
CREATE OR REPLACE FUNCTION private.finance_closeout(bid text,payload jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
#variable_conflict use_variable
DECLARE uid text;biz public.businesses;cfg public.finance_settings;prior private.finance_operations;key text:=payload->>'request_key';fingerprint text:=private.hash('closeout:'||(payload-'request_key')::text);item jsonb;part jsonb;parts jsonb;j int;payments jsonb:=coalesce(payload->'receipts','[]');entries jsonb:=coalesce(payload->'entries','[]');exceptions jsonb:=coalesce(payload->'exceptions','[]');rec public.bookings;charge public.finance_charges;session public.finance_cash_sessions;current_pending bigint;expected bigint;account text:=nullif(payload->>'account_id','');opening jsonb:=payload->'opening';closing jsonb:=payload->'closing';result jsonb;outputs jsonb:='[]';i int:=0;cid text:=gen_random_uuid()::text;net bigint:=0;day date;adjustments jsonb:=coalesce(payload->'adjustments','[]');resolutions jsonb:=coalesce(payload->'resolutions','[]');action jsonb;visit text;discount_total bigint:=0;adjustment_details jsonb:='[]';
BEGIN
 uid:=private.finance_assert(bid,'collect',true);SELECT * INTO biz FROM public.businesses WHERE id=bid;
 IF octet_length(payload::text)>60000 OR key IS NULL OR key !~ '^[A-Za-z0-9_-]{16,64}$' OR jsonb_typeof(payments)<>'array' OR jsonb_typeof(entries)<>'array' OR jsonb_typeof(exceptions)<>'array' OR jsonb_array_length(payments)>200 OR jsonb_array_length(entries)>40 OR jsonb_array_length(exceptions)>500 OR payload->>'currency' IS DISTINCT FROM biz.currency OR payload->>'confirmed' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'FINANCE_INVALID_REQUEST';END IF;
 IF jsonb_typeof(adjustments)<>'array' OR jsonb_array_length(adjustments)>200 OR jsonb_typeof(resolutions)<>'array' OR jsonb_array_length(resolutions)>200 OR coalesce(payload->>'disposition','finished') NOT IN ('finished','postponed') THEN RAISE EXCEPTION 'FINANCE_INVALID_REQUEST';END IF;
 day:=(payload->>'date')::date;IF day IS NULL THEN RAISE EXCEPTION 'FINANCE_INVALID_REQUEST';END IF;
 IF (SELECT count(*)<>count(DISTINCT x->>'booking_id') FROM jsonb_array_elements(payments)x) THEN RAISE EXCEPTION 'FINANCE_CLOSEOUT_DUPLICATE';END IF;
 -- Agenda owns cancellation. Acquire its business lock before booking/ledger locks.
 IF jsonb_array_length(resolutions)>0 THEN
  PERFORM 1 FROM public.businesses WHERE id=bid FOR UPDATE;
  FOR action IN SELECT * FROM jsonb_array_elements(resolutions) ORDER BY value->>'booking_id' LOOP
   IF EXISTS(SELECT 1 FROM jsonb_array_elements(payments)p WHERE p->>'booking_id'=action->>'booking_id') OR EXISTS(SELECT 1 FROM jsonb_array_elements(adjustments)p WHERE p->>'booking_id'=action->>'booking_id') THEN RAISE EXCEPTION 'FINANCE_INVALID_REQUEST';END IF;
   SELECT * INTO rec FROM public.bookings WHERE business_id=bid AND id=action->>'booking_id' FOR UPDATE;
  END LOOP;
 END IF;
 -- Same lock order as booking completion and the existing single-receipt command.
 PERFORM 1 FROM public.bookings WHERE business_id=bid AND id IN(SELECT x->>'booking_id' FROM jsonb_array_elements(payments||adjustments)x) ORDER BY id FOR KEY SHARE;
 SELECT * INTO cfg FROM public.finance_settings WHERE business_id=bid FOR UPDATE;IF cfg.business_id IS NULL THEN RAISE EXCEPTION 'FINANCE_NOT_INITIALIZED';END IF;
 SELECT * INTO prior FROM private.finance_operations WHERE business_id=bid AND request_key=key;
 IF prior.business_id IS NOT NULL THEN IF prior.fingerprint<>fingerprint OR prior.actor_id<>uid THEN RAISE EXCEPTION 'FINANCE_KEY_REUSED';END IF;RETURN prior.result;END IF;
 IF cfg.revision::text IS DISTINCT FROM payload->>'expected_revision' THEN RAISE EXCEPTION 'FINANCE_CLOSEOUT_CHANGED';END IF;
 IF (SELECT count(*)<>count(DISTINCT x->>'booking_id') FROM jsonb_array_elements(adjustments)x) OR (SELECT count(*)<>count(DISTINCT x->>'booking_id') FROM jsonb_array_elements(resolutions)x) THEN RAISE EXCEPTION 'FINANCE_CLOSEOUT_DUPLICATE';END IF;
 FOR action IN SELECT * FROM jsonb_array_elements(resolutions) LOOP
  SELECT * INTO rec FROM public.bookings WHERE business_id=bid AND id=action->>'booking_id';
   IF rec.id IS NULL OR rec.status IS DISTINCT FROM action->>'expected_status' OR rec.status NOT IN ('pending','confirmed') OR (rec.starts_at AT TIME ZONE biz.timezone)::date<>day THEN RAISE EXCEPTION 'FINANCE_CLOSEOUT_CHANGED';END IF;
  SELECT visit_id INTO visit FROM public.booking_visit_items WHERE booking_id=action->>'booking_id';
  IF visit IS NOT NULL THEN
   IF EXISTS(SELECT 1 FROM public.booking_visit_items vi WHERE vi.visit_id=visit AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(resolutions)x WHERE x->>'booking_id'=vi.booking_id)) THEN RAISE EXCEPTION 'FINANCE_VISIT_REQUIRED';END IF;
   PERFORM public.atry_visit_command(bid,visit,'cancel','{}');
  ELSE PERFORM public.atry_update_booking(bid,action->>'booking_id',jsonb_build_object('status','cancelled'));END IF;
 END LOOP;
 FOR action IN SELECT * FROM jsonb_array_elements(adjustments) LOOP
  SELECT * INTO rec FROM public.bookings WHERE business_id=bid AND id=action->>'booking_id';
  IF rec.id IS NULL OR rec.status IS DISTINCT FROM action->>'expected_status' OR (rec.starts_at AT TIME ZONE biz.timezone)::date<>day THEN RAISE EXCEPTION 'FINANCE_CLOSEOUT_CHANGED';END IF;
  result:=private.finance_closeout_child(bid,'adjust',action||jsonb_build_object('currency',biz.currency,'confirmed',true,'request_key',key||'_a_'||(discount_total+1)::text));
  discount_total:=discount_total+(result->>'amount_minor')::bigint;adjustment_details:=adjustment_details||jsonb_build_array(action||result);outputs:=outputs||jsonb_build_array(result);
 END LOOP;
 IF account IS NOT NULL THEN
  PERFORM private.finance_assert(bid,'cash',true);
  IF NOT EXISTS(SELECT 1 FROM public.finance_accounts WHERE id=account AND business_id=bid AND kind='cash' AND active) THEN RAISE EXCEPTION 'FINANCE_INVALID_ACCOUNT';END IF;
  SELECT * INTO session FROM public.finance_cash_sessions WHERE business_id=bid AND account_id=account AND closed_at IS NULL;
  IF session.id IS NOT NULL THEN
   IF opening IS NOT NULL OR session.id IS DISTINCT FROM payload->>'session_id' OR session.revision::text IS DISTINCT FROM payload->>'session_revision' THEN RAISE EXCEPTION 'FINANCE_CLOSEOUT_CHANGED';END IF;
  ELSIF opening IS NOT NULL THEN
   IF opening->>'recovered' IS DISTINCT FROM 'true' OR length(trim(coalesce(opening->>'note','')))<4 THEN RAISE EXCEPTION 'FINANCE_RECOVERY_REASON';END IF;
   PERFORM private.finance_closeout_child(bid,'open',jsonb_build_object('request_key',key||'_open','currency',biz.currency,'account_id',account,'amount_minor',opening->>'amount_minor','note','Apertura recuperada ahora; efectivo inicial declarado. '||(opening->>'note')));
  ELSIF closing IS NOT NULL THEN RAISE EXCEPTION 'FINANCE_CASH_NOT_OPEN';END IF;
 ELSIF opening IS NOT NULL OR closing IS NOT NULL THEN RAISE EXCEPTION 'FINANCE_INVALID_ACCOUNT';END IF;
 FOR item IN SELECT * FROM jsonb_array_elements(payments) LOOP
  SELECT * INTO rec FROM public.bookings WHERE id=item->>'booking_id' AND business_id=bid;
  IF rec.id IS NULL OR rec.status IN ('cancelled','no_show') OR rec.status IS DISTINCT FROM item->>'expected_status' OR (rec.starts_at AT TIME ZONE biz.timezone)::date<>day OR rec.currency<>biz.currency THEN RAISE EXCEPTION 'FINANCE_CLOSEOUT_CHANGED';END IF;
  SELECT * INTO charge FROM public.finance_charges WHERE business_id=bid AND booking_id=rec.id;
  SELECT coalesce((SELECT pending_minor FROM public.finance_charge_balances WHERE charge_id=charge.id),rec.price_minor) INTO current_pending;
  IF current_pending::text IS DISTINCT FROM item->>'expected_pending_minor' THEN RAISE EXCEPTION 'FINANCE_CLOSEOUT_CHANGED';END IF;
  parts:=coalesce(item->'parts',jsonb_build_array(jsonb_build_object('method_id',item->>'method_id','amount_minor',item->>'amount_minor')));
  IF jsonb_typeof(parts)<>'array' OR jsonb_array_length(parts)<1 OR jsonb_array_length(parts)>3 OR (SELECT count(*)<>count(DISTINCT x->>'method_id') FROM jsonb_array_elements(parts)x) OR (SELECT sum(private.finance_amount(x->>'amount_minor')) FROM jsonb_array_elements(parts)x)<>private.finance_amount(item->>'amount_minor') THEN RAISE EXCEPTION 'FINANCE_INVALID_REQUEST';END IF;
  i:=i+1;j:=0;
  FOR part IN SELECT * FROM jsonb_array_elements(parts) LOOP
   IF NOT EXISTS(SELECT 1 FROM public.finance_methods m JOIN public.finance_accounts a ON a.id=m.account_id WHERE m.business_id=bid AND m.id=part->>'method_id' AND (a.kind<>'cash' OR a.id=account)) THEN RAISE EXCEPTION 'FINANCE_CLOSEOUT_METHOD';END IF;
   j:=j+1;result:=private.finance_closeout_child(bid,'receipt',part||jsonb_build_object('booking_id',rec.id,'currency',biz.currency,'request_key',key||'_r_'||i||'_p_'||j));outputs:=outputs||jsonb_build_array(result);
  END LOOP;
  net:=net+private.finance_amount(item->>'amount_minor');
 END LOOP;
 FOR item IN SELECT value FROM jsonb_array_elements(entries) WITH ORDINALITY AS e(value,ord) ORDER BY CASE WHEN value->>'kind'='income' THEN 0 ELSE 1 END,ord LOOP
  IF item->>'kind' NOT IN ('income','expense') OR item->>'kind' IS NULL THEN RAISE EXCEPTION 'FINANCE_INVALID_REQUEST';END IF;
  IF NOT EXISTS(SELECT 1 FROM public.finance_methods m JOIN public.finance_accounts a ON a.id=m.account_id WHERE m.business_id=bid AND m.id=item->>'method_id' AND (a.kind<>'cash' OR a.id=account)) THEN RAISE EXCEPTION 'FINANCE_CLOSEOUT_METHOD';END IF;
  i:=i+1;result:=private.finance_closeout_child(bid,item->>'kind',item||jsonb_build_object('currency',biz.currency,'request_key',key||'_e_'||i));outputs:=outputs||jsonb_build_array(result);net:=net+(CASE WHEN item->>'kind'='income' THEN 1 ELSE -1 END)*private.finance_amount(item->>'amount_minor');
 END LOOP;
 FOR item IN SELECT * FROM jsonb_array_elements(exceptions) LOOP
  IF item->>'reason' NOT IN ('pending','not_done','outside') OR item->>'reason' IS NULL OR NOT EXISTS(SELECT 1 FROM public.bookings WHERE business_id=bid AND id=item->>'booking_id' AND (starts_at AT TIME ZONE biz.timezone)::date=day) OR EXISTS(SELECT 1 FROM jsonb_array_elements(payments)p WHERE p->>'booking_id'=item->>'booking_id') THEN RAISE EXCEPTION 'FINANCE_INVALID_REQUEST';END IF;
 END LOOP;
 IF closing IS NOT NULL THEN
  SELECT * INTO session FROM public.finance_cash_sessions WHERE business_id=bid AND account_id=account AND closed_at IS NULL;
  SELECT session.opening_minor+coalesce(sum(p.delta_minor),0) INTO expected FROM public.finance_events e JOIN public.finance_postings p ON p.event_id=e.id WHERE e.business_id=bid AND e.session_id=session.id AND e.kind NOT IN ('opening','variance');
  IF expected::text IS DISTINCT FROM closing->>'expected_minor' THEN RAISE EXCEPTION 'FINANCE_CLOSEOUT_CHANGED';END IF;
  result:=private.finance_closeout_child(bid,'close',jsonb_build_object('request_key',key||'_close','currency',biz.currency,'account_id',account,'session_id',session.id,'expected_revision',session.revision::text,'amount_minor',closing->>'counted_minor','note',closing->>'note'));
 END IF;
 -- A reviewed day may legitimately contain no money. It still has explicit confirmation.
 IF coalesce(payload->>'disposition','finished')='postponed' AND closing IS NOT NULL THEN RAISE EXCEPTION 'FINANCE_INVALID_REQUEST';END IF;
 result:=jsonb_build_object('closeout_id',cid,'session_id',CASE WHEN closing IS NOT NULL THEN session.id ELSE NULL END,'receipt_count',jsonb_array_length(payments),'entry_count',jsonb_array_length(entries),'net_minor',net::text,'currency',biz.currency,'cash_closed',closing IS NOT NULL,'events',outputs,'adjustment_minor',discount_total::text,'resolution_count',jsonb_array_length(resolutions),'exception_count',jsonb_array_length(exceptions),'disposition',coalesce(payload->>'disposition','finished'));
 INSERT INTO public.finance_closeouts(id,business_id,actor_id,work_day,summary) VALUES(cid,bid,uid,day,jsonb_build_object('result',result,'participants',(SELECT coalesce(jsonb_agg(jsonb_build_object('booking_id',b.id,'customer_name',coalesce(b.customer_name_snapshot,c.name),'service_name',sv.name,'staff_name',st.name)),'[]') FROM public.bookings b JOIN public.customers c ON c.id=b.customer_id JOIN public.services sv ON sv.id=b.service_id JOIN public.staff st ON st.id=b.staff_id WHERE b.business_id=bid AND b.id IN(SELECT x->>'booking_id' FROM jsonb_array_elements(payments||adjustments||exceptions||resolutions)x)),'exceptions',(SELECT coalesce(jsonb_agg(x||jsonb_build_object('customer_name',coalesce(b.customer_name_snapshot,c.name),'service_name',v.name)),'[]') FROM jsonb_array_elements(exceptions)x JOIN public.bookings b ON b.id=x->>'booking_id' AND b.business_id=bid JOIN public.customers c ON c.id=b.customer_id JOIN public.services v ON v.id=b.service_id),'opening_recovered',opening IS NOT NULL,'adjustments',adjustment_details,'resolutions',resolutions,'recorded_at',now(),'work_day',day));
 INSERT INTO private.finance_operations(business_id,request_key,actor_id,operation,fingerprint,result) VALUES(bid,key,uid,'closeout',fingerprint,result);
 UPDATE public.finance_settings SET revision=revision+1 WHERE business_id=bid;
 INSERT INTO public.audit_log VALUES(gen_random_uuid()::text,bid,uid,'finance.closeout','finance',cid,now());
 RETURN result;
END$$;

DO $$DECLARE source text;BEGIN
 SELECT pg_get_functiondef('private.finance_read(text,jsonb)'::regprocedure) INTO source;
 IF position('''checked_at'',now());' IN source)=0 THEN RAISE EXCEPTION 'FINANCE_MIGRATION_SOURCE';END IF;
 source:=replace(source,'''checked_at'',now());','''checked_at'',now(),''draft_scope'',private.hash(coalesce(auth.jwt()->>''session_id'','''')||'':''||uid));');EXECUTE source;
END$$;
DO $$DECLARE source text;BEGIN
 SELECT pg_get_functiondef('private.finance_closeout_read(text,jsonb)'::regprocedure) INTO source;
 source:=replace(source,'b.id,b.starts_at,b.status','b.id,b.starts_at,b.status,b.staff_id,(SELECT visit_id FROM public.booking_visit_items WHERE booking_id=b.id) visit_id');EXECUTE source;
END$$;
CREATE INDEX finance_closeouts_days ON public.finance_closeouts(business_id,work_day DESC,created_at DESC,id DESC);
CREATE FUNCTION private.finance_closeout_history_page(bid text,params jsonb DEFAULT '{}') RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE biz public.businesses;lo date;hi date;rows jsonb;q text:=trim(coalesce(params->>'search',''));BEGIN
 PERFORM private.finance_assert(bid,'read');SELECT * INTO biz FROM public.businesses WHERE id=bid;
 hi:=coalesce((params->>'to')::date,(now() AT TIME ZONE biz.timezone)::date);lo:=coalesce((params->>'from')::date,hi-30);
 IF hi<lo OR hi-lo>365 OR length(q)>80 THEN RAISE EXCEPTION 'FINANCE_INVALID_PERIOD';END IF;
 SELECT coalesce(jsonb_agg(x ORDER BY x.created_at DESC,x.id DESC),'[]') INTO rows FROM (
 SELECT c.id,c.work_day,c.created_at,u.name actor_name,c.summary FROM public.finance_closeouts c JOIN public.users u ON u.id=c.actor_id
 WHERE c.business_id=bid AND c.work_day BETWEEN lo AND hi AND (q='' OR strpos(lower(u.name||' '||c.work_day::text||' '||c.summary::text),lower(q))>0 OR CASE WHEN c.summary ? 'participants' THEN false ELSE EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(c.summary->'result'->'events','[]')) x JOIN public.finance_events fe ON fe.id=x->>'event_id' AND fe.business_id=bid JOIN public.finance_charges fc ON fc.id=fe.charge_id AND fc.business_id=bid JOIN public.staff st ON st.id=fc.staff_id WHERE strpos(lower(fc.customer_name||' '||fc.service_name||' '||st.name),lower(q))>0) END)
 AND (NOT(params ? 'cursor_at') OR (c.created_at,c.id)<((params->>'cursor_at')::timestamptz,params->>'cursor_id')) ORDER BY c.created_at DESC,c.id DESC LIMIT 21)x;
 RETURN jsonb_build_object('rows',CASE WHEN jsonb_array_length(rows)>20 THEN rows-20 ELSE rows END,'next_cursor',CASE WHEN jsonb_array_length(rows)>20 THEN jsonb_build_object('cursor_at',rows->19->>'created_at','cursor_id',rows->19->>'id') ELSE NULL END);
END$$;
CREATE FUNCTION public.atry_finance_closeout_history(bid text,params jsonb DEFAULT '{}') RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$SELECT private.finance_closeout_history_page(bid,params)$$;
REVOKE ALL ON FUNCTION private.finance_closeout_history_page(text,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION private.finance_closeout_history_page(text,jsonb) TO authenticated;
REVOKE ALL ON FUNCTION public.atry_finance_closeout_history(text,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.atry_finance_closeout_history(text,jsonb) TO authenticated;
DO $$DECLARE source text;BEGIN
 SELECT pg_get_functiondef('private.finance_closeout_read(text,jsonb)'::regprocedure) INTO source;
 source:=replace(source,'''date'',day,','''day_meta'',jsonb_build_object(''last_end_at'',(SELECT max(ends_at) FROM public.bookings WHERE business_id=bid AND starts_at>=lo AND starts_at<hi AND status NOT IN (''cancelled'',''no_show'')),''last_review'',(SELECT jsonb_build_object(''recorded_at'',created_at,''disposition'',coalesce(summary->''result''->>''disposition'',''finished'')) FROM public.finance_closeouts WHERE business_id=bid AND work_day=day ORDER BY created_at DESC LIMIT 1)),''date'',day,');EXECUTE source;
END$$;

DO $$DECLARE source text;BEGIN
 SELECT pg_get_functiondef('private.finance_read(text,jsonb)'::regprocedure) INTO source;
 source:=replace(source,'''checked_at'',now(),','''suggested_days'',coalesce((SELECT jsonb_agg(x) FROM (SELECT DISTINCT (b.starts_at AT TIME ZONE biz.timezone)::date AS day FROM public.bookings b WHERE b.business_id=bid AND b.starts_at>=((day-7)::timestamp AT TIME ZONE biz.timezone) AND b.starts_at<((day+1)::timestamp AT TIME ZONE biz.timezone) AND b.status NOT IN (''cancelled'',''no_show'') AND coalesce((SELECT c.summary->''result''->>''disposition'' FROM public.finance_closeouts c WHERE c.business_id=bid AND c.work_day=(b.starts_at AT TIME ZONE biz.timezone)::date ORDER BY c.created_at DESC,c.id DESC LIMIT 1),'''')<>''finished'' ORDER BY day DESC LIMIT 7)x),''[]''),''checked_at'',now(),');EXECUTE source;
END$$;
-- History is fetched only when requested, through the paginated endpoint.
CREATE OR REPLACE FUNCTION public.atry_finance_read(bid text,params jsonb DEFAULT '{}') RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$SELECT private.finance_read(bid,params)$$;
COMMIT;
