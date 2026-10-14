'use strict';
const fs=require('node:fs'),crypto=require('node:crypto'),assert=require('node:assert/strict'),{createClient}=require('@supabase/supabase-js');
async function main(){
 const file=process.argv[2];if(!/^data\/cloud-private\/modules-[a-f0-9-]+\.json$/.test(file||''))throw new Error('FIXTURE_MANIFEST_REQUIRED');
 const manifest=JSON.parse(fs.readFileSync(file,'utf8')),config=JSON.parse(fs.readFileSync('data/cloud-private/connection.json','utf8'));
 if(manifest.project!=='djoxdtloqwbrhgtgencc'||config.url!=='https://djoxdtloqwbrhgtgencc.supabase.co')throw new Error('TARGET_MISMATCH');
 const {findProof}=await import('../cloud/proof-work.mjs'),client=createClient(config.url,config.publicKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
 const user=manifest.users[0];if((await client.auth.signInWithPassword({email:user.email,password:user.password})).error)throw new Error('LOGIN_FAILED');
 const business=await client.rpc('atry_business',{bid:manifest.businesses[0]});if(business.error)throw new Error('BUSINESS_FAILED');const slug=business.data.slug,origin='https://atry-agency.github.io';
 const edge=async(operation,{data,query={},customOrigin=origin}={})=>{
  const url=new URL(config.url+'/functions/v1/atry-public');url.searchParams.set('operation',operation);url.searchParams.set('slug',slug);for(const [key,value] of Object.entries(query))url.searchParams.set(key,value);
  const response=await fetch(url,{method:data?'POST':'GET',headers:{origin:customOrigin,apikey:config.publicKey,...(data?{'content-type':'application/json'}:{})},body:data?JSON.stringify(data):undefined,signal:AbortSignal.timeout(25000)});return {status:response.status,data:await response.json()};
 };
 const info=await edge('info');assert.equal(info.status,200,info.data.error);assert.equal(info.data.business.id,manifest.businesses[0]);assert.equal((await edge('info',{customOrigin:'https://wrong.example'})).status,403);
 const service=info.data.services.find(s=>s.name==='Servicio 1'),staff=info.data.staff.find(s=>s.service_ids.includes(service.id));assert.ok(staff);
 const day=new Date(Date.now()+10*86400000).toISOString().slice(0,10),availability=await edge('availability',{query:{date:day,service_id:service.id,staff_id:staff.id}});assert.equal(availability.status,200);assert.ok(availability.data.slots.length>=5);
 const starts=availability.data.slots[0].start,common={staff_id:staff.id,service_id:service.id,starts_at:starts,customer_name:'Cliente 4',customer_email:'cliente4@example.com',accept_policy:true};
 const requests=[],attempt=crypto.randomUUID().slice(0,12);
 for(let i=0;i<2;i++){const key=manifest.run+'-'+attempt+'-edge-'+i,ticket=await edge('challenge',{data:{action:'booking',key}});assert.equal(ticket.status,200,ticket.data.error);requests.push({...common,idempotency_key:key,proof_challenge:ticket.data.challenge,proof_counter:await findProof(ticket.data.challenge,ticket.data.bits)});}
 const outcomes=await Promise.all(requests.map(data=>edge('book',{data})));for(const outcome of outcomes)if(outcome.data.id)manifest.bookings.push(outcome.data.id);manifest.bookings=[...new Set(manifest.bookings)];fs.writeFileSync(file,JSON.stringify(manifest,null,2));
 const summary=JSON.stringify(outcomes.map(r=>({status:r.status,error:r.data.error})));assert.equal(outcomes.filter(r=>r.status===200).length,1,summary);assert.equal(outcomes.filter(r=>r.status===409).length,1,summary);assert.ok(['CONFLICT','BOOKING_CONFLICT','RESOURCE_CONFLICT'].includes(outcomes.find(r=>r.status===409).data.error),summary);
 const winner=outcomes.find(r=>r.status===200).data;
 const winningRequest=requests[outcomes.findIndex(r=>r.status===200)],repeat=await edge('book',{data:winningRequest});assert.equal(repeat.status,200);assert.equal(repeat.data.id,winner.id);
 const management=await edge('manage',{data:{token:winner.manage_token}});assert.equal(management.status,200);assert.ok(!('customer_email'in management.data));
 const target=availability.data.slots.find(s=>new Date(s.start)-new Date(starts)>=3600000);assert.ok(target);
 const moved=await edge('reschedule',{data:{token:winner.manage_token,starts_at:target.start}});assert.equal(moved.status,200,moved.data.error);
 for(let i=0;i<2;i++){const cancelled=await edge('cancel',{data:{token:winner.manage_token}});assert.equal(cancelled.status,200);assert.equal(cancelled.data.status,'cancelled');}
 manifest.checks.push('Edge pública real: origen, desafío firmado, concurrencia, idempotencia, gestión privada, reprogramación y cancelación repetida aprobados');fs.writeFileSync(file,JSON.stringify(manifest,null,2));console.log(JSON.stringify({result:'passed',checks:'public-edge-complete',fixturesPendingCleanup:true}));
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
