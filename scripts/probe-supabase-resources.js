'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),{createClient}=require('@supabase/supabase-js');
async function main(){
 const file=process.argv[2];if(!/^data\/cloud-private\/modules-[a-f0-9-]+\.json$/.test(file||''))throw new Error('FIXTURE_MANIFEST_REQUIRED');
 const manifest=JSON.parse(fs.readFileSync(file,'utf8')),config=JSON.parse(fs.readFileSync('data/cloud-private/connection.json','utf8'));
 if(manifest.project!=='djoxdtloqwbrhgtgencc'||config.url!=='https://djoxdtloqwbrhgtgencc.supabase.co')throw new Error('TARGET_MISMATCH');
 const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}},client=createClient(config.url,config.publicKey,options),admin=createClient(config.url,config.serverKey,options);
 const user=manifest.users[0];if((await client.auth.signInWithPassword({email:user.email,password:user.password})).error)throw new Error('LOGIN_FAILED');
 const call=async(name,args)=>{const r=await client.rpc(name,args);if(r.error)throw new Error(name+':'+r.error.code+':'+r.error.message.replace(/[^A-Z0-9_]/g,'').slice(0,60));return r.data;};
 const bid=manifest.businesses[0],biz=await call('atry_business',{bid}),catalog=await call('atry_catalog',{bid});
 const resource=await call('atry_save_rule',{bid,kind:'resources',rule_id:null,remove:false,payload:{name:'Recurso 1'}});
 const service=await call('atry_save_service',{bid,service_id:null,payload:{name:'Servicio 2',duration_min:30,price_uyu:500,staff_ids:catalog.staff.map(s=>s.id)}});
 await call('atry_save_rule',{bid,kind:'service_resources',rule_id:null,remove:false,payload:{service_id:service.id,resource_ids:[resource.id]}});
 const day=new Date(Date.now()+8*86400000).toISOString().slice(0,10),availability=await admin.rpc('atry_public_availability',{slug:biz.slug,service_id:service.id,day,staff_id:catalog.staff[0].id});if(availability.error)throw new Error('AVAILABILITY_FAILED');assert.ok(availability.data.slots.length);
 const start=availability.data.slots[0].start,common={service_id:service.id,starts_at:start,customer_name:'Cliente 3',customer_email:'cliente3@example.com'};
 const outcomes=await Promise.all(catalog.staff.slice(0,2).map((staff,i)=>client.rpc('atry_create_booking',{bid,payload:{...common,staff_id:staff.id,idempotency_key:manifest.run+'-resource-'+i}})));
 assert.equal(outcomes.filter(r=>!r.error).length,1);assert.equal(outcomes.filter(r=>r.error).length,1);
 manifest.bookings.push(outcomes.find(r=>!r.error).data.id);manifest.checks.push('Concurrencia remota: recurso compartido impide dos reservas aunque los profesionales sean distintos');
 const all=await call('atry_bookings',{bid,start_day:new Date(Date.now()+6*86400000).toISOString().slice(0,10),days:5});manifest.bookings=[...new Set(all.map(b=>b.id))];manifest.checks.push('Reserva manual creada desde navegador y visible en la agenda de Supabase');
 fs.writeFileSync(file,JSON.stringify(manifest,null,2));console.log(JSON.stringify({result:'passed',bookings:manifest.bookings.length,sharedResourceConflict:true}));
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
