CREATE FUNCTION private.scheduled_minutes(bid text,sid text,day date) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
#variable_conflict use_variable
DECLARE lo int;hi int;exception public.schedule_exceptions;blocked int:=0;
BEGIN
 IF EXISTS(SELECT 1 FROM public.holidays WHERE business_id=bid AND holidays.day=to_char(scheduled_minutes.day,'YYYY-MM-DD')) THEN RETURN 0;END IF;
 SELECT * INTO exception FROM public.schedule_exceptions WHERE staff_id=sid AND schedule_exceptions.day=to_char(scheduled_minutes.day,'YYYY-MM-DD');
 IF exception.id IS NOT NULL THEN IF exception.closed=1 THEN RETURN 0;END IF;lo:=exception.start_min;hi:=exception.end_min;
 ELSE SELECT start_min,end_min INTO lo,hi FROM public.working_hours WHERE staff_id=sid AND weekday=extract(dow FROM day)::int;END IF;
 IF lo IS NULL OR hi IS NULL THEN RETURN 0;END IF;
 SELECT coalesce(sum(upper(r)-lower(r)),0) INTO blocked FROM unnest((SELECT range_agg(int4range(greatest(lo,start_min),least(hi,end_min),'[)')) FROM public.recurring_breaks WHERE staff_id=sid AND weekday=extract(dow FROM day)::int AND start_min<hi AND end_min>lo)) r;
 RETURN hi-lo-blocked;
END $$;
CREATE FUNCTION public.atry_insights(bid text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
#variable_conflict use_variable
DECLARE tz text;lo timestamptz:=now()-interval '30 days';hi timestamptz:=now();history timestamptz:=now()-interval '90 days';today date;result jsonb;occupation jsonb;
BEGIN
 PERFORM private.require_manager(bid);
 IF (SELECT p.reports FROM public.plans p JOIN public.businesses b ON b.plan=p.code WHERE b.id=bid)=0 THEN RAISE EXCEPTION 'FEATURE_DISABLED' USING ERRCODE='42501';END IF;
 SELECT timezone INTO tz FROM public.businesses WHERE id=bid;today:=(now() AT TIME ZONE tz)::date;
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',s.id,'name',s.name,'scheduled_minutes',capacity.minutes,'booked_minutes',used.minutes,'occupancy_percent',CASE WHEN capacity.minutes>0 THEN round(100.0*used.minutes/capacity.minutes) ELSE NULL END)),'[]'::jsonb) INTO occupation
 FROM public.staff s CROSS JOIN LATERAL (SELECT coalesce(sum(private.scheduled_minutes(bid,s.id,today-n)),0) minutes FROM generate_series(0,29) n) capacity CROSS JOIN LATERAL (SELECT coalesce(sum(extract(epoch FROM (ends_at-starts_at))/60),0) minutes FROM public.bookings WHERE business_id=bid AND staff_id=s.id AND starts_at>=lo AND starts_at<hi AND status<>'cancelled') used WHERE s.business_id=bid AND s.active=1;
 SELECT jsonb_build_object('bookings',count(*),'cancelled',count(*) FILTER(WHERE status='cancelled'),'no_show',count(*) FILTER(WHERE status='no_show'),'completed_service_value',coalesce(sum(price_uyu) FILTER(WHERE status='completed'),0)) INTO result FROM public.bookings WHERE business_id=bid AND starts_at>=lo AND starts_at<hi;
 RETURN result||jsonb_build_object(
 'period',jsonb_build_object('from',lo,'until',hi,'days',30),'occupancy',occupation,'occupancy_method','Duración de turnos no cancelados / jornada actual menos descansos y cierres, últimos 30 días. No descuenta ausencias por fecha ni reconstruye horarios históricos.',
 'forecast_service_value',(SELECT coalesce(sum(price_uyu),0) FROM public.bookings WHERE business_id=bid AND starts_at>=hi AND status IN ('confirmed','pending')),'verified_payments',NULL,'payment_explanation','No hay proveedor de pagos: los valores de servicios no acreditan cobros.',
 'popular_services',coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM (SELECT s.name,count(*) count FROM public.bookings b JOIN public.services s ON s.id=b.service_id WHERE b.business_id=bid AND b.starts_at>=lo AND b.starts_at<hi AND b.status<>'cancelled' GROUP BY s.id,s.name ORDER BY count(*) DESC LIMIT 5) x),'[]'::jsonb),
 'demand_hours',coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM (SELECT to_char(starts_at AT TIME ZONE tz,'HH24') AS "hour",count(*) count FROM public.bookings WHERE business_id=bid AND starts_at>=lo AND starts_at<hi AND status<>'cancelled' GROUP BY 1 ORDER BY count(*) DESC) x),'[]'::jsonb),
 'recurrent_customers',(SELECT count(*) FROM (SELECT customer_id FROM public.bookings WHERE business_id=bid AND starts_at>=lo AND starts_at<hi AND status='completed' GROUP BY customer_id HAVING count(*)>=2) x),
 'daily',coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM (SELECT to_char(starts_at AT TIME ZONE tz,'YYYY-MM-DD') AS "day",count(*) count FROM public.bookings WHERE business_id=bid AND starts_at>=lo AND starts_at<hi GROUP BY 1 ORDER BY 1) x),'[]'::jsonb),
 'weekly',coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM (SELECT to_char(date_trunc('week',starts_at AT TIME ZONE tz),'YYYY-MM-DD') AS "start",count(*) count FROM public.bookings WHERE business_id=bid AND starts_at>=history AND starts_at<hi GROUP BY 1 ORDER BY 1) x),'[]'::jsonb),
 'monthly',coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM (SELECT to_char(starts_at AT TIME ZONE tz,'YYYY-MM') AS "month",count(*) count FROM public.bookings WHERE business_id=bid AND starts_at>=history AND starts_at<hi GROUP BY 1 ORDER BY 1) x),'[]'::jsonb),'history_days',90);
END $$;
CREATE FUNCTION public.atry_dashboard(bid text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
#variable_conflict use_variable
DECLARE day date;tz text;events jsonb;totals jsonb;daily jsonb;queue_count bigint;tips jsonb:='[]';
BEGIN
 PERFORM private.require_manager(bid);SELECT timezone INTO tz FROM public.businesses WHERE id=bid;day:=(now() AT TIME ZONE tz)::date;events:=public.atry_bookings(bid,day,1);
 SELECT jsonb_build_object('total',count(*),'completed_revenue',coalesce(sum(price_uyu) FILTER(WHERE status='completed'),0),'cancelled',count(*) FILTER(WHERE status='cancelled'),'no_show',count(*) FILTER(WHERE status='no_show')) INTO totals FROM public.bookings WHERE business_id=bid AND starts_at>=now()-interval '30 days' AND starts_at<now();
 SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) INTO daily FROM (SELECT to_char(starts_at AT TIME ZONE tz,'YYYY-MM-DD') AS "day",count(*) n FROM public.bookings WHERE business_id=bid AND starts_at AT TIME ZONE tz>=(day-6)::timestamp AND starts_at AT TIME ZONE tz<(day+1)::timestamp AND status<>'cancelled' GROUP BY 1 ORDER BY 1) x;
 SELECT count(*) INTO queue_count FROM public.notifications WHERE business_id=bid AND state='queued';
 IF queue_count>0 THEN tips:=tips||jsonb_build_array(queue_count||' notificaciones están en cola; todavía no se confirmó su envío.');END IF;
 IF NOT EXISTS(SELECT 1 FROM public.services WHERE business_id=bid AND active=1) THEN tips:=tips||jsonb_build_array('Agregá tu primer servicio para comenzar a recibir reservas en línea.');END IF;
 RETURN jsonb_build_object('today',events,'today_count',jsonb_array_length(events),'totals',totals,'daily',daily,'insights',tips,'upcoming',coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM (SELECT b.id,b.starts_at,b.status,coalesce(b.customer_name_snapshot,c.name) customer_name,s.name service_name,st.name staff_name FROM public.bookings b JOIN public.customers c ON c.id=b.customer_id JOIN public.services s ON s.id=b.service_id JOIN public.staff st ON st.id=b.staff_id WHERE b.business_id=bid AND b.starts_at>=now() AND b.status IN ('confirmed','pending') ORDER BY b.starts_at LIMIT 8) x),'[]'::jsonb),
 'customers',(SELECT count(*) FROM public.customers WHERE business_id=bid),'staff',(SELECT count(*) FROM public.staff WHERE business_id=bid AND active=1),'services',(SELECT count(*) FROM public.services WHERE business_id=bid AND active=1),'waitlist',(SELECT count(*) FROM public.waitlist WHERE business_id=bid AND status IN ('waiting','offered')));
END $$;
CREATE FUNCTION public.atry_smartslots(bid text,day date) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
#variable_conflict use_variable
DECLARE b public.businesses;s public.services;slots jsonb;result jsonb:='[]';
BEGIN
 PERFORM private.require_manager(bid);SELECT * INTO b FROM public.businesses WHERE id=bid;
 IF (SELECT smartslots FROM public.plans WHERE code=b.plan)=0 THEN RAISE EXCEPTION 'FEATURE_DISABLED' USING ERRCODE='42501';END IF;
 FOR s IN SELECT * FROM public.services WHERE business_id=bid AND active=1 ORDER BY created_at LOOP
  slots:=public.atry_public_availability(b.slug,s.id,day,NULL)->'slots';
  result:=result||coalesce((SELECT jsonb_agg(value||jsonb_build_object('service_id',s.id,'service_name',s.name)) FROM (SELECT value FROM jsonb_array_elements(slots) WITH ORDINALITY ORDER BY ordinality LIMIT 3) x),'[]'::jsonb);
 END LOOP;
 RETURN jsonb_build_object('date',day,'method','Disponibilidad validada por el motor; hasta tres alternativas por servicio','suggestions',result);
END $$;
REVOKE ALL ON FUNCTION private.scheduled_minutes(text,text,date) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.atry_insights(text),public.atry_dashboard(text),public.atry_smartslots(text,date) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.atry_insights(text),public.atry_dashboard(text),public.atry_smartslots(text,date) TO authenticated;
