-- Administration must report the configured provider instead of a preview constant.
CREATE OR REPLACE FUNCTION public.atry_admin_operations() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM private.require_admin();
 RETURN jsonb_build_object('organizations',(SELECT count(*) FROM public.businesses),'queued_notifications',(SELECT count(*) FROM public.mail_jobs WHERE state IN ('queued','retry')),'integrations',jsonb_build_object('email',CASE WHEN (SELECT mail_enabled FROM private.runtime_settings WHERE id=1) THEN 'Brevo configurado; aceptación y entrega se verifican por separado' ELSE 'Entrega deshabilitada' END,'mercado_pago','Sin credenciales ni cobros','whatsapp','Pendiente de integración oficial'),'audit',coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM (SELECT action,entity,created_at FROM public.audit_log ORDER BY created_at DESC LIMIT 30) x),'[]'::jsonb));
END $$;
CREATE OR REPLACE FUNCTION public.atry_admin_diagnostics() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE versions jsonb:='[]';
BEGIN
 PERFORM private.require_admin();
 IF to_regclass('private.migration_ledger') IS NOT NULL THEN SELECT coalesce(jsonb_agg(jsonb_build_object('version',version,'applied_at',applied_at)),'[]'::jsonb) INTO versions FROM private.migration_ledger;END IF;
 RETURN jsonb_build_object('integrity','Restricciones PostgreSQL activas; diagnóstico físico no disponible por API','schema_versions',versions,'mail_provider',(SELECT CASE WHEN mail_enabled THEN 'brevo' ELSE 'disabled' END FROM private.runtime_settings WHERE id=1),'mail_states',coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM (SELECT state,count(*) count FROM public.mail_jobs GROUP BY state) x),'[]'::jsonb),'errors',coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM (SELECT code,count(*) count,max(created_at) latest FROM public.system_errors GROUP BY code ORDER BY max(created_at) DESC LIMIT 20) x),'[]'::jsonb),'audit',coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM (SELECT action,entity_id,created_at FROM public.platform_audit ORDER BY created_at DESC LIMIT 50) x),'[]'::jsonb));
END $$;
