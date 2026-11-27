CREATE OR REPLACE FUNCTION private.member_role(bid text)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 SELECT role FROM public.memberships WHERE user_id=private.user_id() AND business_id=bid
$function$;

CREATE OR REPLACE FUNCTION public.atry_visit_command(bid text, visit_id text, operation text, payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN PERFORM public.atry_visit(bid,visit_id);RETURN private.visit_change(visit_id,operation,payload,true);END $function$;
