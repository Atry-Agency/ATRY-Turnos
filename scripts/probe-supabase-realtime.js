'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),{createClient}=require('@supabase/supabase-js');
async function main(){
 const file=process.argv[2];if(!/^data\/cloud-private\/modules-[a-f0-9-]+\.json$/.test(file||''))throw new Error('FIXTURE_MANIFEST_REQUIRED');
 const manifest=JSON.parse(fs.readFileSync(file,'utf8')),config=JSON.parse(fs.readFileSync('data/cloud-private/connection.json','utf8'));
 if(manifest.project!=='djoxdtloqwbrhgtgencc'||config.url!=='https://djoxdtloqwbrhgtgencc.supabase.co')throw new Error('TARGET_MISMATCH');
 const clients=[],channels=[];let ownEvents=0,crossEvents=0;
 try{
  for(const user of manifest.users.slice(0,2)){const client=createClient(config.url,config.publicKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});const signed=await client.auth.signInWithPassword({email:user.email,password:user.password});if(signed.error)throw new Error('LOGIN_FAILED');await client.realtime.setAuth(signed.data.session.access_token);clients.push(client);}
  for(let i=0;i<2;i++)await new Promise((resolve,reject)=>{
   const timeout=setTimeout(()=>reject(new Error('REALTIME_SUBSCRIBE_TIMEOUT')),15000);
   const channel=clients[i].channel('test-calendar-'+manifest.run+'-'+i).on('system',{},event=>console.log(JSON.stringify({client:i,extension:event.extension,status:event.status,message:event.message}))).on('postgres_changes',{event:'*',schema:'public',table:'calendar_revisions',filter:'business_id=eq.'+manifest.businesses[0]},()=>{i===0?ownEvents++:crossEvents++;}).subscribe(status=>{if(status==='SUBSCRIBED'){clearTimeout(timeout);resolve();}if(['CHANNEL_ERROR','TIMED_OUT'].includes(status)){clearTimeout(timeout);reject(new Error('REALTIME_'+status));}});channels.push(channel);
  });
  const bid=manifest.businesses[0],catalog=await clients[0].rpc('atry_catalog',{bid});if(catalog.error)throw new Error('CATALOG_FAILED');
  const updated=await clients[0].rpc('atry_save_staff',{bid,staff_id:catalog.data.staff[0].id,payload:{name:'Usuario Prueba 1'}});if(updated.error)throw new Error('UPDATE_FAILED');
  const deadline=Date.now()+15000;while(!ownEvents&&Date.now()<deadline)await new Promise(resolve=>setTimeout(resolve,250));
  assert.ok(ownEvents>0,'No llegó una revisión real');await new Promise(resolve=>setTimeout(resolve,1500));assert.equal(crossEvents,0,'Realtime expuso otra organización');
  manifest.checks.push('Realtime remoto: revisión recibida por su negocio, sin eventos en la otra organización');fs.writeFileSync(file,JSON.stringify(manifest,null,2));console.log(JSON.stringify({result:'passed',ownEvents,crossEvents}));
 }finally{await Promise.all(clients.map(client=>client.removeAllChannels()));}
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
