'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
test('Catálogo: servicios y equipo simultáneos comparten una consulta y una edición obliga a leer de nuevo',async()=>{
 const {createApiAdapter}=await import('../cloud/api-adapter.mjs');let count=0,release;
 const adapter=createApiAdapter({auth:{client:{rpc:()=>{count++;return new Promise(resolve=>release=resolve);}}},config:{}});
 const services=adapter.request('/api/business/b1/services'),staff=adapter.request('/api/business/b1/staff');
 assert.equal(count,1);release({data:{services:[{id:'s'}],staff:[{id:'p'}]}});
 assert.deepEqual(await services,[{id:'s'}]);assert.deepEqual(await staff,[{id:'p'}]);
 const next=adapter.request('/api/business/b1/staff');assert.equal(count,2);release({data:{staff:[]}});await next;
});
test('Adaptador cloud: cliente conserva idempotencia y los enlaces privados se envían en el cuerpo',async()=>{
 const {createApiAdapter}=await import('../cloud/api-adapter.mjs');let sent;
 const adapter=createApiAdapter({auth:{client:{}},config:{supabaseUrl:'https://project.supabase.co',supabaseKey:'sb_publishable_test'},fetchImpl:async(url,options)=>{sent={url:String(url),options};return {ok:true,json:async()=>({status:'cancelled'})};}});
 const token='a'.repeat(64);await adapter.request('/api/manage/'+token+'/cancel',{method:'POST',body:'{}'});assert.ok(!sent.url.includes(token));assert.equal(JSON.parse(sent.options.body).token,token);assert.equal(sent.options.method,'POST');assert.equal(sent.options.headers.apikey,'sb_publishable_test');assert.ok(!('authorization'in sent.options.headers));
});
test('Adaptador cloud: consultas privadas usan el negocio del recorrido y traducen reglas de horario',async()=>{
 const {createApiAdapter}=await import('../cloud/api-adapter.mjs');const calls=[];
 const adapter=createApiAdapter({auth:{client:{rpc:async(name,args)=>{calls.push({name,args});return {data:[]};}}},config:{}});
 await adapter.request('/api/business/business-one/bookings?date=2026-10-21&days=7');assert.deepEqual(calls[0],{name:'atry_bookings',args:{bid:'business-one',start_day:'2026-10-21',days:7}});
 await adapter.request('/api/business/business-one/breaks',{method:'POST',body:JSON.stringify({staff_id:'staff-one',weekday:1,start:'13:00',end:'14:00'})});assert.equal(calls[1].args.payload.start_min,780);assert.equal(calls[1].args.payload.end_min,840);assert.ok(!('start'in calls[1].args.payload));
});
test('Adaptador cloud: exporta todas las páginas y rechaza una agenda que cambia durante la exportación',async()=>{
 const {createApiAdapter}=await import('../cloud/api-adapter.mjs');let page=0,changed=false;
 const adapter=createApiAdapter({auth:{client:{rpc:async()=>({data:++page===1?{rows:[{customer:'=HYPERLINK("malicioso")'}],next_cursor:{start:'2026-10-01',id:'id1'},revision:1}:{rows:[{customer:'Cliente 2'}],next_cursor:null,revision:changed?2:1}})}},config:{}});
 const csv=await adapter.exportCsv('b1');assert.ok(csv.includes('Cliente 2'));assert.ok(csv.includes("'HYPERLINK"));page=0;changed=true;await assert.rejects(adapter.exportCsv('b1'),/agenda cambió/);
});
