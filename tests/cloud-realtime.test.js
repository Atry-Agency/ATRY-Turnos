'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
test('Realtime: autentica el websocket antes de suscribir y cancela conexiones pendientes',async()=>{
 const {subscribeAgenda}=await import('../cloud/realtime.mjs');const events=[];let status,resolveAuth;
 const channel={on(){return this;},subscribe(callback){status=callback;events.push('subscribe');return this;}};
 const client={auth:{getSession:async()=>({data:{session:{access_token:'test-user-jwt'}}})},realtime:{setAuth:async token=>{events.push(token);}},channel:()=>channel,removeChannel:()=>events.push('remove'),rpc:async()=>({data:{user_valid:true,role:'owner',staff_id:null}})};
 const connection=subscribeAgenda({client,bid:'b1',role:'owner'});connection.addEventListener('ready',()=>events.push('ready'));await new Promise(resolve=>setImmediate(resolve));status('SUBSCRIBED');assert.deepEqual(events,['test-user-jwt','subscribe','ready']);connection.close();assert.equal(events.at(-1),'remove');
 const pending=subscribeAgenda({client:{...client,realtime:{setAuth:()=>new Promise(resolve=>{resolveAuth=resolve;})}},bid:'b1',role:'owner'});await new Promise(resolve=>setImmediate(resolve));pending.close();resolveAuth();await new Promise(resolve=>setImmediate(resolve));assert.equal(events.filter(x=>x==='subscribe').length,1);
});
