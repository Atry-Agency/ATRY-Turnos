'use strict';
// Test harness only: the existing cloud adapter talks to disposable PostgreSQL (PGlite).
// No external transport, real credentials, persistent data, email worker or Supabase connection.
const fs=require('node:fs'),http=require('node:http'),path=require('node:path'),{pg}=require('../../tests/pg-context');
async function createPreview(port=3354,options={}){const db=await pg();try{
await db.exec(fs.readFileSync('tests/postgres.test.js','utf8').split('async function fixture(db){await db.exec(`')[1].split('`);}')[0]);
await db.exec(`SET request.headers='{"x-client-info":"atry-turnos-regional/1"}'`);
// Explicit opt-in only inside the disposable regional fixture.
await db.exec("UPDATE private.runtime_settings SET pa_registration_enabled=true,pa_public_enabled=true WHERE id=1");
await db.exec(`UPDATE businesses SET name='ATRY · Uruguay local',plan='negocio',onboarding_completed=1 WHERE id='b1';UPDATE services SET name='Corte de pelo',price_uyu=790 WHERE id='v1';UPDATE staff SET name='Lucía' WHERE id='s1';INSERT INTO businesses SELECT (jsonb_populate_record(NULL::businesses,to_jsonb(b)||jsonb_build_object('id','pa','name','ATRY · Panamá local','slug','panama-local','country','PA','timezone','America/Panama','currency','USD','locale','es-PA','city','Ciudad de Panamá','plan','pro','onboarding_completed',1))).* FROM businesses b WHERE id='b2';INSERT INTO memberships VALUES('00000000-0000-0000-0000-000000000001','pa','owner');INSERT INTO staff(id,business_id,name,created_at) VALUES('ps','pa','Lucía',now());INSERT INTO services(id,business_id,name,duration_min,price_minor,created_at) VALUES('pv','pa','Corte de pelo',30,1299,now());INSERT INTO staff_services VALUES('ps','pv');INSERT INTO working_hours SELECT 'ps',d,540,1080 FROM generate_series(0,6)d;SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';SET request.jwt.claims='{"session_id":"00000000-0000-0000-0000-000000000001"}';SET ROLE authenticated;`);
if(options.adminChat){await db.exec(`RESET ROLE;
UPDATE public.users SET platform_admin=1 WHERE auth_user_id='00000000-0000-0000-0000-000000000001';
INSERT INTO businesses SELECT (jsonb_populate_record(NULL::businesses,to_jsonb(b)||jsonb_build_object('id','chat-uy','name','ATRY · Ensayo Uruguay','slug','chat-uruguay','onboarding_completed',1))).* FROM businesses b WHERE id='b1';
INSERT INTO businesses SELECT (jsonb_populate_record(NULL::businesses,to_jsonb(b)||jsonb_build_object('id','chat-pa','name','ATRY · Ensayo Panamá','slug','chat-panama','plan','trial','onboarding_completed',1))).* FROM businesses b WHERE id='pa';
INSERT INTO staff(id,business_id,name,created_at) VALUES('chat-uy-staff','chat-uy','Lucía Uruguay',now()),('chat-pa-staff','chat-pa','Lucía Panamá',now());
INSERT INTO memberships VALUES('00000000-0000-0000-0000-000000000001','chat-uy','owner'),('00000000-0000-0000-0000-000000000001','chat-pa','owner');
UPDATE businesses SET subscription_status='pending',paid_until=NULL,is_active=0,subscription_started_at=NULL WHERE id IN ('chat-uy','chat-pa');
SET ROLE authenticated;`)}
if(options.finance){
 // Fictional reservations only; no financial records, automatic payments or deliveries.
 for(const [bid,sid,vid,zone] of [['b1','s1','v1','America/Montevideo'],['pa','ps','pv','America/Panama']]){
  for(const [i,name]of ['Camila Duarte','Diego Santos','Valentina Pérez'].entries()){
   const start=(await db.query("SELECT (((now() AT TIME ZONE $1)::date+1)+make_time(10+$2::int,0,0)) AT TIME ZONE $1 t",[zone,i])).rows[0].t;
   await db.query('SELECT public.atry_create_booking($1,$2::jsonb)',[bid,JSON.stringify({staff_id:sid,service_id:vid,starts_at:start,customer_name:name,customer_email:'finanzas-'+bid+'-'+i+'@example.invalid',idempotency_key:'finance_preview_'+bid+'_booking_000'+i})]);
  }
 }
}
const {createApiAdapter}=await import(path.resolve(__dirname,'../../cloud/api-adapter.mjs'));
const client={auth:{getSession:async()=>({data:{session:{}}})},async rpc(name,args={}){try{if(!/^atry_[a-z_]+$/.test(name))throw Error('RPC not admitted');const pairs=Object.entries(args);if(pairs.some(([k])=>!/^[a-z_]+$/.test(k)))throw Error('Invalid RPC argument');return{data:(await db.query(`SELECT public.${name}(${pairs.map(([k],i)=>k+'=>$'+(i+1)).join(',')}) v`,pairs.map(([,v])=>v!==null&&typeof v==='object'?JSON.stringify(v):v))).rows[0].v}}catch(e){return{error:{message:e.message,code:e.code}}}}};
const {createPublicHandler}=await import(path.resolve(__dirname,'../../supabase/functions/_shared/public-gateway.mjs'));
const gateway=createPublicHandler({supabaseUrl:'https://regional-fixture.supabase.co',serviceKey:'local-test-fixture-not-a-real-key',siteUrl:'https://local-fixture.test',turnstileSecret:'local-test-only',fetchImpl:async(url,init)=>{
 if(String(url)==='https://challenges.cloudflare.com/turnstile/v0/siteverify')return new Response(JSON.stringify({success:true,hostname:'local-fixture.test',action:'booking',cdata:JSON.parse(globalFixtureBody||'{}').idempotency_key}),{status:200});
 const u=new URL(url);if(u.origin!=='https://regional-fixture.supabase.co'||!u.pathname.startsWith('/rest/v1/rpc/'))throw Error('External network forbidden');
 const value=await client.rpc(u.pathname.split('/').pop(),JSON.parse(init.body));return new Response(JSON.stringify(value.error||value.data),{status:value.error?400:200,headers:{'content-type':'application/json'}});
}});let globalFixtureBody='',fixtureVisitor='preview-local';
const localPublic=async(url,init)=>{globalFixtureBody=init.body||'';await db.exec('RESET ROLE;SET ROLE service_role');try{return await gateway(new Request(url,{...init,headers:{...init.headers,origin:'https://local-fixture.test','x-forwarded-for':fixtureVisitor}}))}finally{await db.exec('RESET ROLE;SET ROLE authenticated');globalFixtureBody=''}};
const adapter=createApiAdapter({auth:{client},config:{supabaseUrl:'https://regional-fixture.supabase.co',supabaseKey:'local-fixture'},fetchImpl:localPublic,protection:async()=>({turnstile_token:'local-fixture-only'})});let serial=Promise.resolve();const dist=path.resolve(__dirname,'../../frontend/react/dist'),web=path.resolve(__dirname,'../../web');
const server=http.createServer((req,res)=>{if(!/^127\.0\.0\.1(?::\d+)?$/.test(req.headers.host||'')){res.writeHead(403);res.end();return;}res.setHeader('Cache-Control','no-store');const url=new URL(req.url,'http://localhost');
if(url.pathname==='/runtime-config.js'){res.setHeader('Content-Type','text/javascript');res.end('window.ATRY_CONFIG={backend:"local",verificationOnly:true,phaseOneLocal:true,regionalBusinessContract:1,adminChatLocalValidation:'+Boolean(options.adminChat)+'};');return}
if(url.pathname==='/sw.js'){res.writeHead(404);res.end();return}
if(url.pathname.endsWith('/events')){res.writeHead(200,{'Content-Type':'text/event-stream','Connection':'keep-alive'});res.write(': PostgreSQL local fixture\n\n');return}
if(url.pathname.startsWith('/api/')){let body='';req.on('data',c=>{body+=c;if(body.length>65536)req.destroy()});req.on('end',()=>{serial=serial.then(async()=>{try{fixtureVisitor=String(req.headers['x-atry-local-fixture-id']||'preview-local').slice(0,80);const value=await adapter.request(req.url,{method:req.method,...(body?{body}:{})});res.setHeader('Content-Type',typeof value==='string'?'text/plain':'application/json');res.end(typeof value==='string'?value:JSON.stringify(value))}catch(e){res.writeHead(e.status||400,{'Content-Type':'application/json'});res.end(JSON.stringify({error:e.message}))}}).catch(()=>{});});return;}
const relative=decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname);let file=path.resolve(dist,'.'+relative);if(!file.startsWith(dist+path.sep)){res.writeHead(403);res.end();return;}if(!fs.existsSync(file)&&relative.startsWith('/assets/'))file=path.resolve(web,'.'+relative);if(!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end();return;}const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.jpg':'image/jpeg','.webp':'image/webp','.otf':'font/otf','.ttf':'font/ttf'};res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));});
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve)});return{db,base:'http://127.0.0.1:'+server.address().port,close:async()=>{server.closeAllConnections();await new Promise(r=>server.close(r));await db.close()}};
}catch(e){await db.close();throw e}}
module.exports={createPreview};if(require.main===module)createPreview(Number(process.env.ATRY_REGIONAL_PORT)||3354).then(s=>{console.log('LOCAL ONLY: '+s.base+'/#/app/inicio');console.log('Disposable PostgreSQL fixtures + existing cloud adapter. Switch Uruguay / Panamá in Espacio activo. No external requests or deliveries.');for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>void s.close().finally(()=>process.exit()))}).catch(e=>{console.error(e.message);process.exitCode=1});
