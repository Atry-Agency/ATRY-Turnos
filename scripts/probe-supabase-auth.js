'use strict';
const fs=require('node:fs'),crypto=require('node:crypto'),assert=require('node:assert/strict'),{createClient}=require('@supabase/supabase-js');
async function main(){
 if(!process.argv.includes('--run'))throw new Error('Usar --run para crear fixtures temporales de integración');
 const config=JSON.parse(fs.readFileSync('data/cloud-private/connection.json','utf8'));
 if(config.url!=='https://djoxdtloqwbrhgtgencc.supabase.co')throw new Error('TARGET_MISMATCH');
 const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}},admin=createClient(config.url,config.serverKey,options);
 const run=crypto.randomUUID(),manifest={run,project:'djoxdtloqwbrhgtgencc',users:[],businesses:[],checks:[]};
 const file='data/cloud-private/integration-'+run+'.json';
 const save=()=>fs.writeFileSync(file,JSON.stringify(manifest,null,2));save();
 const fail=error=>{if(error)throw new Error('SUPABASE_ERROR_'+(error.code||error.status||'UNKNOWN'));};
 try{
  const clients=[];
  for(let i=1;i<=2;i++){
   const email=`prueba${i}.${run}@example.com`,password=crypto.randomBytes(32).toString('base64url');
   const created=await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{name:'Usuario Prueba '+i,atry_test_run:run,platform_admin:1,role:'owner'}});fail(created.error);
   manifest.users.push({id:created.data.user.id,email,password});save();
   const client=createClient(config.url,config.publicKey,options);const signed=await client.auth.signInWithPassword({email,password});fail(signed.error);clients.push(client);
   const me=await client.rpc('atry_me');fail(me.error);assert.equal(me.data.user.platform_admin,0);assert.equal(me.data.businesses.length,0);
   const org=await client.rpc('atry_create_organization',{payload:{name:'Negocio Prueba '+i,slug:'negocio-prueba-'+run.slice(0,12)+'-'+i}});fail(org.error);manifest.businesses.push(org.data.id);save();
  }
  manifest.checks.push('registro Auth de prueba y login con contraseña real','metadatos no otorgan administración','organizaciones propias creadas mediante RPC');
  const own=await clients[0].from('businesses').select('id');fail(own.error);assert.deepEqual(own.data.map(x=>x.id),[manifest.businesses[0]]);
  const crossed=await clients[0].rpc('atry_catalog',{bid:manifest.businesses[1]});assert.equal(crossed.error?.code,'42501');manifest.checks.push('RLS de lectura y RPC aíslan organizaciones con JWT reales');
  const sessions=await clients[0].rpc('atry_sessions');fail(sessions.error);const current=sessions.data.find(s=>s.current);assert.ok(current);
  const revoked=await clients[0].rpc('atry_revoke_session',{session_id:current.id});fail(revoked.error);
  const after=await clients[0].rpc('atry_me');fail(after.error);assert.equal(after.data.user,null);
  const denied=await clients[0].from('businesses').select('id');fail(denied.error);assert.deepEqual(denied.data,[]);
  const unaffected=await clients[1].rpc('atry_me');fail(unaffected.error);assert.equal(unaffected.data.businesses.length,1);manifest.checks.push('revocación inmediata bloquea JWT previo y no afecta otra cuenta');
  manifest.result='passed';save();console.log(JSON.stringify({project:manifest.project,result:manifest.result,checks:manifest.checks,fixturesPendingCleanup:manifest.users.length,manifest:file}));
 }catch(e){manifest.result='failed';save();throw e;}
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
