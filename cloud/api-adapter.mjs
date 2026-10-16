const slugify=value=>String(value||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,55);
const fail=(status,message)=>Object.assign(new Error(message),{status});
const errorMessages={RECENT_AUTH_REQUIRED:'Volvé a iniciar sesión: esta acción exige autenticación en los últimos diez minutos.',STALE_REVISION:'Los datos cambiaron. Actualizá la sección antes de guardar.',RESERVATIONS_PAUSED:'El negocio pausó las nuevas reservas. Los turnos existentes se conservan.',REASON_REQUIRED:'Indicá un motivo de 5 a 500 caracteres.',LAST_ADMIN:'No se puede bloquear la cuenta actual ni el último administrador.',UNSAFE_MAIL_ACTION:'Este estado no admite reintento o cancelación segura. Revisá la evidencia del proveedor.',RESOLUTION_REQUIRED:'Registrá la resolución antes de cerrar la incidencia.',ADMIN_RATE_LIMIT:'Se alcanzó el límite de operaciones administrativas. Esperá un minuto.',DOWNGRADE_FUTURE_BOOKINGS_REASSIGN_REQUIRED:'Reasigná las reservas futuras de los profesionales excluidos antes de reducir el plan.',OPEN_REQUEST_EXISTS:'Ya tenés una solicitud pendiente.',DOWNGRADE_STAFF_SELECTION_REQUIRED:'Elegí los profesionales que continuarán activos antes de reducir el plan.',MONTHLY_QUOTA_EXHAUSTED:'Cuota mensual de correo agotada.',SUBSCRIPTION_REQUIRED:'El acceso del negocio requiere habilitación o renovación de Atry.',INVALID_PERIOD:'Elegí un período futuro válido; una renovación debe ampliar el acceso.',PAYMENT_REFERENCE_REQUIRED:'Indicá la referencia de transferencia o el motivo de la habilitación.',DUPLICATE_TRANSFER:'Esta transferencia ya se registró para este negocio.',CONTACT_CONFLICT:'Ese correo o teléfono corresponde a otra ficha. Revisá Clientes antes de continuar.',CONTACT_CHANGED:'El contacto cambió. Abrí nuevamente la ficha del cliente.',RECURRING_CONFLICT:'Ese horario pertenece a un turno fijo. Elegí otra fecha, hora o profesional.',INVALID_RECURRENCE:'Revisá la fecha, hora y frecuencia.',RECURRING_LIMIT:'Se alcanzó el límite de turnos fijos activos.',FORBIDDEN:'No tenés permiso para esta acción.',NOT_FOUND:'No encontramos el registro.',LAST_OWNER:'Debe quedar al menos un propietario.',FUTURE_BOOKINGS:'Hay reservas activas que impiden ese cambio.',STAFF_CONFLICT:'El profesional ya tiene un turno en ese horario.',RESOURCE_CONFLICT:'Un recurso necesario está ocupado.',IDEMPOTENCY_CONFLICT:'La solicitud cambió. Volvé a revisar los datos.',INVALID_TOKEN:'El enlace venció o ya no está disponible.',OUTSIDE_POLICY:'Se superó el plazo de modificación online.',STAFF_LIMIT:'El plan alcanzó su límite de profesionales.',FEATURE_DISABLED:'Esta función no está habilitada para el plan.',SERVICE_IN_USE:'El servicio tiene reservas futuras.',RESOURCE_IN_USE:'Hay reservas futuras que usan ese recurso.',VERIFIED_ACCOUNT_REQUIRED:'La persona necesita una cuenta con correo verificado.',WRONG_ACCOUNT:'Iniciá sesión con el correo invitado.'};
export function rpcError(error){const code=error?.message;if(code?.startsWith('RECURRING_DATE_CONFLICT:'))return fail(409,'La repetición tiene un conflicto el '+code.split(':')[1]+'. No se guardó ningún cambio; revisá horarios, ausencias y reservas.');return fail(error?.code==='42501'?403:error?.code==='23P01'||error?.code==='23505'?409:code==='NOT_FOUND'||code==='INVALID_TOKEN'?404:400,errorMessages[code]||(['23P01','23505'].includes(error?.code)?'Ese horario o registro ya está ocupado.':'Verificá los datos y reintentá la operación.'));}
export function createApiAdapter({auth,config,fetchImpl=fetch,protection=null,captcha=async()=>{throw fail(503,'Falta configurar la protección de reservas públicas.');}}){
 const client=auth.client;
 async function rpc(name,args={}){const result=await client.rpc(name,args);if(result.error){if(result.error.status===401||result.error.code==='PGRST301')throw fail(401,'La sesión venció. Iniciá sesión nuevamente.');throw rpcError(result.error);}return result.data;}
 const minutes=time=>{if(!/^\d{2}:\d{2}$/.test(time||''))throw fail(400,'Ingresá una hora válida.');const [h,m]=time.split(':').map(Number);if(h>23||m>59)throw fail(400,'Hora fuera de rango.');return h*60+m;};
 const catalogs=new Map();
 const catalog=bid=>{if(!catalogs.has(bid)){const pending=rpc('atry_catalog',{bid}).finally(()=>{if(catalogs.get(bid)===pending)catalogs.delete(bid);});catalogs.set(bid,pending);}return catalogs.get(bid);};
 async function publicCall(operation,{slug,token,data={},query={}}={}){
  const url=new URL(config.supabaseUrl+'/functions/v1/atry-public');url.searchParams.set('operation',operation);if(slug)url.searchParams.set('slug',slug);
  const read=['info','availability'].includes(operation),payload={...data,...(token?{token}:{})};
  if(['book','waitlist','accept_offer'].includes(operation)){
   payload.idempotency_key=payload.idempotency_key||crypto.randomUUID();const request={action:operation==='book'?'booking':operation==='waitlist'?'waitlist':'offer',key:payload.idempotency_key,slug};if(protection)Object.assign(payload,await protection(request));else payload.turnstile_token=await captcha(request);
  }
  if(read)for(const [key,value] of Object.entries(query))if(value!==null&&value!==undefined)url.searchParams.set(key,value);
  let response;try{response=await fetchImpl(url,{method:read?'GET':'POST',headers:{apikey:config.supabaseKey,...(!read?{'content-type':'application/json'}:{})},body:read?undefined:JSON.stringify(payload),signal:AbortSignal.timeout(25000)});}catch{throw fail(503,'No hay conexión. Conservá tus datos y reintentá.');}
  const result=await response.json();if(!response.ok)throw fail(response.status,errorMessages[result.error]||(response.status===429?'Demasiadas solicitudes. Esperá un minuto y reintentá.':'No se pudo completar la operación pública.'));return result;
 }
 async function identity(){const me=await rpc('atry_me');if(!me?.user)throw fail(401,'La sesión venció. Iniciá sesión nuevamente.');return me;}
 async function exportCsv(bid){
  let cursor=null,revision=null,rows=[];
  for(;;){const page=await rpc('atry_export_bookings',{bid,after_start:cursor?.start||null,after_id:cursor?.id||'',page_size:500});if(revision!==null&&revision!==page.revision)throw fail(409,'La agenda cambió durante la exportación. Reintentá para obtener una copia consistente.');revision=page.revision;rows.push(...page.rows);cursor=page.next_cursor;if(!cursor)break;}
  const quote=value=>'"'+String(value??'').replace(/^[\s]*[=+@-]/,"'").replace(/"/g,'""')+'"';
  return '\uFEFF'+[['Inicio UTC','Fin UTC','Estado','Servicio','Profesional','Cliente','Correo','Teléfono','Precio UYU'],...rows.map(x=>[x.starts_at,x.ends_at,x.status,x.service,x.professional,x.customer,x.email,x.phone,x.price_uyu])].map(row=>row.map(quote).join(',')).join('\r\n');
 }
 async function finishRegistration(){const result=await client.rpc('atry_finish_registration');if(result.error?.code==='23505')return {needsOrganizationSetup:true};if(result.error)throw rpcError(result.error);return result.data;}
 return {rpc,publicCall,identity,exportCsv,finishRegistration,async request(route,opts={}){
  const url=new URL(route,'https://atry.internal'),path=url.pathname,method=(opts.method||'GET').toUpperCase(),body=opts.body?JSON.parse(opts.body):{};
  if(method!=='GET')catalogs.clear();
  const ccRead=path.match(/^\/api\/admin\/control\/([a-z_]+)$/);if(ccRead&&method==='GET')return rpc('atry_control_read',{section:ccRead[1],params:Object.fromEntries(url.searchParams)});
  const ccAction=path.match(/^\/api\/admin\/control\/([a-z_]+)\/([A-Za-z0-9_-]+)$/);if(ccAction&&method==='POST')return rpc('atry_control_command',{action:ccAction[1],entity_id:ccAction[2],payload:body});
  const support=path.match(/^\/api\/business\/([A-Za-z0-9_-]+)\/support$/);if(support&&method==='POST')return rpc('atry_report_support',{bid:support[1],payload:body});
  if(path==='/api/health')return rpc('atry_health');
  if(path==='/api/config'){const {data}=await client.auth.getSession();return data?.session?rpc('atry_runtime_config'):{app:'Atry Turnos',version:'1.2.0',currency:'UYU',timezone:'America/Montevideo',mail_provider:'disabled',payments_live:false,whatsapp_live:false};}
  if(path==='/api/auth/me')return identity();
  if(path==='/api/auth/register'||path==='/api/auth/account'){if(path.endsWith('/register')&&String(body.business_name||'').trim().length<2)throw fail(400,'Ingresá el nombre de tu negocio.');return auth.signUp(body);}
  if(path==='/api/auth/login'){await auth.signIn(body.email,body.password);return {ok:true,...await finishRegistration()};}
  if(path==='/api/auth/logout')return auth.signOut();
  if(path==='/api/auth/forgot-password')return auth.requestRecovery(body.email);
  if(path==='/api/auth/reset-password')return auth.resetPassword(body.password);
  if(path==='/api/account/password')return auth.changePassword(body.current_password,body.password);
  if(path==='/api/account/profile'){
   const me=await identity();const result=await rpc('atry_profile',{name:body.name??me.user.name});
   if(body.email&&body.email.trim().toLowerCase()!==me.user.email.toLowerCase())return auth.changeEmail(body.email,body.current_password);return result;
  }
  if(path==='/api/organizations')return rpc('atry_create_organization',{payload:{...body,slug:slugify(body.slug||body.name)}});
  if(path==='/api/account/sessions')return rpc('atry_sessions');
  let match=path.match(/^\/api\/account\/sessions\/([A-Za-z0-9_-]+)$/);if(match&&method==='DELETE')return rpc('atry_revoke_session',{session_id:match[1]});
  match=path.match(/^\/api\/public\/([a-z0-9-]+)(?:\/(availability|book|waitlist))?$/);
  if(match)return publicCall(match[2]||'info',{slug:match[1],data:body,query:Object.fromEntries(url.searchParams)});
  match=path.match(/^\/api\/manage\/([A-Za-z0-9_-]+)(?:\/(availability|cancel|reschedule))?$/);
  if(match)return publicCall(match[2]==='availability'?'manage_availability':match[2]||'manage',{token:match[1],data:{...body,...Object.fromEntries(url.searchParams)}});
  match=path.match(/^\/api\/offers\/([A-Za-z0-9_-]+)(?:\/(accept))?$/);if(match)return publicCall(match[2]?'accept_offer':'offer',{token:match[1],data:body});
  match=path.match(/^\/api\/invitations\/([A-Za-z0-9_-]+)(?:\/(accept))?$/);
  if(match){if(!match[2])return publicCall('invitation',{token:match[1]});return rpc('atry_accept_invitation',{token:match[1]});}
  if(path==='/api/admin/commercial')return method==='GET'?rpc('atry_admin_commercial'):rpc('atry_admin_save_commercial',{payload:body});
  const requestState=path.match(/^\/api\/admin\/plan-requests\/([A-Za-z0-9_-]+)$/);if(requestState)return rpc('atry_admin_request_state',{request_id:requestState[1],state:body.state});
  const adminReads={'/api/admin/businesses':'atry_admin_businesses','/api/admin/plans':'atry_admin_plans','/api/admin/operations':'atry_admin_operations','/api/admin/diagnostics':'atry_admin_diagnostics','/api/admin/incidents':'atry_admin_incidents'};
  if(method==='GET'&&adminReads[path])return rpc(adminReads[path]);
  match=path.match(/^\/api\/admin\/(businesses|plans|incidents)\/([A-Za-z0-9_-]+)$/);
  if(match&&method==='PATCH')return rpc(match[1]==='businesses'?'atry_admin_save_business':match[1]==='plans'?'atry_admin_save_plan':'atry_admin_save_incident',match[1]==='businesses'?{bid:match[2],payload:body}:match[1]==='plans'?{code:match[2],payload:body}:{incident_id:match[2],state:body.state});
  match=path.match(/^\/api\/business\/([A-Za-z0-9_-]+)(.*)$/);
  if(match){
   const bid=match[1],tail=match[2];
   if(tail==='')return method==='GET'?rpc('atry_business',{bid}):rpc('atry_save_business',{bid,payload:body});
   if(tail==='/subscription')return rpc('atry_subscription',{bid});
   if(tail==='/statistics')return rpc('atry_statistics',{bid});
   if(tail==='/plan-requests')return rpc('atry_request_plan',{bid,payload:body});
   const planRequest=tail.match(/^\/plan-requests\/([A-Za-z0-9_-]+)$/);if(planRequest)return rpc('atry_cancel_plan_request',{bid,request_id:planRequest[1]});
   if(tail==='/recurring')return method==='GET'?rpc('atry_recurring',{bid}):rpc('atry_create_recurring',{bid,payload:body});
   const fixed=tail.match(/^\/recurring\/([A-Za-z0-9_-]+)\/end$/);if(fixed&&method==='POST')return rpc('atry_end_recurring',{bid,recurring_id:fixed[1],from_day:body.from_day});
   if(tail==='/services'&&method==='GET')return (await catalog(bid)).services;
   if(tail==='/staff'&&method==='GET')return (await catalog(bid)).staff;
   let resource=tail.match(/^\/(services|staff)(?:\/([A-Za-z0-9_-]+))?$/);
   if(resource&&['POST','PATCH'].includes(method))return rpc(resource[1]==='services'?'atry_save_service':'atry_save_staff',{bid,[resource[1]==='services'?'service_id':'staff_id']:resource[2]||null,payload:body});
   resource=tail.match(/^\/staff\/([A-Za-z0-9_-]+)\/hours$/);
   if(resource)return method==='GET'?(await rpc('atry_rules',{bid})).hours.filter(x=>x.staff_id===resource[1]):rpc('atry_save_rule',{bid,kind:'hours',rule_id:null,payload:{staff_id:resource[1],hours:body.hours},remove:false});
   resource=tail.match(/^\/services\/([A-Za-z0-9_-]+)\/resources$/);
   if(resource)return rpc('atry_save_rule',{bid,kind:'service_resources',rule_id:null,payload:{service_id:resource[1],resource_ids:body.resource_ids},remove:false});
   if(tail==='/scheduling'){
    const rules=await rpc('atry_rules',{bid});return {...rules,assignments:rules.service_resources,resources:rules.resources.map(r=>({...r,service_count:rules.service_resources.filter(a=>a.resource_id===r.id).length}))};
   }
   if(tail==='/time-off'&&method==='GET'){const [rules,people]=await Promise.all([rpc('atry_rules',{bid}),catalog(bid)]);return rules.time_off.map(t=>({...t,staff_name:people.staff.find(s=>s.id===t.staff_id)?.name||''}));}
   resource=tail.match(/^\/(breaks|exceptions|holidays|resources|time-off)(?:\/([A-Za-z0-9_-]+))?$/);
   if(resource){const payload={...body};if(payload.start){payload.start_min=minutes(payload.start);delete payload.start;}if(payload.end){payload.end_min=minutes(payload.end);delete payload.end;}return rpc('atry_save_rule',{bid,kind:resource[1]==='time-off'?'time_off':resource[1],rule_id:resource[2]||null,payload,remove:method==='DELETE'});}
   if(tail==='/bookings'&&method==='GET')return rpc('atry_bookings',{bid,start_day:url.searchParams.get('date'),days:Number(url.searchParams.get('days')||1)});
   if(tail==='/bookings'&&method==='POST')return rpc('atry_create_booking',{bid,payload:body});
   resource=tail.match(/^\/bookings\/([A-Za-z0-9_-]+)$/);if(resource&&method==='PATCH')return rpc('atry_update_booking',{bid,booking_id:resource[1],patch:body});
   if(tail==='/waitlist'&&method==='GET')return rpc('atry_waitlist',{bid});resource=tail.match(/^\/waitlist\/([A-Za-z0-9_-]+)$/);if(resource)return rpc('atry_update_waitlist',{bid,waitlist_id:resource[1],status:body.status});
   if(tail==='/customers'&&method==='POST')return rpc('atry_save_customer',{bid,customer_id:null,payload:{...body,marketing_consent:Number(!!body.marketing_consent)}});
   if(tail==='/customers'&&method==='GET')return rpc('atry_customers',{bid,query:url.searchParams.get('q')||''});
   resource=tail.match(/^\/customers\/([A-Za-z0-9_-]+)(?:\/(history))?$/);if(resource)return resource[2]?rpc('atry_customer_history',{bid,customer_id:resource[1]}):rpc('atry_save_customer',{bid,customer_id:resource[1],payload:{...body,...('marketing_consent'in body?{marketing_consent:Number(!!body.marketing_consent)}:{})}});
   if(tail==='/members'&&method==='POST')return rpc('atry_add_member',{bid,payload:body});
   if(method==='GET'&&(tail==='/members'||tail==='/invitations'))return (await rpc('atry_access',{bid}))[tail.slice(1)];
   if(tail==='/invitations'&&method==='POST')return rpc('atry_invite',{bid,payload:body});
   resource=tail.match(/^\/invitations\/([A-Za-z0-9_-]+)$/);if(resource&&method==='DELETE')return rpc('atry_revoke_invitation',{bid,invitation_id:resource[1]});
   resource=tail.match(/^\/members\/([A-Za-z0-9_-]+)$/);if(resource)return rpc('atry_update_member',{bid,member_id:resource[1],patch:{...body,...('staff_id'in body?{staff_id:body.staff_id||null}:{})},remove:method==='DELETE'});
   if(tail==='/notification-preferences')return method==='GET'?rpc('atry_notification_preferences',{bid}):rpc('atry_save_notification_preferences',{bid,payload:body});
   if(tail==='/smartslots')return rpc('atry_smartslots',{bid,day:url.searchParams.get('date')});
   if(tail==='/export/bookings')return exportCsv(bid);
   if(tail==='/incidents')return method==='GET'?rpc('atry_incidents',{bid}):rpc('atry_create_incident',{bid,subject:body.subject});
   const reads={'/dashboard':'atry_dashboard','/insights':'atry_insights','/entitlements':'atry_entitlements','/mail-jobs':'atry_mail_jobs','/notifications':'atry_notifications','/audit':'atry_audit'};
   if(method==='GET'&&reads[tail])return rpc(reads[tail],{bid});
  }
  throw fail(404,'Operación no disponible en esta versión online.');
 }};
}
export {slugify};
