'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const config={url:'https://project.supabase.co',siteUrl:'https://atry-test.pages.dev',serviceKey:'private-test',enabled:'1',apiKey:'provider-test',sender:'sender@example.net',senderVerified:'1'};
const request=()=>new Request('https://project.supabase.co/functions/v1/atry-mail',{method:'POST',headers:{authorization:'Bearer private-test'}});

test('Worker cloud: el token de invocación se separa de la clave de acceso a la base',async()=>{
 const {createMailWorker}=await import('../supabase/functions/_shared/mail-worker.mjs');let calls=0;
 const worker=createMailWorker({...config,invocationKey:'invocation-test'},{fetchImpl:async(_url,options)=>{calls++;assert.equal(options.headers.apikey,'private-test');assert.equal(options.headers.authorization,'Bearer private-test');return Response.json(calls===1?true:[]);}});
 assert.equal((await worker(request())).status,403);assert.equal(calls,0);
 const accepted=await worker(new Request('https://project.supabase.co/functions/v1/atry-mail',{method:'POST',headers:{authorization:'Bearer invocation-test'}}));assert.equal(accepted.status,200);assert.equal(calls,2);
});
test('Worker cloud: reclama uno por vez y distingue aceptación de entrega',async()=>{
 const {createMailWorker}=await import('../supabase/functions/_shared/mail-worker.mjs');const events=[];let claims=0;
 const worker=createMailWorker(config,{fetchImpl:async(url,options)=>{
  const body=JSON.parse(options.body);events.push({url,body});
  if(url.endsWith('atry_mail_claim'))return Response.json(++claims===1?[{id:'e19f7221-84b8-4cf2-8b65-a3394ce6a23a',recipient:'recipient@example.net',subject:'Turno',content:'Aviso',attempts:1}]:[]);
  if(url.includes('api.brevo.com'))return Response.json({messageId:'provider-id'});
  return Response.json(true);
 }});
 const result=await worker(request());assert.equal(result.status,200);assert.deepEqual(await result.json(),{processed:1,provider_accepted:1,delivery_unknown:0});
 assert.equal(events[1].body.batch_size,1);assert.equal(events[2].body.headers.idempotencyKey,events[3].body.job_id);assert.equal(events[3].body.provider_id,'provider-id');assert.equal(events[4].body.batch_size,1);
});
test('Worker cloud: remitente sin verificar bloquea envíos; timeout requiere revisión',async()=>{
 const {createMailWorker}=await import('../supabase/functions/_shared/mail-worker.mjs');let calls=0,ack;
 const disabled=createMailWorker({...config,senderVerified:'0'},{fetchImpl:async()=>{calls++;}});assert.equal((await disabled(request())).status,503);assert.equal(calls,0);
 const worker=createMailWorker(config,{fetchImpl:async(url,options)=>{
  if(url.endsWith('atry_mail_claim'))return Response.json(++calls===1?[{id:'test-job',attempts:1}]:[]);
  if(url.includes('api.brevo.com'))throw new Error('timeout');
  if(url.endsWith('atry_mail_result'))ack=JSON.parse(options.body);
  return Response.json(true);
 }});const result=await worker(request());assert.equal((await result.json()).delivery_unknown,1);assert.equal(ack.provider_id,null);assert.equal(ack.error_code,'PROVIDER_CONNECTION_ERROR');
});
