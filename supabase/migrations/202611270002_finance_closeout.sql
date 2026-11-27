BEGIN;
CREATE TABLE public.finance_closeouts(id text PRIMARY KEY DEFAULT gen_random_uuid()::text,business_id text NOT NULL REFERENCES public.businesses(id),actor_id text NOT NULL REFERENCES public.users(id),work_day date NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),summary jsonb NOT NULL);
ALTER TABLE public.finance_closeouts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.finance_closeouts FROM PUBLIC,anon,authenticated,service_role;
CREATE INDEX finance_closeouts_recent ON public.finance_closeouts(business_id,created_at DESC);
CREATE TRIGGER finance_immutable BEFORE UPDATE OR DELETE ON public.finance_closeouts FOR EACH ROW EXECUTE FUNCTION private.finance_immutable();
CREATE FUNCTION private.finance_closeout_read(bid text,params jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE biz public.businesses;cfg public.finance_settings;day date;lo timestamptz;hi timestamptz;rows jsonb;
BEGIN
 PERFORM private.finance_assert(bid,'read');SELECT * INTO biz FROM public.businesses WHERE id=bid;SELECT * INTO cfg FROM public.finance_settings WHERE business_id=bid;
 IF cfg.business_id IS NULL THEN RAISE EXCEPTION 'FINANCE_NOT_INITIALIZED';END IF;
 day:=coalesce((params->>'date')::date,(now() AT TIME ZONE biz.timezone)::date);lo:=day::timestamp AT TIME ZONE biz.timezone;hi:=(day+1)::timestamp AT TIME ZONE biz.timezone;
 SELECT coalesce(jsonb_agg(x ORDER BY x.starts_at,x.id),'[]') INTO rows FROM(
 SELECT b.id,b.starts_at,b.status,coalesce(b.customer_name_snapshot,c.name) customer_name,s.name service_name,st.name staff_name,b.currency,b.price_minor::text,coalesce(cb.pending_minor,b.price_minor)::text pending_minor
 FROM public.bookings b JOIN public.customers c ON c.id=b.customer_id JOIN public.services s ON s.id=b.service_id JOIN public.staff st ON st.id=b.staff_id LEFT JOIN public.finance_charges fc ON fc.business_id=bid AND fc.booking_id=b.id LEFT JOIN public.finance_charge_balances cb ON cb.charge_id=fc.id
 WHERE b.business_id=bid AND b.starts_at>=lo AND b.starts_at<hi AND (NOT(params ? 'cursor_at') OR (b.starts_at,b.id)>((params->>'cursor_at')::timestamptz,params->>'cursor_id')) ORDER BY b.starts_at,b.id LIMIT 81) x;
 RETURN jsonb_build_object('finance',CASE WHEN NOT(params ? 'cursor_at') THEN private.finance_read(bid,'{}') ELSE NULL END,'revision',cfg.revision::text,'date',day,'currency',biz.currency,'rows',CASE WHEN jsonb_array_length(rows)>80 THEN rows-80 ELSE rows END,'next_cursor',CASE WHEN jsonb_array_length(rows)>80 THEN jsonb_build_object('cursor_at',rows->79->>'starts_at','cursor_id',rows->79->>'id') ELSE NULL END);
END$$;
-- A new parent must not reuse a child key previously submitted outside this transaction.
CREATE FUNCTION private.finance_closeout_child(bid text,operation text,payload jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$BEGIN
 IF EXISTS(SELECT 1 FROM private.finance_operations o WHERE o.business_id=bid AND o.request_key=payload->>'request_key') THEN RAISE EXCEPTION 'FINANCE_KEY_REUSED';END IF;
 RETURN private.finance_command(bid,operation,payload);
END$$;
REVOKE ALL ON FUNCTION private.finance_closeout_child(text,text,jsonb) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION private.finance_closeout(bid text,payload jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
#variable_conflict use_variable
DECLARE uid text;biz public.businesses;cfg public.finance_settings;prior private.finance_operations;key text:=payload->>'request_key';fingerprint text:=private.hash('closeout:'||(payload-'request_key')::text);item jsonb;part jsonb;parts jsonb;j int;payments jsonb:=coalesce(payload->'receipts','[]');entries jsonb:=coalesce(payload->'entries','[]');exceptions jsonb:=coalesce(payload->'exceptions','[]');rec public.bookings;charge public.finance_charges;session public.finance_cash_sessions;current_pending bigint;expected bigint;account text:=nullif(payload->>'account_id','');opening jsonb:=payload->'opening';closing jsonb:=payload->'closing';result jsonb;outputs jsonb:='[]';i int:=0;cid text:=gen_random_uuid()::text;net bigint:=0;day date;
BEGIN
 uid:=private.finance_assert(bid,'collect',true);SELECT * INTO biz FROM public.businesses WHERE id=bid;
 IF octet_length(payload::text)>60000 OR key IS NULL OR key !~ '^[A-Za-z0-9_-]{16,64}$' OR jsonb_typeof(payments)<>'array' OR jsonb_typeof(entries)<>'array' OR jsonb_typeof(exceptions)<>'array' OR jsonb_array_length(payments)>200 OR jsonb_array_length(entries)>40 OR jsonb_array_length(exceptions)>500 OR payload->>'currency' IS DISTINCT FROM biz.currency OR payload->>'confirmed' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'FINANCE_INVALID_REQUEST';END IF;
 day:=(payload->>'date')::date;IF day IS NULL THEN RAISE EXCEPTION 'FINANCE_INVALID_REQUEST';END IF;
 IF (SELECT count(*)<>count(DISTINCT x->>'booking_id') FROM jsonb_array_elements(payments)x) THEN RAISE EXCEPTION 'FINANCE_CLOSEOUT_DUPLICATE';END IF;
 -- Same lock order as booking completion and the existing single-receipt command.
 PERFORM 1 FROM public.bookings WHERE business_id=bid AND id IN(SELECT x->>'booking_id' FROM jsonb_array_elements(payments)x) ORDER BY id FOR KEY SHARE;
 SELECT * INTO cfg FROM public.finance_settings WHERE business_id=bid FOR UPDATE;IF cfg.business_id IS NULL THEN RAISE EXCEPTION 'FINANCE_NOT_INITIALIZED';END IF;
 SELECT * INTO prior FROM private.finance_operations WHERE business_id=bid AND request_key=key;
 IF prior.business_id IS NOT NULL THEN IF prior.fingerprint<>fingerprint OR prior.actor_id<>uid THEN RAISE EXCEPTION 'FINANCE_KEY_REUSED';END IF;RETURN prior.result;END IF;
 IF cfg.revision::text IS DISTINCT FROM payload->>'expected_revision' THEN RAISE EXCEPTION 'FINANCE_CLOSEOUT_CHANGED';END IF;
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
 IF jsonb_array_length(payments)+jsonb_array_length(entries)=0 AND closing IS NULL THEN RAISE EXCEPTION 'FINANCE_CLOSEOUT_EMPTY';END IF;
 result:=jsonb_build_object('closeout_id',cid,'session_id',CASE WHEN closing IS NOT NULL THEN session.id ELSE NULL END,'receipt_count',jsonb_array_length(payments),'entry_count',jsonb_array_length(entries),'net_minor',net::text,'currency',biz.currency,'cash_closed',closing IS NOT NULL,'events',outputs);
 INSERT INTO public.finance_closeouts(id,business_id,actor_id,work_day,summary) VALUES(cid,bid,uid,day,jsonb_build_object('result',result,'exceptions',(SELECT coalesce(jsonb_agg(x||jsonb_build_object('customer_name',coalesce(b.customer_name_snapshot,c.name),'service_name',v.name)),'[]') FROM jsonb_array_elements(exceptions)x JOIN public.bookings b ON b.id=x->>'booking_id' AND b.business_id=bid JOIN public.customers c ON c.id=b.customer_id JOIN public.services v ON v.id=b.service_id),'opening_recovered',opening IS NOT NULL,'recorded_at',now(),'work_day',day));
 INSERT INTO private.finance_operations(business_id,request_key,actor_id,operation,fingerprint,result) VALUES(bid,key,uid,'closeout',fingerprint,result);
 UPDATE public.finance_settings SET revision=revision+1 WHERE business_id=bid;
 INSERT INTO public.audit_log VALUES(gen_random_uuid()::text,bid,uid,'finance.closeout','finance',cid,now());
 RETURN result;
END$$;
CREATE FUNCTION private.finance_closeout_history(bid text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$BEGIN
 PERFORM private.finance_assert(bid,'read');RETURN coalesce((SELECT jsonb_agg(x ORDER BY x.created_at DESC) FROM(SELECT c.id,c.work_day,c.created_at,u.name actor_name,c.summary->'result'->>'currency' currency,c.summary->'result'->>'net_minor' net_minor,(c.summary->'result'->>'receipt_count')::int receipt_count,(c.summary->'result'->>'entry_count')::int entry_count,(c.summary->'result'->>'cash_closed')::boolean cash_closed,c.summary->'exceptions' exceptions,(c.summary->>'opening_recovered')::boolean opening_recovered FROM public.finance_closeouts c JOIN public.users u ON u.id=c.actor_id WHERE c.business_id=bid ORDER BY c.created_at DESC LIMIT 10)x),'[]');END$$;
CREATE OR REPLACE FUNCTION public.atry_finance_read(bid text,params jsonb DEFAULT '{}') RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$DECLARE result jsonb;BEGIN result:=private.finance_read(bid,params);IF params ? 'status_key' THEN RETURN result;END IF;RETURN result||jsonb_build_object('closeouts',private.finance_closeout_history(bid));END$$;
REVOKE ALL ON FUNCTION private.finance_closeout_history(text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION private.finance_closeout_history(text) TO authenticated;
CREATE FUNCTION public.atry_finance_closeout_read(bid text,params jsonb DEFAULT '{}') RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$SELECT private.finance_closeout_read(bid,params)$$;
CREATE OR REPLACE FUNCTION public.atry_finance_command(bid text,operation text,payload jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$BEGIN IF operation='closeout' THEN RETURN private.finance_closeout(bid,payload);END IF;RETURN private.finance_command(bid,operation,payload);END$$;
REVOKE ALL ON FUNCTION private.finance_closeout_read(text,jsonb),private.finance_closeout(text,jsonb),public.atry_finance_closeout_read(text,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION private.finance_closeout_read(text,jsonb),private.finance_closeout(text,jsonb),public.atry_finance_closeout_read(text,jsonb) TO authenticated;
COMMIT;
