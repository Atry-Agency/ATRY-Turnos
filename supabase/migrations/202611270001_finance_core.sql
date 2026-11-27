-- Local-first financial core. No remote execution is part of this change.
BEGIN;
SET LOCAL lock_timeout='2s';
SET LOCAL statement_timeout='30s';
UPDATE public.plans SET features=features||jsonb_build_object('finance_core',true,'finance_cash',true,'finance_multiple_cash',code IN ('pro','trial'));
CREATE TABLE public.finance_settings(business_id text PRIMARY KEY REFERENCES public.businesses(id),started_at timestamptz NOT NULL DEFAULT now(),revision bigint NOT NULL DEFAULT 0);
CREATE TABLE public.finance_permissions(business_id text NOT NULL,user_id text NOT NULL,permissions text[] NOT NULL DEFAULT '{}',PRIMARY KEY(business_id,user_id),FOREIGN KEY(user_id,business_id) REFERENCES public.memberships(user_id,business_id));
CREATE TABLE public.finance_accounts(id text PRIMARY KEY DEFAULT gen_random_uuid()::text,business_id text NOT NULL REFERENCES public.businesses(id),name text NOT NULL CHECK(length(name) BETWEEN 2 AND 70),kind text NOT NULL CHECK(kind IN ('cash','bank')),active boolean NOT NULL DEFAULT true,balance_minor bigint NOT NULL DEFAULT 0,UNIQUE(business_id,id));
CREATE TABLE public.finance_methods(id text PRIMARY KEY DEFAULT gen_random_uuid()::text,business_id text NOT NULL REFERENCES public.businesses(id),account_id text NOT NULL,name text NOT NULL CHECK(length(name) BETWEEN 2 AND 60),active boolean NOT NULL DEFAULT true,FOREIGN KEY(business_id,account_id) REFERENCES public.finance_accounts(business_id,id),UNIQUE(business_id,id));
CREATE TABLE public.finance_charges(id text PRIMARY KEY DEFAULT gen_random_uuid()::text,business_id text NOT NULL REFERENCES public.businesses(id),booking_id text NOT NULL REFERENCES public.bookings(id),customer_id text REFERENCES public.customers(id),customer_name text NOT NULL,service_name text NOT NULL,staff_id text NOT NULL REFERENCES public.staff(id),amount_minor bigint NOT NULL CHECK(amount_minor>=0),currency text NOT NULL CHECK(currency IN ('UYU','USD')),service_at timestamptz NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(business_id,booking_id),UNIQUE(business_id,id));
CREATE TABLE public.finance_charge_balances(business_id text NOT NULL,charge_id text PRIMARY KEY,paid_minor bigint NOT NULL DEFAULT 0 CHECK(paid_minor>=0),adjustment_minor bigint NOT NULL DEFAULT 0,pending_minor bigint NOT NULL CHECK(pending_minor>=0),FOREIGN KEY(business_id,charge_id) REFERENCES public.finance_charges(business_id,id));
CREATE INDEX finance_open_balances ON public.finance_charge_balances(business_id,charge_id) WHERE pending_minor>0;
CREATE TABLE public.finance_cash_sessions(id text PRIMARY KEY DEFAULT gen_random_uuid()::text,business_id text NOT NULL REFERENCES public.businesses(id),account_id text NOT NULL,opened_by text NOT NULL REFERENCES public.users(id),opened_at timestamptz NOT NULL DEFAULT now(),opening_minor bigint NOT NULL CHECK(opening_minor>=0),revision bigint NOT NULL DEFAULT 0,closed_at timestamptz,closed_by text REFERENCES public.users(id),expected_minor bigint,counted_minor bigint CHECK(counted_minor>=0),difference_minor bigint,close_note text CHECK(length(close_note)<=500),FOREIGN KEY(business_id,account_id) REFERENCES public.finance_accounts(business_id,id),UNIQUE(business_id,id),CHECK((closed_at IS NULL AND counted_minor IS NULL AND expected_minor IS NULL AND difference_minor IS NULL AND closed_by IS NULL) OR (closed_at IS NOT NULL AND counted_minor IS NOT NULL AND expected_minor IS NOT NULL AND difference_minor=counted_minor-expected_minor AND closed_by IS NOT NULL)));
CREATE UNIQUE INDEX finance_one_open_cash ON public.finance_cash_sessions(business_id,account_id) WHERE closed_at IS NULL;
CREATE TABLE public.finance_events(id text PRIMARY KEY DEFAULT gen_random_uuid()::text,business_id text NOT NULL REFERENCES public.businesses(id),kind text NOT NULL CHECK(kind IN ('receipt','income','expense','refund','reversal','opening','variance')),amount_minor bigint NOT NULL CHECK(amount_minor>=0),currency text NOT NULL CHECK(currency IN ('UYU','USD')),method_id text,method_name text,account_id text NOT NULL,session_id text,charge_id text,related_event_id text,note text NOT NULL CHECK(length(note)<=500),actor_id text NOT NULL REFERENCES public.users(id),created_at timestamptz NOT NULL DEFAULT now(),FOREIGN KEY(business_id,account_id) REFERENCES public.finance_accounts(business_id,id),FOREIGN KEY(business_id,method_id) REFERENCES public.finance_methods(business_id,id),FOREIGN KEY(business_id,session_id) REFERENCES public.finance_cash_sessions(business_id,id),FOREIGN KEY(business_id,charge_id) REFERENCES public.finance_charges(business_id,id),UNIQUE(business_id,id),FOREIGN KEY(business_id,related_event_id) REFERENCES public.finance_events(business_id,id));
CREATE UNIQUE INDEX finance_one_reversal ON public.finance_events(business_id,related_event_id) WHERE kind='reversal';
CREATE TABLE public.finance_postings(id text PRIMARY KEY DEFAULT gen_random_uuid()::text,business_id text NOT NULL,event_id text NOT NULL,account_id text NOT NULL,delta_minor bigint NOT NULL,FOREIGN KEY(business_id,event_id) REFERENCES public.finance_events(business_id,id),FOREIGN KEY(business_id,account_id) REFERENCES public.finance_accounts(business_id,id),UNIQUE(event_id,account_id));
CREATE TABLE public.finance_allocations(id text PRIMARY KEY DEFAULT gen_random_uuid()::text,business_id text NOT NULL,event_id text NOT NULL,charge_id text NOT NULL,delta_minor bigint NOT NULL CHECK(delta_minor<>0),FOREIGN KEY(business_id,event_id) REFERENCES public.finance_events(business_id,id),FOREIGN KEY(business_id,charge_id) REFERENCES public.finance_charges(business_id,id),UNIQUE(event_id,charge_id));
CREATE TABLE public.finance_charge_adjustments(id text PRIMARY KEY DEFAULT gen_random_uuid()::text,business_id text NOT NULL,event_id text NOT NULL,charge_id text NOT NULL,delta_minor bigint NOT NULL CHECK(delta_minor<>0),FOREIGN KEY(business_id,event_id) REFERENCES public.finance_events(business_id,id),FOREIGN KEY(business_id,charge_id) REFERENCES public.finance_charges(business_id,id),UNIQUE(event_id,charge_id));
CREATE TABLE private.finance_operations(business_id text NOT NULL REFERENCES public.businesses(id),request_key text NOT NULL,actor_id text NOT NULL REFERENCES public.users(id),operation text NOT NULL,fingerprint text NOT NULL,result jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(business_id,request_key));
CREATE INDEX finance_events_period ON public.finance_events(business_id,created_at DESC,id DESC);
CREATE INDEX finance_postings_account ON public.finance_postings(business_id,account_id);
CREATE INDEX finance_allocations_charge ON public.finance_allocations(business_id,charge_id);
CREATE INDEX finance_adjustments_charge ON public.finance_charge_adjustments(business_id,charge_id);
CREATE INDEX finance_sessions_history ON public.finance_cash_sessions(business_id,opened_at DESC,id DESC);
CREATE INDEX finance_events_session ON public.finance_events(business_id,session_id) WHERE session_id IS NOT NULL;
CREATE INDEX finance_events_related ON public.finance_events(business_id,related_event_id) WHERE related_event_id IS NOT NULL;
CREATE INDEX finance_charges_recent ON public.finance_charges(business_id,service_at DESC,id DESC);
CREATE INDEX finance_charges_customer ON public.finance_charges(business_id,customer_id);
DO $$DECLARE t text;BEGIN FOREACH t IN ARRAY ARRAY['finance_charge_balances','finance_settings','finance_permissions','finance_accounts','finance_methods','finance_charges','finance_cash_sessions','finance_events','finance_postings','finance_allocations','finance_charge_adjustments'] LOOP EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated,service_role',t);END LOOP;END$$;
ALTER TABLE private.finance_operations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.finance_operations FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION private.finance_immutable() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$BEGIN RAISE EXCEPTION 'FINANCE_IMMUTABLE';END$$;
DO $$DECLARE t text;BEGIN FOREACH t IN ARRAY ARRAY['finance_charges','finance_events','finance_postings','finance_allocations','finance_charge_adjustments'] LOOP EXECUTE format('CREATE TRIGGER finance_immutable BEFORE UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION private.finance_immutable()',t);END LOOP;END$$;
CREATE FUNCTION private.finance_closed_immutable() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$BEGIN IF OLD.closed_at IS NOT NULL THEN RAISE EXCEPTION 'FINANCE_CLOSED_IMMUTABLE';END IF;IF TG_OP='DELETE' THEN RAISE EXCEPTION 'FINANCE_IMMUTABLE';END IF;RETURN NEW;END$$;
CREATE TRIGGER finance_closed_immutable BEFORE UPDATE OR DELETE ON public.finance_cash_sessions FOR EACH ROW EXECUTE FUNCTION private.finance_closed_immutable();
CREATE FUNCTION private.finance_projection() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE base bigint;
BEGIN
 IF TG_TABLE_NAME='finance_charges' THEN INSERT INTO public.finance_charge_balances(business_id,charge_id,pending_minor) VALUES(NEW.business_id,NEW.id,NEW.amount_minor);
 ELSIF TG_TABLE_NAME='finance_postings' THEN UPDATE public.finance_accounts SET balance_minor=balance_minor+NEW.delta_minor WHERE id=NEW.account_id AND business_id=NEW.business_id;
 ELSE
  SELECT amount_minor INTO base FROM public.finance_charges WHERE id=NEW.charge_id AND business_id=NEW.business_id;
  IF TG_TABLE_NAME='finance_allocations' THEN UPDATE public.finance_charge_balances SET paid_minor=paid_minor+NEW.delta_minor,pending_minor=base+adjustment_minor-paid_minor-NEW.delta_minor WHERE charge_id=NEW.charge_id AND business_id=NEW.business_id;
  ELSE UPDATE public.finance_charge_balances SET adjustment_minor=adjustment_minor+NEW.delta_minor,pending_minor=base+adjustment_minor+NEW.delta_minor-paid_minor WHERE charge_id=NEW.charge_id AND business_id=NEW.business_id;END IF;
 END IF;RETURN NEW;
END$$;
DO $$DECLARE t text;BEGIN FOREACH t IN ARRAY ARRAY['finance_charges','finance_postings','finance_allocations','finance_charge_adjustments'] LOOP EXECUTE format('CREATE TRIGGER finance_projection AFTER INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION private.finance_projection()',t);END LOOP;END$$;
CREATE FUNCTION private.finance_assert(bid text,permission text,writing boolean DEFAULT false) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE uid text:=private.user_id();role text:=private.member_role(bid);
BEGIN
 IF uid IS NULL OR role IS NULL OR NOT(role='owner' OR (role='manager' AND EXISTS(SELECT 1 FROM public.finance_permissions p WHERE p.business_id=bid AND p.user_id=uid AND permission=ANY(p.permissions)))) THEN RAISE EXCEPTION 'FINANCE_FORBIDDEN' USING ERRCODE='42501';END IF;
 PERFORM private.require_feature(bid,'finance_core');
 IF writing AND NOT private.subscription_live(bid) THEN RAISE EXCEPTION 'SUBSCRIPTION_REQUIRED' USING ERRCODE='42501';END IF;
 RETURN uid;
END$$;
CREATE FUNCTION private.finance_amount(value text) RETURNS bigint LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$BEGIN
 IF value IS NULL OR value !~ '^(0|[1-9][0-9]{0,14})$' THEN RAISE EXCEPTION 'FINANCE_INVALID_AMOUNT';END IF;RETURN value::bigint;
END$$;
CREATE FUNCTION private.finance_charge(bid text,booking text) RETURNS public.finance_charges LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE b public.bookings;c public.finance_charges;inserted int;
BEGIN
 PERFORM 1 FROM public.finance_settings WHERE business_id=bid FOR UPDATE;
 SELECT * INTO b FROM public.bookings WHERE business_id=bid AND id=booking;
 IF b.id IS NULL OR b.status IN ('cancelled','no_show') THEN RAISE EXCEPTION 'FINANCE_BOOKING_UNAVAILABLE';END IF;
 INSERT INTO public.finance_charges(business_id,booking_id,customer_id,customer_name,service_name,staff_id,amount_minor,currency,service_at) SELECT bid,b.id,b.customer_id,coalesce(b.customer_name_snapshot,cust.name,'Cliente'),s.name,b.staff_id,b.price_minor,b.currency,b.starts_at FROM public.customers cust,public.services s WHERE cust.id=b.customer_id AND s.id=b.service_id ON CONFLICT(business_id,booking_id) DO NOTHING;
 GET DIAGNOSTICS inserted=ROW_COUNT;IF inserted>0 THEN UPDATE public.finance_settings SET revision=revision+1 WHERE business_id=bid;END IF;
 SELECT * INTO c FROM public.finance_charges WHERE business_id=bid AND booking_id=booking;IF c.id IS NULL THEN RAISE EXCEPTION 'FINANCE_BOOKING_UNAVAILABLE';END IF;RETURN c;
END$$;
CREATE FUNCTION private.finance_completed_charge() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$BEGIN
 IF NEW.status='completed' AND OLD.status IS DISTINCT FROM NEW.status AND EXISTS(SELECT 1 FROM public.finance_settings WHERE business_id=NEW.business_id AND started_at<=now()) AND private.has_feature(NEW.business_id,'finance_core') THEN PERFORM private.finance_charge(NEW.business_id,NEW.id);END IF;RETURN NEW;
END$$;
CREATE TRIGGER finance_completed_charge AFTER UPDATE OF status ON public.bookings FOR EACH ROW EXECUTE FUNCTION private.finance_completed_charge();
CREATE FUNCTION private.finance_command(bid text,operation text,payload jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
#variable_conflict use_variable
DECLARE uid text;biz public.businesses;cfg public.finance_settings;prior private.finance_operations;key text:=payload->>'request_key';fingerprint text:=private.hash(operation||':'||(payload-'request_key')::text);result jsonb;account public.finance_accounts;method public.finance_methods;session public.finance_cash_sessions;charge public.finance_charges;original public.finance_events;eid text:=gen_random_uuid()::text;sid text;aid text;bank text;amount bigint;delta bigint;expected bigint;paid bigint;total bigint;refunded bigint;note text:=trim(coalesce(payload->>'note',''));needed text;
BEGIN
 needed:=CASE WHEN operation IN ('initialize','method','account') THEN 'settings' WHEN operation IN ('open','close') THEN 'cash' WHEN operation IN ('refund','reverse') THEN 'refund' ELSE 'collect' END;
 uid:=private.finance_assert(bid,needed,operation<>'close');SELECT * INTO biz FROM public.businesses WHERE id=bid;
 IF key IS NULL OR key !~ '^[A-Za-z0-9_-]{16,100}$' OR length(note)>500 OR jsonb_typeof(payload)<>'object' THEN RAISE EXCEPTION 'FINANCE_INVALID_REQUEST';END IF;
 -- Lock a receipt booking before the ledger, matching Agenda completion (booking → ledger).
 -- This prevents a foreign-key/ledger lock cycle while a turn is being completed.
 IF operation='receipt' THEN PERFORM 1 FROM public.bookings WHERE business_id=bid AND id=payload->>'booking_id' FOR KEY SHARE;END IF;
 -- One short ledger lock per business serializes money invariants; no business-wide Agenda lock.
 IF operation='initialize' THEN INSERT INTO public.finance_settings(business_id) VALUES(bid) ON CONFLICT DO NOTHING;END IF;
 SELECT * INTO cfg FROM public.finance_settings WHERE business_id=bid FOR UPDATE;
 IF cfg.business_id IS NULL THEN RAISE EXCEPTION 'FINANCE_NOT_INITIALIZED';END IF;
 SELECT * INTO prior FROM private.finance_operations WHERE business_id=bid AND request_key=key;
 IF prior.business_id IS NOT NULL THEN IF prior.fingerprint<>fingerprint OR prior.actor_id<>uid THEN RAISE EXCEPTION 'FINANCE_KEY_REUSED';END IF;RETURN prior.result;END IF;
 IF operation='initialize' THEN
  IF NOT EXISTS(SELECT 1 FROM public.finance_accounts WHERE business_id=bid) THEN
   INSERT INTO public.finance_accounts(business_id,name,kind) VALUES(bid,'Caja principal','cash') RETURNING id INTO aid;
   INSERT INTO public.finance_accounts(business_id,name,kind) VALUES(bid,'Banco y otros medios','bank') RETURNING id INTO bank;
   INSERT INTO public.finance_methods(business_id,account_id,name) VALUES(bid,aid,'Efectivo'),(bid,bank,'Transferencia'),(bid,bank,'Tarjeta · registro manual');
  END IF;result:=jsonb_build_object('initialized',true);
 ELSIF operation IN ('method','account') THEN
  IF operation='account' THEN
   IF (SELECT count(*) FROM public.finance_accounts WHERE business_id=bid AND kind='cash')>= (CASE WHEN private.has_feature(bid,'finance_multiple_cash') THEN 10 ELSE 1 END) THEN RAISE EXCEPTION 'FINANCE_CASH_LIMIT';END IF;
   INSERT INTO public.finance_accounts(business_id,name,kind) VALUES(bid,trim(payload->>'name'),'cash') RETURNING id INTO aid;result:=jsonb_build_object('id',aid);
  ELSE
   IF NOT EXISTS(SELECT 1 FROM public.finance_accounts WHERE id=payload->>'account_id' AND business_id=bid AND active) THEN RAISE EXCEPTION 'FINANCE_INVALID_ACCOUNT';END IF;
   INSERT INTO public.finance_methods(business_id,account_id,name) VALUES(bid,payload->>'account_id',trim(payload->>'name')) RETURNING id INTO aid;result:=jsonb_build_object('id',aid);
  END IF;
 ELSE
  IF payload->>'currency' IS DISTINCT FROM biz.currency THEN RAISE EXCEPTION 'FINANCE_CURRENCY_MISMATCH';END IF;
  IF operation IN ('open','close') THEN
   PERFORM private.require_feature(bid,'finance_cash');
   SELECT * INTO account FROM public.finance_accounts WHERE id=payload->>'account_id' AND business_id=bid AND kind='cash' AND active;
   IF account.id IS NULL THEN RAISE EXCEPTION 'FINANCE_INVALID_ACCOUNT';END IF;
   SELECT * INTO session FROM public.finance_cash_sessions WHERE business_id=bid AND account_id=account.id AND closed_at IS NULL FOR UPDATE;
   amount:=private.finance_amount(payload->>'amount_minor');
   IF operation='open' THEN
    IF session.id IS NOT NULL THEN RAISE EXCEPTION 'FINANCE_CASH_ALREADY_OPEN';END IF;
    INSERT INTO public.finance_cash_sessions(business_id,account_id,opened_by,opening_minor) VALUES(bid,account.id,uid,amount) RETURNING id INTO sid;
    delta:=amount-account.balance_minor;
    INSERT INTO public.finance_events(id,business_id,kind,amount_minor,currency,account_id,session_id,note,actor_id) VALUES(eid,bid,'opening',abs(delta),biz.currency,account.id,sid,note,uid);
    INSERT INTO public.finance_postings(business_id,event_id,account_id,delta_minor) VALUES(bid,eid,account.id,delta);
   ELSE
    IF session.id IS NULL OR session.id IS DISTINCT FROM payload->>'session_id' THEN RAISE EXCEPTION 'FINANCE_CASH_NOT_OPEN';END IF;
    IF session.revision::text IS DISTINCT FROM payload->>'expected_revision' THEN RAISE EXCEPTION 'FINANCE_CASH_CHANGED';END IF;
    SELECT session.opening_minor+coalesce(sum(p.delta_minor),0) INTO expected FROM public.finance_events e JOIN public.finance_postings p ON p.event_id=e.id WHERE e.business_id=bid AND e.session_id=session.id AND e.kind NOT IN ('opening','variance');
    delta:=amount-expected;IF delta<>0 AND length(note)<4 THEN RAISE EXCEPTION 'FINANCE_DIFFERENCE_REASON';END IF;
    UPDATE public.finance_cash_sessions SET closed_at=now(),closed_by=uid,expected_minor=expected,counted_minor=amount,difference_minor=delta,close_note=note,revision=revision+1 WHERE id=session.id;
    IF delta<>0 THEN
     INSERT INTO public.finance_events(id,business_id,kind,amount_minor,currency,account_id,session_id,note,actor_id) VALUES(eid,bid,'variance',abs(delta),biz.currency,account.id,session.id,note,uid);
     INSERT INTO public.finance_postings(business_id,event_id,account_id,delta_minor) VALUES(bid,eid,account.id,delta);
    END IF;sid:=session.id;
   END IF;result:=jsonb_build_object('session_id',sid,'closed',operation='close','expected_minor',expected::text,'counted_minor',CASE WHEN operation='close' THEN amount::text ELSE NULL END);
  ELSE
   amount:=private.finance_amount(payload->>'amount_minor');IF amount<=0 THEN RAISE EXCEPTION 'FINANCE_INVALID_AMOUNT';END IF;
   SELECT * INTO method FROM public.finance_methods WHERE business_id=bid AND id=payload->>'method_id' AND active;
   IF method.id IS NULL THEN RAISE EXCEPTION 'FINANCE_INVALID_METHOD';END IF;
   SELECT * INTO account FROM public.finance_accounts WHERE business_id=bid AND id=method.account_id AND active;
   IF account.id IS NULL THEN RAISE EXCEPTION 'FINANCE_INVALID_ACCOUNT';END IF;
   IF account.kind='cash' THEN
    SELECT * INTO session FROM public.finance_cash_sessions WHERE business_id=bid AND account_id=account.id AND closed_at IS NULL FOR UPDATE;
    IF session.id IS NULL THEN RAISE EXCEPTION 'FINANCE_CASH_REQUIRED';END IF;sid:=session.id;
   END IF;
   IF operation='receipt' THEN
    charge:=private.finance_charge(bid,payload->>'booking_id');
    SELECT charge.amount_minor+coalesce((SELECT sum(delta_minor) FROM public.finance_charge_adjustments WHERE business_id=bid AND charge_id=charge.id),0),coalesce((SELECT sum(delta_minor) FROM public.finance_allocations WHERE business_id=bid AND charge_id=charge.id),0) INTO total,paid;
    IF amount>total-paid THEN RAISE EXCEPTION 'FINANCE_OVERPAYMENT';END IF;delta:=amount;
   ELSIF operation IN ('income','expense') THEN
    IF length(note)<3 THEN RAISE EXCEPTION 'FINANCE_CONCEPT_REQUIRED';END IF;delta:=CASE WHEN operation='income' THEN amount ELSE -amount END;
   ELSIF operation IN ('refund','reverse') THEN
    SELECT * INTO original FROM public.finance_events WHERE business_id=bid AND id=payload->>'event_id';
    IF original.id IS NULL OR original.kind NOT IN ('receipt','income','expense') OR EXISTS(SELECT 1 FROM public.finance_events WHERE business_id=bid AND related_event_id=original.id AND kind='reversal') THEN RAISE EXCEPTION 'FINANCE_INVALID_ORIGINAL';END IF;
    IF length(note)<4 THEN RAISE EXCEPTION 'FINANCE_REASON_REQUIRED';END IF;
    SELECT coalesce(sum(amount_minor),0) INTO refunded FROM public.finance_events WHERE business_id=bid AND related_event_id=original.id AND kind='refund';
    IF operation='refund' THEN
     IF original.kind<>'receipt' OR amount>original.amount_minor-refunded THEN RAISE EXCEPTION 'FINANCE_REFUND_LIMIT';END IF;delta:=-amount;
    ELSE
     IF amount<>original.amount_minor OR refunded<>0 OR account.id<>original.account_id OR (original.session_id IS NOT NULL AND original.session_id IS DISTINCT FROM sid) THEN RAISE EXCEPTION 'FINANCE_RECTIFICATION_REQUIRED';END IF;
     delta:=CASE WHEN original.kind='expense' THEN amount ELSE -amount END;
    END IF;
    SELECT * INTO charge FROM public.finance_charges WHERE business_id=bid AND id=original.charge_id;
   ELSE RAISE EXCEPTION 'FINANCE_UNKNOWN_OPERATION';END IF;
   IF account.kind='cash' AND delta<0 THEN
    SELECT session.opening_minor+coalesce(sum(p.delta_minor),0) INTO expected FROM public.finance_events e JOIN public.finance_postings p ON p.event_id=e.id WHERE e.business_id=bid AND e.session_id=sid AND e.kind NOT IN ('opening','variance');
    IF expected+delta<0 THEN RAISE EXCEPTION 'FINANCE_CASH_INSUFFICIENT';END IF;
   END IF;
   INSERT INTO public.finance_events(id,business_id,kind,amount_minor,currency,method_id,method_name,account_id,session_id,charge_id,related_event_id,note,actor_id) VALUES(eid,bid,CASE WHEN operation='reverse' THEN 'reversal' ELSE operation END,amount,biz.currency,method.id,method.name,account.id,sid,charge.id,original.id,note,uid);
   INSERT INTO public.finance_postings(business_id,event_id,account_id,delta_minor) VALUES(bid,eid,account.id,delta);
   IF charge.id IS NOT NULL THEN
    INSERT INTO public.finance_allocations(business_id,event_id,charge_id,delta_minor) VALUES(bid,eid,charge.id,delta);
    IF operation='refund' AND coalesce((payload->>'reduce_charge')::boolean,false) THEN INSERT INTO public.finance_charge_adjustments(business_id,event_id,charge_id,delta_minor) VALUES(bid,eid,charge.id,-amount);END IF;
   END IF;
   IF sid IS NOT NULL THEN UPDATE public.finance_cash_sessions SET revision=revision+1 WHERE id=sid;END IF;
   result:=jsonb_build_object('event_id',eid,'charge_id',charge.id,'amount_minor',amount::text,'currency',biz.currency);
  END IF;
 END IF;
 INSERT INTO private.finance_operations(business_id,request_key,actor_id,operation,fingerprint,result) VALUES(bid,key,uid,operation,fingerprint,result);
 UPDATE public.finance_settings SET revision=revision+1 WHERE business_id=bid;
 INSERT INTO public.audit_log VALUES(gen_random_uuid()::text,bid,uid,'finance.'||operation,'finance',coalesce(result->>'event_id',result->>'session_id',bid),now());
 RETURN result;
END$$;
CREATE FUNCTION private.finance_read(bid text,params jsonb DEFAULT '{}') RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
#variable_conflict use_variable
DECLARE uid text;biz public.businesses;cfg public.finance_settings;day date;lo date;hi date;start_at timestamptz;end_at timestamptz;result jsonb;cursor_at timestamptz;cursor_id text;events jsonb;
BEGIN
 uid:=private.finance_assert(bid,'read');SELECT * INTO biz FROM public.businesses WHERE id=bid;
 SELECT * INTO cfg FROM public.finance_settings WHERE business_id=bid;
 IF params ? 'status_key' THEN RETURN jsonb_build_object('result',(SELECT o.result FROM private.finance_operations o WHERE o.business_id=bid AND o.request_key=params->>'status_key' AND o.actor_id=uid));END IF;
 day:=(now() AT TIME ZONE biz.timezone)::date;lo:=coalesce((params->>'from')::date,date_trunc('month',day)::date);hi:=coalesce((params->>'to')::date,day);
 IF hi<lo OR hi-lo>365 THEN RAISE EXCEPTION 'FINANCE_INVALID_PERIOD';END IF;
 start_at:=lo::timestamp AT TIME ZONE biz.timezone;end_at:=(hi+1)::timestamp AT TIME ZONE biz.timezone;
 cursor_at:=(params->>'cursor_at')::timestamptz;cursor_id:=coalesce(params->>'cursor_id','');
 SELECT coalesce(jsonb_agg(x ORDER BY x.created_at DESC,x.id DESC),'[]'::jsonb) INTO events FROM (
  SELECT e.id,e.kind,e.amount_minor::text,e.currency,e.method_name,e.note,e.created_at,e.charge_id,e.related_event_id,e.session_id,coalesce(c.customer_name,'') customer_name,coalesce(c.service_name,'') service_name,coalesce(c.booking_id,'') booking_id,coalesce(o.kind,'') original_kind,coalesce(p.delta_minor,0)::text delta_minor,EXISTS(SELECT 1 FROM public.finance_events r WHERE r.business_id=bid AND r.related_event_id=e.id AND r.kind='reversal') reversed,coalesce((SELECT sum(r.amount_minor) FROM public.finance_events r WHERE r.business_id=bid AND r.related_event_id=e.id AND r.kind='refund'),0)::text refunded_minor,a.name account_name,a.kind account_kind,e.method_id,e.account_id,(e.session_id IS NULL OR EXISTS(SELECT 1 FROM public.finance_cash_sessions cs WHERE cs.id=e.session_id AND cs.closed_at IS NULL)) correctable
  FROM public.finance_events e JOIN public.finance_accounts a ON a.id=e.account_id LEFT JOIN public.finance_events o ON o.id=e.related_event_id LEFT JOIN public.finance_charges c ON c.id=e.charge_id LEFT JOIN public.finance_postings p ON p.event_id=e.id AND p.account_id=e.account_id
  WHERE e.business_id=bid AND e.created_at>=start_at AND e.created_at<end_at AND e.kind NOT IN ('opening','variance') AND (cursor_at IS NULL OR (e.created_at,e.id)<(cursor_at,cursor_id)) ORDER BY e.created_at DESC,e.id DESC LIMIT 50
 ) x;
 WITH financial_values AS (
 SELECT e.created_at,e.kind,o.kind original_kind,e.amount_minor FROM public.finance_events e LEFT JOIN public.finance_events o ON o.id=e.related_event_id WHERE e.business_id=bid AND e.created_at>=start_at AND e.created_at<end_at
 ), totals AS (
 SELECT coalesce(sum(CASE WHEN kind='receipt' THEN amount_minor WHEN kind='reversal' AND original_kind='receipt' THEN -amount_minor ELSE 0 END),0) receipts,coalesce(sum(CASE WHEN kind='income' THEN amount_minor WHEN kind='reversal' AND original_kind='income' THEN -amount_minor ELSE 0 END),0) income,coalesce(sum(CASE WHEN kind='expense' THEN amount_minor WHEN kind='reversal' AND original_kind='expense' THEN -amount_minor ELSE 0 END),0) expenses,coalesce(sum(amount_minor) FILTER(WHERE kind='refund'),0) refunds FROM financial_values
 ) SELECT jsonb_build_object('receipts_minor',receipts::text,'income_minor',income::text,'expenses_minor',expenses::text,'refunds_minor',refunds::text,'net_minor',(receipts+income-expenses-refunds)::text) INTO result FROM totals;
 RETURN jsonb_build_object('initialized',cfg.business_id IS NOT NULL,'started_at',cfg.started_at,'revision',coalesce(cfg.revision,0)::text,'currency',biz.currency,'timezone',biz.timezone,'from',lo,'to',hi,'can_write',private.subscription_live(bid),'permissions',CASE WHEN private.member_role(bid)='owner' THEN '["read","collect","cash","refund","settings"]'::jsonb ELSE to_jsonb(coalesce((SELECT permissions FROM public.finance_permissions WHERE business_id=bid AND user_id=uid),'{}'::text[])) END,'totals',result,
 'completed_minor',coalesce((SELECT sum(price_minor) FROM public.bookings WHERE business_id=bid AND status='completed' AND starts_at>=start_at AND starts_at<end_at),0)::text,
 'pending_minor',coalesce((SELECT sum(pending_minor) FROM public.finance_charge_balances WHERE business_id=bid AND pending_minor>0),0)::text,
 'events',events,'next_cursor',CASE WHEN jsonb_array_length(events)=50 THEN jsonb_build_object('cursor_at',events->49->>'created_at','cursor_id',events->49->>'id') ELSE NULL END,
 'accounts',coalesce((SELECT jsonb_agg(jsonb_build_object('id',a.id,'name',a.name,'kind',a.kind,'balance_minor',a.balance_minor::text) ORDER BY a.kind,a.name) FROM public.finance_accounts a WHERE business_id=bid AND active),'[]'),
 'methods',coalesce((SELECT jsonb_agg(jsonb_build_object('id',m.id,'name',m.name,'account_id',m.account_id,'cash',a.kind='cash') ORDER BY m.name) FROM public.finance_methods m JOIN public.finance_accounts a ON a.id=m.account_id WHERE m.business_id=bid AND m.active AND a.active),'[]'),
 'sessions',coalesce((SELECT jsonb_agg(x ORDER BY x.opened_at DESC,x.id DESC) FROM (SELECT cs.id,cs.account_id,a.name account_name,cs.opened_at,cs.closed_at,cs.revision::text,cs.opening_minor::text,cs.counted_minor::text,cs.difference_minor::text,cs.close_note,u.name opened_by_name,CASE WHEN cs.closed_at IS NOT NULL THEN cs.expected_minor ELSE cs.opening_minor+coalesce((SELECT sum(p.delta_minor) FROM public.finance_events e JOIN public.finance_postings p ON p.event_id=e.id WHERE e.business_id=bid AND e.session_id=cs.id AND e.kind NOT IN ('opening','variance')),0) END::text expected_minor FROM public.finance_cash_sessions cs JOIN public.finance_accounts a ON a.id=cs.account_id JOIN public.users u ON u.id=cs.opened_by WHERE cs.business_id=bid ORDER BY cs.closed_at NULLS FIRST,cs.opened_at DESC LIMIT 30) x),'[]'),
 'charges',coalesce((SELECT jsonb_agg(x ORDER BY x.service_at DESC,x.id DESC) FROM (SELECT c.id,c.booking_id,c.customer_id,c.customer_name,c.service_name,c.currency,c.service_at,b.status,st.name staff_name,c.amount_minor::text,cb.adjustment_minor::text,cb.paid_minor::text,cb.pending_minor::text FROM public.finance_charges c JOIN public.finance_charge_balances cb ON cb.charge_id=c.id AND cb.business_id=bid JOIN public.bookings b ON b.id=c.booking_id JOIN public.staff st ON st.id=c.staff_id WHERE c.business_id=bid AND cb.pending_minor>0 ORDER BY c.service_at DESC,c.id DESC LIMIT 80) x),'[]'),
 'bookings',coalesce((SELECT jsonb_agg(x ORDER BY x.starts_at DESC) FROM (SELECT b.id,b.starts_at,b.status,coalesce(b.customer_name_snapshot,c.name) customer_name,s.name service_name,st.name staff_name,b.price_minor::text,b.currency,fc.id charge_id,(fc.amount_minor+coalesce((SELECT sum(delta_minor) FROM public.finance_charge_adjustments WHERE business_id=bid AND charge_id=fc.id),0)-coalesce((SELECT sum(delta_minor) FROM public.finance_allocations WHERE business_id=bid AND charge_id=fc.id),0))::text pending_minor FROM public.bookings b JOIN public.customers c ON c.id=b.customer_id JOIN public.services s ON s.id=b.service_id JOIN public.staff st ON st.id=b.staff_id LEFT JOIN public.finance_charges fc ON fc.booking_id=b.id AND fc.business_id=bid WHERE b.business_id=bid AND b.status NOT IN ('cancelled','no_show') AND ((b.starts_at>=now()-interval '90 days' AND b.starts_at<now()+interval '31 days') OR b.id=params->>'booking_id') ORDER BY (b.id=coalesce(params->>'booking_id','')) DESC,b.starts_at DESC LIMIT 80) x),'[]'),
 'daily',coalesce((SELECT jsonb_agg(x ORDER BY x.day) FROM (SELECT (e.created_at AT TIME ZONE biz.timezone)::date AS "day",sum(p.delta_minor)::text net_minor FROM public.finance_events e JOIN public.finance_postings p ON p.event_id=e.id WHERE e.business_id=bid AND e.created_at>=start_at AND e.created_at<end_at AND e.kind NOT IN ('opening','variance') GROUP BY 1) x),'[]'),
 'checked_at',now());
END$$;
CREATE FUNCTION public.atry_finance_read(bid text,params jsonb DEFAULT '{}') RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$SELECT private.finance_read(bid,params)$$;
CREATE FUNCTION public.atry_finance_command(bid text,operation text,payload jsonb) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$SELECT private.finance_command(bid,operation,payload)$$;
REVOKE ALL ON FUNCTION private.finance_projection(),private.finance_closed_immutable(),private.finance_immutable(),private.finance_assert(text,text,boolean),private.finance_amount(text),private.finance_charge(text,text),private.finance_completed_charge(),private.finance_read(text,jsonb),private.finance_command(text,text,jsonb),public.atry_finance_read(text,jsonb),public.atry_finance_command(text,text,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION private.finance_read(text,jsonb),private.finance_command(text,text,jsonb),public.atry_finance_read(text,jsonb),public.atry_finance_command(text,text,jsonb) TO authenticated;
COMMIT;
