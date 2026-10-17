'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {pg}=require('./pg-context');
const uid=n=>'66666666-6666-4666-8666-66666666666'+n;
async function who(db,n){await db.exec('RESET ROLE');await db.query("SELECT set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false)",[uid(n),JSON.stringify({session_id:uid(n)})]);await db.exec('SET ROLE authenticated');}
test('Apariencia: propietario guarda por negocio, empleado lee, terceros y valores maliciosos no cambian datos',async()=>{
 const db=await pg();try{
  for(const n of [1,2,3])await db.query('INSERT INTO auth.users(id,email,email_confirmed_at) VALUES($1,$2,now())',[uid(n),'appearance'+n+'@local.test']);
  await db.exec('INSERT INTO auth.sessions(id,user_id) SELECT id,id FROM auth.users');await who(db,1);
  const a=(await db.query('SELECT atry_create_organization($1::jsonb) v',[JSON.stringify({name:'Consultorio Uno',slug:'consultorio-uno'})])).rows[0].v.id;
  await who(db,2);const b=(await db.query('SELECT atry_create_organization($1::jsonb) v',[JSON.stringify({name:'Consultorio Dos',slug:'consultorio-dos'})])).rows[0].v.id;
  await db.exec('RESET ROLE');await db.query("INSERT INTO memberships(user_id,business_id,role) VALUES($1,$2,'staff')",[uid(3),a]);
  await who(db,1);const changed=(await db.query('SELECT atry_save_appearance($1,$2::jsonb) v',[a,JSON.stringify({primary_color:'#FDEDED',secondary_color:'#123456',appearance_mode:'dark'})])).rows[0].v;
  assert.equal(changed.primary_color,'#FDEDED');assert.equal(changed.secondary_color,'#123456');assert.equal(changed.appearance_mode,'dark');
  await assert.rejects(db.query('SELECT atry_save_appearance($1,$2::jsonb)',[a,JSON.stringify({primary_color:'red;--ink:black'})]),/INVALID_APPEARANCE/);
  await assert.rejects(db.query('SELECT atry_save_appearance($1,$2::jsonb)',[a,JSON.stringify({logo_url:'javascript:alert(1)'})]),/INVALID_APPEARANCE/);
  await who(db,2);await assert.rejects(db.query('SELECT atry_save_appearance($1,$2::jsonb)',[a,'{"appearance_mode":"light"}']),/FORBIDDEN/);
  assert.equal((await db.query('SELECT atry_business($1) v',[b])).rows[0].v.appearance_mode,'light');
  await who(db,3);assert.equal((await db.query('SELECT atry_business($1) v',[a])).rows[0].v.secondary_color,'#123456');await assert.rejects(db.query('SELECT atry_save_appearance($1,$2::jsonb)',[a,'{"appearance_mode":"light"}']),/FORBIDDEN/);
  await db.exec('RESET ROLE;SET ROLE service_role');const publicResult=(await db.query('SELECT atry_public_info($1) v',['consultorio-uno'])).rows[0].v,publicA=publicResult.business;assert.equal(publicA.secondary_color,'#123456');assert.equal(publicA.appearance_mode,'dark');assert.equal(publicA.email,undefined);assert.equal(typeof publicResult.waitlist_enabled,'boolean');
 }finally{await db.close();}
});
test('Apariencia: los colores extremos producen texto y acciones con contraste AA, y el tema anterior se limpia',()=>{
 const source=fs.readFileSync('web/appearance.js','utf8');const properties=new Map(),attrs={};const root={style:{setProperty:(k,v)=>properties.set(k,v),removeProperty:k=>properties.delete(k)},dataset:attrs,removeAttribute:k=>{if(k==='data-appearance')delete attrs.appearance;if(k==='data-appearance-mode')delete attrs.appearanceMode;}};
 const context={document:{documentElement:root,addEventListener(){}},console};vm.runInNewContext(source+';globalThis.appearance=ATRY_APPEARANCE;',context);const a=context.appearance;
 for(const color of ['#FFFFFF','#000000','#FFFF00','#00EFFF','#FF2D55'])for(const mode of ['light','dark']){const v=a.values({primary_color:color,appearance_mode:mode}),surface=mode==='dark'?'#151928':'#FFFFFF';assert.ok(a.contrast(v.action,surface)>=4.5,color+mode);assert.ok(a.contrast(v.onAction,v.action)>=4.5,color+mode);}
 a.apply({primary_color:'#000000',appearance_mode:'dark'},'business');assert.equal(attrs.appearanceMode,'dark');a.apply(null);assert.equal(attrs.appearance,undefined);assert.equal(properties.size,0);
});
test('Incidencia administrativa: sesión reciente, negocio real, idempotencia y auditoría',async()=>{
 const db=await pg();try{
  await db.query('INSERT INTO auth.users(id,email,email_confirmed_at) VALUES($1,$2,now())',[uid(1),'operator@local.test']);await db.query('INSERT INTO auth.sessions(id,user_id) VALUES($1,$1)',[uid(1)]);await who(db,1);
  const bid=(await db.query('SELECT atry_create_organization($1::jsonb) v',[JSON.stringify({name:'Negocio Incidente',slug:'negocio-incidente'})])).rows[0].v.id;
  await db.exec('RESET ROLE');await db.query('UPDATE users SET platform_admin=1 WHERE id=$1',[uid(1)]);await who(db,1);
  const payload={business_id:bid,subject:'No puedo acceder',description:'El cliente escribió por WhatsApp y recibe error al ingresar.',category:'access',priority:'high',state:'open',assignee:uid(1),reason:'Reporte recibido por WhatsApp',request_id:'incident_qatest_2026_001'};
  const send=p=>db.query('SELECT atry_admin_report_incident($1::jsonb) v',[JSON.stringify(p)]);
  const first=(await send(payload)).rows[0].v,again=(await send(payload)).rows[0].v;assert.equal(first.id,again.id);assert.equal(again.replayed,true);
  assert.equal((await db.query('SELECT count(*) n FROM incidents WHERE business_id=$1',[bid])).rows[0].n,1);
  await db.exec('RESET ROLE');assert.equal((await db.query("SELECT count(*) n FROM private.control_events WHERE action='incident_create' AND entity_id=$1",[first.id])).rows[0].n,1);await who(db,1);
  await assert.rejects(send({...payload,subject:'Texto distinto'}),/IDEMPOTENCY_MISMATCH/);
  await assert.rejects(send({...payload,request_id:'incident_qatest_2026_002',business_id:'missing'}),/NOT_FOUND/);
  await assert.rejects(send({...payload,request_id:'incident_qatest_2026_003',state:'resolved'}),/INVALID_INCIDENT/);
  const missingKey={...payload};delete missingKey.request_id;await assert.rejects(send(missingKey),/INVALID_INCIDENT/);
 }finally{await db.close();}
});
test('Servidor local: apariencia persistente en panel y reservas; registro de incidencia desde administración',async()=>{
 const {connect}=require('../server/db'),{seedDemo}=require('../server/seed'),{createApp}=require('../server/app');
 const db=connect(':memory:');seedDemo(db);const server=createApp({db}).createServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+server.address().port,bid=db.prepare('SELECT id FROM businesses LIMIT 1').get().id;
 async function request(route,body,cookie='',method=body?'POST':'GET'){const res=await fetch(base+route,{method,headers:{'Content-Type':'application/json',cookie},body:body?JSON.stringify(body):undefined});return {status:res.status,data:await res.json(),cookie:res.headers.get('set-cookie')};}
 try{
  for(const asset of ['/appearance.js','/appearance.css','/workspace.js','/workspace.css'])assert.equal((await fetch(base+asset)).status,200,asset+' debe servirse sin autenticación');
  const owner=(await request('/api/auth/login',{email:'usuario1@example.com',password:'AtryDemo2026!'})).cookie;
  const admin=(await request('/api/auth/login',{email:'admin.prueba@example.com',password:'AtryAdmin2026!'})).cookie;
  const route='/api/business/'+bid+'/appearance';const appearance={primary_color:'#111111',secondary_color:'#C79537',appearance_mode:'dark'};
  assert.equal((await request(route,appearance,admin,'PATCH')).status,403);
  assert.equal((await request(route,{primary_color:'--ink:red'},owner,'PATCH')).status,400);
  assert.equal((await request(route,appearance,owner,'PATCH')).status,200);
  assert.equal((await request('/api/business/'+bid,null,owner)).data.appearance_mode,'dark');
  assert.equal((await request('/api/public/negocio-prueba-1')).data.business.secondary_color,'#C79537');
  const incident={business_id:bid,subject:'Reporte por WhatsApp',description:'El negocio informa que no puede abrir la agenda.',category:'access',priority:'high',state:'open',reason:'Mensaje del propietario en WhatsApp',request_id:'incident_local_2026_001'};
  const created=await request('/api/admin/control/incident_create/new',incident,admin);assert.equal(created.status,200);assert.equal(created.data.after.state,'open');assert.equal((await request('/api/admin/control/incident_create/new',incident,admin)).data.replayed,true);
 }finally{await new Promise(resolve=>server.close(resolve));db.close();}
});
