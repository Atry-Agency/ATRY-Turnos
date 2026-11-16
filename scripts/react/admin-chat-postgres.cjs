'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {createAdminChatPreview}=require('./admin-chat-preview.cjs');
(async()=>{const temp=fs.mkdtempSync(path.join(os.tmpdir(),'atry-admin-chat-')),bundle=path.join(temp,'engine.cjs');require('esbuild').buildSync({entryPoints:['frontend/react/src/admin/chat-engine.ts'],outfile:bundle,bundle:true,platform:'node',format:'cjs'});const {AdminChatEngine}=require(bundle),server=await createAdminChatPreview(0);let writes=0,drop=false,failAudit=false;const identity=await(await fetch(server.base+'/api/auth/me')).json();const user=identity.user;console.log('TEST identity administrative',Boolean(user.platform_admin));const port={user:()=>user,session:()=>({userId:user.id,version:1}),async request(route,options={}){assert(route.startsWith('/api/admin/'));if(failAudit&&route.includes('/control/audit')){failAudit=false;throw Error('Lectura de auditoría interrumpida')}const response=await fetch(server.base+route,{method:options.method||'GET',headers:{'content-type':'application/json'},...(options.body?{body:options.body}:{})}),value=await response.json();if(options.method&&options.method!=='GET'){writes++;if(drop){drop=false;throw Error('Respuesta perdida después de guardar')}}if(!response.ok)throw Object.assign(Error(value.error||'Error local'),{status:response.status});return value}};const overview=await port.request('/api/admin/control/overview');const make=()=>new AdminChatEngine(port,{executionAllowed:()=>true,initial:()=>({administrator:true,section:'inicio',data:overview})});let checks=0;
async function ready(engine,id,target,values){await engine.start(id);if(engine.snapshot().phase==='choosing')await engine.choose([target]);for(let i=0;i<30&&engine.snapshot().phase==='collecting';i++){const f=engine.snapshot().field;if(!(f.key in values))throw Error('Falta prueba de campo '+f.key+' · '+id);await engine.answer(values[f.key]);}assert.equal(engine.snapshot().phase,'review',JSON.stringify(engine.snapshot().error));checks++;}
async function run(engine){const ticket=engine.snapshot().ticket;engine.arm(ticket,true,true);await engine.execute(ticket);if(engine.snapshot().phase!=='done')console.log('STATE',engine.snapshot().phase,engine.snapshot().error);assert.equal(engine.snapshot().phase,'done');checks++;}
try{
let e=make();await e.receive('Habilitá este negocio');assert.equal(e.snapshot().phase,'choosing');await e.choose(['chat-uy']);assert.equal(e.snapshot().field.key,'subscription_action');await e.receive('Hacele una prueba de catorce días gratis');assert.equal(e.snapshot().phase,'review',e.snapshot().error);assert.equal(e.snapshot().plans[0].payload.subscription_action,'trial');assert.equal(e.snapshot().plans[0].expected.plan,'trial');assert.equal('plan' in e.snapshot().plans[0].payload,false);const before=writes;await e.receive('confirmo');assert.equal(writes,before);const t=e.snapshot().ticket;e.arm(t,true,true);await Promise.all([e.execute(t),e.execute(t)]);assert.equal(writes,before+1);assert.equal(e.snapshot().phase,'done',e.snapshot().error);console.log('PASS PostgreSQL conversational trial14 + exact once + readback');checks+=6;
e=make();await ready(e,'subscription','chat-pa',{subscription_action:'trial',days:14});await e.receive('mejor 7 días');assert.equal(e.snapshot().values.days,7);assert.equal(e.snapshot().phase,'review');await run(e);checks++;
e=make();await ready(e,'subscription','chat-uy',{subscription_action:'cancel',note:'Baja ordinaria de prueba local'});await run(e);
e=make();await ready(e,'subscription','chat-uy',{subscription_action:'suspend',note:'Suspensión controlada local'});await run(e);
e=make();await ready(e,'subscription','chat-uy',{subscription_action:'restore',note:'Restablecimiento de prueba local'});await run(e);
e=make();await ready(e,'block_user','00000000-0000-0000-0000-000000000002',{blocked:true,reason:'Bloqueo ficticio solicitado por prueba'});await run(e);
e=make();await ready(e,'block_user','00000000-0000-0000-0000-000000000002',{blocked:false,reason:'Restablecimiento ficticio local'});await run(e);
e=make();await ready(e,'reservations','chat-uy',{scope:'public',reason:'Pausa controlada local sin reservas'});drop=true;const ticket=e.snapshot().ticket;e.arm(ticket,true,true);await e.execute(ticket);assert.equal(e.snapshot().phase,'uncertain');const n=writes;await e.execute(ticket);await e.checkResult();assert.equal(writes,n);assert.equal(e.snapshot().phase,'done',e.snapshot().error);checks+=3;
e=make();await ready(e,'business_mail','chat-uy',{paused:true,reason:'Pausa de correo ficticio local'});await run(e);
e=make();await ready(e,'global_mail','global',{paused:true,reason:'Pausa global solo de la base desechable'});await run(e);
e=make();await ready(e,'incident_create','chat-uy',{subject:'Ensayo de conversación administrativa',description:'Caso ficticio sin destinatarios ni mensajes',category:'service',priority:'normal',assignee:user.id,state:'open',reason:'Incidencia de homologación local'});await run(e);
e=make();await ready(e,'retention_policy','global',{days:90,reason:'Política ficticia para la base desechable'});await run(e);
e=make();await e.start('subscription');await e.choose(['chat-pa']);await e.answer('activate');assert.equal(e.snapshot().phase==='error'||e.snapshot().phase==='collecting',true);e.dispose();

// No stale proposal, ambiguous identity, role loss or transport failure may cause a replay.
e=make();await e.receive('Bloqueá ese');assert.notEqual(e.snapshot().phase,'review');const count0=writes;await e.execute(e.snapshot().ticket);assert.equal(writes,count0);checks+=2;
e=make();await ready(e,'business_mail','chat-uy',{paused:false,reason:'Cambio local de prueba de revisión'});await server.db.exec("RESET ROLE;UPDATE private.business_controls SET revision=revision+1 WHERE business_id='chat-uy';SET ROLE authenticated");const oldCount=writes;e.arm(e.snapshot().ticket,true,true);await e.execute(e.snapshot().ticket);assert.equal(writes,oldCount);assert.equal(e.snapshot().phase,'error');checks+=2;
e=make();await ready(e,'business_mail','chat-uy',{paused:false,reason:'Verificación con auditoría temporalmente caída'});failAudit=true;e.arm(e.snapshot().ticket,true,true);await e.execute(e.snapshot().ticket);assert.equal(e.snapshot().phase,'uncertain');const once=writes;await e.reviewAgain();await e.execute(e.snapshot().ticket);assert.equal(writes,once);await e.checkResult();assert.equal(e.snapshot().phase,'done');checks+=3;
e=make();await ready(e,'reservations','chat-uy',{scope:'none',reason:'Comprobar pérdida de rol antes de escribir'});const rolesBefore=writes;e.arm(e.snapshot().ticket,true,true);user.platform_admin=0;await e.execute(e.snapshot().ticket);assert.equal(writes,rolesBefore);assert.equal(e.snapshot().phase,'error');user.platform_admin=1;checks+=2;


const localToday=new Date(Date.now()-3*3600000).toISOString().slice(0,10);
e=make();await ready(e,'subscription','chat-uy',{subscription_action:'activate',days:30,plan:'negocio',starts_day:localToday,amount_uyu:1490,reference:'TRANSFERENCIA-LOCAL-FICTICIA',note:'Transferencia ficticia comprobada solo en la base local'});await run(e);
const paidBefore=(await port.request('/api/admin/control/business?business_id=chat-uy')).data.paid_until;
e=make();await ready(e,'subscription','chat-uy',{subscription_action:'renew',days:30,plan:'negocio',amount_uyu:0,note:'Renovación ficticia sin cobros ni banco'});await run(e);
const paidAfter=(await port.request('/api/admin/control/business?business_id=chat-uy')).data.paid_until;assert.equal(Date.parse(paidAfter)-Date.parse(paidBefore),30*86400000);checks++;
const payment=(await port.request('/api/admin/control/business?business_id=chat-uy')).data.license_history.find(p=>p.amount_uyu>0);
e=make();await ready(e,'verify_payment','chat-uy',{payment_id:payment.id,reason:'Verificación de transferencia ficticia, no consulta bancaria'});await run(e);

for(const [id,until] of [['chat-uy','2026-11-17'],['chat-pa','2026-11-16']]){const clocked=new AdminChatEngine(port,{executionAllowed:()=>false,initial:()=>({administrator:true,section:'inicio',data:overview}),clock:()=>new Date('2026-11-16T03:30:00Z')});await ready(clocked,'subscription',id,{subscription_action:'trial',days:14});await clocked.receive('hasta mañana');assert.equal(clocked.snapshot().plans[0].payload.until_day,until);checks++;clocked.dispose();}
// Remaining pre-existing command contracts, exclusively on disposable fixtures.
e=make();await ready(e,'plan','negocio',{change_field:'price_uyu',price_uyu:1490,reason:'Conservar precio comprobado en catálogo ficticio'});await run(e);
e=make();await ready(e,'commercial','global',{change_field:'whatsapp',whatsapp:'+59899000111',reason:'Contacto ficticio local del administrador'});await run(e);
await server.db.exec(`RESET ROLE;
INSERT INTO public.plan_requests(id,business_id,requested_by,plan,price_uyu,phone,request_key,request_hash) VALUES('chat-request','chat-uy','00000000-0000-0000-0000-000000000001','negocio',1490,'+59899000111','chat-request-key','fixture-hash');
INSERT INTO public.mail_jobs(id,dedupe_key,business_id,source,source_id,kind,recipient,subject,content,state,last_error,next_attempt_at,created_at,updated_at) VALUES('chat-mail-cancel','chat-mail-cancel','chat-uy','fixture','local','confirmation','fixture@example.invalid','Ficticio','Sin envío','queued',NULL,now(),now(),now()),('chat-mail-retry','chat-mail-retry','chat-uy','fixture','local','confirmation','fixture@example.invalid','Ficticio','Sin envío','failed','BREVO_HTTP_429',now(),now(),now());
SET ROLE authenticated;`);
e=make();await ready(e,'followup','chat-request',{note:'Seguimiento ficticio sin contacto real',next_contact:'',reason:'Registrar seguimiento local'});await run(e);
e=make();await ready(e,'request_state','chat-request',{state:'pending_payment',reason:'Estado comercial de prueba sin pago real'});await run(e);
e=make();await ready(e,'mail_cancel','chat-mail-cancel',{reason:'Cancelar solamente trabajo ficticio local'});await run(e);
e=make();await ready(e,'mail_retry','chat-mail-retry',{reason:'Fallo ficticio corregido, sin trabajador de envíos'});await run(e);
e=make();await ready(e,'deletion_request','00000000-0000-0000-0000-000000000002',{kind:'anonymize',reason:'Solicitud ficticia para revisión, no eliminar'});await run(e);
e=make();await ready(e,'business_deletion_request','chat-pa',{kind:'delete',reason:'Solicitud ficticia de revisión de negocio'});await run(e);
const incident=(await port.request('/api/admin/control/incidents')).rows.find(i=>i.business_id==='chat-uy');
e=make();await ready(e,'incident',incident.id,{state:'resolved',priority:'normal',resolution:'Caso ficticio verificado en la base local',reason:'Cierre de incidencia de prueba'});await run(e);
e=make();await ready(e,'revoke_sessions','00000000-0000-0000-0000-000000000002',{reason:'Revocar sesiones ficticias de la prueba'});await run(e);

await server.db.exec(`RESET ROLE;INSERT INTO public.memberships VALUES('00000000-0000-0000-0000-000000000002','chat-uy','manager');
INSERT INTO businesses SELECT (jsonb_populate_record(NULL::businesses,to_jsonb(b)||jsonb_build_object('id','chat-delete','name','Ficticio para eliminar','slug','chat-delete'))).* FROM businesses b WHERE id='b1';
INSERT INTO memberships VALUES('00000000-0000-0000-0000-000000000001','chat-delete','owner');SET ROLE authenticated;`);
e=make();await ready(e,'remove_membership','00000000-0000-0000-0000-000000000002',{business_id:'chat-uy',reason:'Retirar membresía de fixture sin tocar otro negocio'});await run(e);
e=make();await ready(e,'mail_archive','global',{reason:'Archivar solo contenido ficticio de la base local'});await run(e);
e=make();await ready(e,'business_delete','chat-delete',{confirm_slug:'chat-delete',reason:'Eliminar exclusivamente negocio ficticio desechable'});await run(e);
const signatures=(await server.db.query("select p.proname, md5(pg_get_functiondef(p.oid)) hash from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('atry_control_read','atry_control_command','atry_admin_save_business','atry_admin_save_plan','atry_admin_save_commercial','atry_admin_report_incident','atry_delete_business') order by p.proname")).rows;console.log('Local RPC signatures',JSON.stringify(signatures));
// The additive regional view exposes no private relation privileges to authenticated users.
await server.db.exec("RESET ROLE;SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000002';SET ROLE authenticated");
await assert.rejects(server.db.query("SELECT public.atry_control_read('business','{\"business_id\":\"chat-pa\"}')"));
await assert.rejects(server.db.query("SELECT * FROM private.control_businesses"));checks+=2;
await server.db.exec("RESET ROLE;SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';SET ROLE authenticated");
console.log('PASS admin chat PostgreSQL:',checks,'focused checks,',writes,'local writes; real current RPC/cloud adapter; no Supabase or mail delivery.');
}finally{await server.close();fs.rmSync(temp,{recursive:true,force:true})}})().catch(e=>{console.error(e.stack);process.exit(1)});
