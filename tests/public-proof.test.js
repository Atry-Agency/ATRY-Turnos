'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
test('Protección integrada: firma, vencimiento, IP, negocio, acción y nonce se validan en servidor',async()=>{
 const {createProof}=await import('../supabase/functions/_shared/proof.mjs'),{findProof}=await import('../cloud/proof-work.mjs');let now=1000000;
 const proof=createProof({secret:'unit-test-secret',now:()=>now}),binding={ip:'hashed-ip',action:'booking',key:'request_key_0001',slug:'negocio-prueba-1'},ticket=await proof.issue(binding),counter=await findProof(ticket.challenge,ticket.bits);
 assert.equal(await proof.verify(ticket.challenge,counter,binding),true);
 for(const field of ['ip','action','key','slug'])assert.equal(await proof.verify(ticket.challenge,counter,{...binding,[field]:'changed'}),false);
 assert.equal(await proof.verify(ticket.challenge+'x',counter,binding),false);assert.equal(await proof.verify(ticket.challenge,-1,binding),false);assert.equal(await proof.verify(ticket.challenge,1.5,binding),false);
 now+=180001;assert.equal(await proof.verify(ticket.challenge,counter,binding),false);
});
test('Edge integrada: desafío real protege la escritura sin contactar Cloudflare',async()=>{
 const {createPublicHandler}=await import('../supabase/functions/_shared/public-gateway.mjs'),{findProof}=await import('../cloud/proof-work.mjs');let booked=0;
 const origin='https://atry-agency.github.io',slug='negocio-prueba-1',key='public_request_00001';
 const handler=createPublicHandler({supabaseUrl:'https://project.supabase.co',serviceKey:'unit-test-private',siteUrl:origin+'/ATRY-Turnos/',protectionMode:'proof',fetchImpl:async(url,options)=>{
  assert.ok(!url.includes('cloudflare'));if(url.endsWith('atry_public_rate'))return Response.json(true);
  const data=JSON.parse(options.body).payload;assert.ok(!('proof_challenge'in data));assert.equal(data.idempotency_key,key);booked++;return Response.json({id:'booking-one'});
 }});
 const request=(operation,data,ip='203.0.113.1, 10.0.0.1')=>new Request('https://project.supabase.co/functions/v1/atry-public?operation='+operation+'&slug='+slug,{method:'POST',headers:{origin,'content-type':'application/json','x-forwarded-for':ip},body:JSON.stringify(data)});
 assert.equal((await handler(request('book',{idempotency_key:key,accept_policy:true}))).status,403);assert.equal(booked,0);
 const minted=await handler(request('challenge',{action:'booking',key}));assert.equal(minted.status,200);const ticket=await minted.json(),counter=await findProof(ticket.challenge,ticket.bits);
 const data={idempotency_key:key,accept_policy:true,proof_challenge:ticket.challenge,proof_counter:counter};
 assert.equal((await handler(request('book',data,'203.0.113.2, 10.0.0.2'))).status,403);
 const result=await handler(request('book',data,'203.0.113.1, 10.0.0.2'));assert.equal(result.status,200);assert.equal(booked,1);
});
