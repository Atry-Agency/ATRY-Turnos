BEGIN;
SET LOCAL lock_timeout='2s';
SET LOCAL statement_timeout='30s';
CREATE OR REPLACE FUNCTION private.dashboard_before_recurring(bid text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
#variable_conflict use_variable
DECLARE day date;tz text;events jsonb;totals jsonb;daily jsonb;queue_count bigint;tips jsonb:='[]';
BEGIN
 PERFORM private.require_manager(bid);SELECT timezone INTO tz FROM public.businesses WHERE id=bid;day:=(now() AT TIME ZONE tz)::date;events:=public.atry_bookings(bid,day,1);
 SELECT jsonb_build_object('total',count(*),'currency',(SELECT currency FROM public.businesses WHERE id=bid),'completed_revenue_minor',coalesce(sum(price_minor) FILTER(WHERE status='completed'),0),'completed_revenue',coalesce(sum(price_uyu) FILTER(WHERE status='completed'),0),'cancelled',count(*) FILTER(WHERE status='cancelled'),'no_show',count(*) FILTER(WHERE status='no_show')) INTO totals FROM public.bookings WHERE business_id=bid AND starts_at>=now()-interval '30 days' AND starts_at<now();
 SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) INTO daily FROM (SELECT to_char(starts_at AT TIME ZONE tz,'YYYY-MM-DD') AS "day",count(*) n FROM public.bookings WHERE business_id=bid AND starts_at AT TIME ZONE tz>=(day-6)::timestamp AND starts_at AT TIME ZONE tz<(day+1)::timestamp AND status<>'cancelled' GROUP BY 1 ORDER BY 1) x;
 SELECT count(*) INTO queue_count FROM public.notifications WHERE business_id=bid AND state='queued';
 IF queue_count>0 THEN tips:=tips||jsonb_build_array(queue_count||' notificaciones están en cola; todavía no se confirmó su envío.');END IF;
 IF NOT EXISTS(SELECT 1 FROM public.services WHERE business_id=bid AND active=1) THEN tips:=tips||jsonb_build_array('Agregá tu primer servicio para comenzar a recibir reservas en línea.');END IF;
 RETURN jsonb_build_object('today',events,'today_count',jsonb_array_length(events),'totals',totals,'daily',daily,'insights',tips,'upcoming',coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM (SELECT b.id,b.starts_at,b.status,coalesce(b.customer_name_snapshot,c.name) customer_name,s.name service_name,st.name staff_name FROM public.bookings b JOIN public.customers c ON c.id=b.customer_id JOIN public.services s ON s.id=b.service_id JOIN public.staff st ON st.id=b.staff_id WHERE b.business_id=bid AND b.starts_at>=now() AND b.status IN ('confirmed','pending') ORDER BY b.starts_at LIMIT 8) x),'[]'::jsonb),
 'customers',(SELECT count(*) FROM public.customers WHERE business_id=bid),'staff',(SELECT count(*) FROM public.staff WHERE business_id=bid AND active=1),'services',(SELECT count(*) FROM public.services WHERE business_id=bid AND active=1),'waitlist',(SELECT count(*) FROM public.waitlist WHERE business_id=bid AND status IN ('waiting','offered')));
END $function$
;
CREATE OR REPLACE FUNCTION public.atry_insights(bid text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
#variable_conflict use_variable
DECLARE tz text;lo timestamptz:=now()-interval '30 days';hi timestamptz:=now();history timestamptz:=now()-interval '90 days';today date;result jsonb;occupation jsonb;
BEGIN PERFORM private.require_feature(bid,'advanced');
 PERFORM private.require_manager(bid);
 IF (SELECT p.reports FROM public.plans p JOIN public.businesses b ON b.plan=p.code WHERE b.id=bid)=0 THEN RAISE EXCEPTION 'FEATURE_DISABLED' USING ERRCODE='42501';END IF;
 SELECT timezone INTO tz FROM public.businesses WHERE id=bid;today:=(now() AT TIME ZONE tz)::date;
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',s.id,'name',s.name,'scheduled_minutes',capacity.minutes,'booked_minutes',used.minutes,'occupancy_percent',CASE WHEN capacity.minutes>0 THEN round(100.0*used.minutes/capacity.minutes) ELSE NULL END)),'[]'::jsonb) INTO occupation
 FROM public.staff s CROSS JOIN LATERAL (SELECT coalesce(sum(private.scheduled_minutes(bid,s.id,today-n)),0) minutes FROM generate_series(0,29) n) capacity CROSS JOIN LATERAL (SELECT coalesce(sum(extract(epoch FROM (ends_at-starts_at))/60),0) minutes FROM public.bookings WHERE business_id=bid AND staff_id=s.id AND starts_at>=lo AND starts_at<hi AND status<>'cancelled') used WHERE s.business_id=bid AND s.active=1;
 SELECT jsonb_build_object('bookings',count(*),'cancelled',count(*) FILTER(WHERE status='cancelled'),'no_show',count(*) FILTER(WHERE status='no_show'),'currency',(SELECT currency FROM public.businesses WHERE id=bid),'completed_service_value_minor',coalesce(sum(price_minor) FILTER(WHERE status='completed'),0),'completed_service_value',coalesce(sum(price_uyu) FILTER(WHERE status='completed'),0)) INTO result FROM public.bookings WHERE business_id=bid AND starts_at>=lo AND starts_at<hi;
 RETURN result||jsonb_build_object(
 'period',jsonb_build_object('from',lo,'until',hi,'days',30),'occupancy',occupation,'occupancy_method','Duración de turnos no cancelados / jornada actual menos descansos y cierres, últimos 30 días. No descuenta ausencias por fecha ni reconstruye horarios históricos.',
 'forecast_service_value_minor',(SELECT coalesce(sum(price_minor),0) FROM public.bookings WHERE business_id=bid AND starts_at>=hi AND status IN ('confirmed','pending')),'forecast_service_value',(SELECT coalesce(sum(price_uyu),0) FROM public.bookings WHERE business_id=bid AND starts_at>=hi AND status IN ('confirmed','pending')),'verified_payments',NULL,'payment_explanation','No hay proveedor de pagos: los valores de servicios no acreditan cobros.',
 'popular_services',coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM (SELECT s.name,count(*) count FROM public.bookings b JOIN public.services s ON s.id=b.service_id WHERE b.business_id=bid AND b.starts_at>=lo AND b.starts_at<hi AND b.status<>'cancelled' GROUP BY s.id,s.name ORDER BY count(*) DESC LIMIT 5) x),'[]'::jsonb),
 'demand_hours',coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM (SELECT to_char(starts_at AT TIME ZONE tz,'HH24') AS "hour",count(*) count FROM public.bookings WHERE business_id=bid AND starts_at>=lo AND starts_at<hi AND status<>'cancelled' GROUP BY 1 ORDER BY count(*) DESC) x),'[]'::jsonb),
 'recurrent_customers',(SELECT count(*) FROM (SELECT customer_id FROM public.bookings WHERE business_id=bid AND starts_at>=lo AND starts_at<hi AND status='completed' GROUP BY customer_id HAVING count(*)>=2) x),
 'daily',coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM (SELECT to_char(starts_at AT TIME ZONE tz,'YYYY-MM-DD') AS "day",count(*) count FROM public.bookings WHERE business_id=bid AND starts_at>=lo AND starts_at<hi GROUP BY 1 ORDER BY 1) x),'[]'::jsonb),
 'weekly',coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM (SELECT to_char(date_trunc('week',starts_at AT TIME ZONE tz),'YYYY-MM-DD') AS "start",count(*) count FROM public.bookings WHERE business_id=bid AND starts_at>=history AND starts_at<hi GROUP BY 1 ORDER BY 1) x),'[]'::jsonb),
 'monthly',coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM (SELECT to_char(starts_at AT TIME ZONE tz,'YYYY-MM') AS "month",count(*) count FROM public.bookings WHERE business_id=bid AND starts_at>=history AND starts_at<hi GROUP BY 1 ORDER BY 1) x),'[]'::jsonb),'history_days',90);
END $function$
;
CREATE OR REPLACE FUNCTION public.atry_create_organization(payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
#variable_conflict use_variable
DECLARE uid text:=private.user_id();u public.users;bid text:=gen_random_uuid()::text;sid text:=gen_random_uuid()::text;name text:=btrim(payload->>'name');slug text:=lower(btrim(payload->>'slug'));
BEGIN
 IF payload->>'country'='PA' AND NOT coalesce((SELECT pa_registration_enabled FROM private.runtime_settings WHERE id=1),false) THEN RAISE EXCEPTION 'REGION_NOT_ENABLED';END IF;
 IF coalesce(payload->>'country','UY') NOT IN ('UY','PA') THEN RAISE EXCEPTION 'INVALID_COUNTRY';END IF;
 IF uid IS NULL THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501';END IF;
 SELECT * INTO u FROM public.users WHERE id=uid FOR UPDATE;
 IF (SELECT count(*) FROM public.memberships WHERE user_id=uid AND role='owner')>=10 THEN RAISE EXCEPTION 'ORGANIZATION_LIMIT';END IF;
 IF name IS NULL OR length(name)<2 OR length(name)>100 OR slug IS NULL OR slug!~'^[a-z0-9][a-z0-9-]{1,53}[a-z0-9]$' THEN RAISE EXCEPTION 'INVALID_ORGANIZATION';END IF;
 INSERT INTO public.businesses(id,slug,name,email,sector,city,country,timezone,currency,locale,subscription_status,trial_until,created_at) VALUES(bid,slug,name,u.email,coalesce(nullif(left(btrim(payload->>'sector'),100),''),'General'),CASE WHEN payload->>'country'='PA' THEN '' ELSE 'Montevideo' END,coalesce(payload->>'country','UY'),CASE WHEN payload->>'country'='PA' THEN 'America/Panama' ELSE 'America/Montevideo' END,CASE WHEN payload->>'country'='PA' THEN 'USD' ELSE 'UYU' END,CASE WHEN payload->>'country'='PA' THEN 'es-PA' ELSE 'es-UY' END,'trialing',now()+interval '14 days',now());
 INSERT INTO public.memberships VALUES(uid,bid,'owner');
 INSERT INTO public.staff(id,business_id,user_id,name,email,created_at) VALUES(sid,bid,uid,u.name,u.email,now());
 INSERT INTO public.working_hours SELECT sid,d,540,1080 FROM generate_series(1,6) d;
 INSERT INTO public.audit_log VALUES(gen_random_uuid()::text,bid,uid,'business.created','business',bid,now());
 UPDATE public.businesses SET subscription_status='pending',trial_until=now() WHERE id=bid;
 RETURN jsonb_build_object('id',bid,'name',name,'slug',slug);
END $function$
;
CREATE OR REPLACE FUNCTION public.atry_finish_registration()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE uid text:=private.user_id();meta jsonb;name text;slug text;
BEGIN
 IF uid IS NULL THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501';END IF;
 PERFORM 1 FROM public.users WHERE id=uid FOR UPDATE;
 IF EXISTS(SELECT 1 FROM public.memberships WHERE user_id=uid) THEN RETURN jsonb_build_object('ok',true);END IF;
 SELECT raw_user_meta_data INTO meta FROM auth.users WHERE id=auth.uid() AND email_confirmed_at IS NOT NULL;
 name:=nullif(btrim(meta->>'requested_business_name'),'');slug:=nullif(meta->>'requested_business_slug','');
 IF name IS NULL THEN RETURN jsonb_build_object('ok',true);END IF;
 RETURN public.atry_create_organization(jsonb_build_object('name',name,'slug',slug,'sector',meta->>'requested_business_sector','country',coalesce(meta->>'requested_business_country','UY')));
END $function$
;
COMMIT;
