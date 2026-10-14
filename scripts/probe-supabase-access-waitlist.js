'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),{createClient}=require('@supabase/supabase-js');
async function main(){
 const file=process.argv[2],phase=process.argv[3];if(!/^data\/cloud-private\/modules-[a-f0-9-]+\.json$/.test(file||'')||!['prepare','verify'].includes(phase))throw new Error('SCOPED_MANIFEST_AND_PHASE_REQUIRED');
 const m=JSON.parse(fs.readFileSync(file,'utf8')),config=JSON.parse(fs.readFileSync('data/cloud-private/connection.json','utf8'));
 if(m.project!=='djoxdtloqwbrhgtgencc'||config.url!=='https://djoxdtloqwbrhgtgencc.supabase.co')throw new Error('TARGET_MISMATCH');
 const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}},admin=createClient(config.url,config.serverKey,options),clients=[];
 const call=async(c,name,args)=>{const r=await c.rpc(name,args);if(r.error)throw new Error(name+':'+r.error.code+':'+r.error.message.replace(/[^A-Z0-9_]/g,'').slice(0,60));return r.data;};
 for(const u of m.users){const c=createClient(config.url,config.publicKey,options);if((await c.auth.signInWithPassword({email:u.email,password:u.password})).error)throw new Error('LOGIN_FAILED');clients.push(c);}
 const owner=clients[0],bid=m.businesses[0],biz=await call(owner,'atry_business',{bid});
 if(phase==='prepare'){
  if(m.accessWaitlist)throw new Error('PHASE_ALREADY_PREPARED');
  const catalog=await call(owner,'atry_catalog',{bid}),service=catalog.services.find(s=>s.name==='Servicio 1'),staff=catalog.staff.find(s=>s.service_ids.includes(service.id)),day=new Date(Date.now()+13*86400000).toISOString().slice(0,10);
  const available=await call(admin,'atry_public_availability',{slug:biz.slug,service_id:service.id,day,staff_id:staff.id});assert.ok(available.slots.length);
  const booking=await call(owner,'atry_create_booking',{bid,payload:{service_id:service.id,staff_id:staff.id,starts_at:available.slots[0].start,customer_name:'Cliente 6',customer_email:'cliente6@example.com',idempotency_key:m.run+'-wait-original'}});m.bookings.push(booking.id);fs.writeFileSync(file,JSON.stringify(m,null,2));
  const waiting=await call(admin,'atry_public_waitlist',{slug:biz.slug,payload:{service_id:service.id,staff_id:staff.id,desired_date:day,customer_name:'Cliente 7',customer_email:'cliente7@example.com',accept_policy:true,idempotency_key:m.run+'-waitlist'}});
  await call(owner,'atry_update_booking',{bid,booking_id:booking.id,patch:{status:'cancelled'}});
  const invitation=await call(owner,'atry_invite',{bid,payload:{email:m.users[1].email,role:'manager'}});
  m.accessWaitlist={waitlist:waiting.id,invitation:invitation.id};fs.writeFileSync(file,JSON.stringify(m,null,2));
  const uuid=/^[a-f0-9-]{36}$/;for(const value of [bid,waiting.id,invitation.id])if(!uuid.test(value))throw new Error('UNEXPECTED_ID');
  fs.writeFileSync('tmp/test-link-inspection.sql',`SELECT jsonb_build_object('invitation_token',(SELECT t.token FROM private.invitation_tokens t JOIN public.invitations i ON i.id=t.invitation_id WHERE i.id='${invitation.id}' AND i.business_id='${bid}'),'offer_token',(SELECT t.token FROM private.offer_tokens t JOIN public.waitlist w ON w.id=t.waitlist_id WHERE w.id='${waiting.id}' AND w.business_id='${bid}')) AS fixture_links;`);
  console.log('Fixtures preparados. La lectura de enlaces se limita a esta ejecución.');return;
 }
 const tokens=JSON.parse(fs.readFileSync('data/cloud-private/test-links-'+m.run+'.json','utf8'));assert.ok(tokens.invitation_token);assert.ok(tokens.offer_token);
 const wrong=await clients[2].rpc('atry_accept_invitation',{token:tokens.invitation_token});assert.equal(wrong.error?.message,'WRONG_ACCOUNT');
 await call(clients[1],'atry_accept_invitation',{token:tokens.invitation_token});assert.ok(await call(clients[1],'atry_customers',{bid,query:''}));
 const repeated=await clients[1].rpc('atry_accept_invitation',{token:tokens.invitation_token});assert.ok(repeated.error);
 await call(owner,'atry_update_member',{bid,member_id:m.users[1].id,patch:{},remove:true});assert.equal((await clients[1].rpc('atry_customers',{bid,query:''})).error?.code,'42501');
 await call(admin,'atry_offer',{token:tokens.offer_token});const payload={accept_policy:true,idempotency_key:m.run+'-offer'};
 const accepted=await call(admin,'atry_accept_offer',{token:tokens.offer_token,payload}),again=await call(admin,'atry_accept_offer',{token:tokens.offer_token,payload});assert.equal(accepted.id,again.id);
 const all=await call(owner,'atry_bookings',{bid,start_day:new Date().toISOString().slice(0,10),days:42});m.bookings=[...new Set(all.map(b=>b.id))];
 m.checks.push('Invitación real: correo verificado correcto, rechazo de otra cuenta, uso único y revocación efectiva','Espera real: cancelación genera oferta; aceptación e idempotencia sin duplicar');fs.writeFileSync(file,JSON.stringify(m,null,2));console.log(JSON.stringify({result:'passed',bookings:m.bookings.length,privateLinksPrinted:false}));
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
