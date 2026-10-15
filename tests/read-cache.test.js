'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createReadCache}=require('../web/read-cache');
test('Lecturas: comparte consultas en vuelo y entrega copias independientes, con vencimiento',async()=>{
 let now=0,calls=0,release;const cache=createReadCache({clock:()=>now});
 const load=()=>{calls++;return new Promise(resolve=>release=resolve);};
 const options={namespace:'user1'},route='/api/business/b1/services';
 const a=cache.read(route,load,options),b=cache.read(route,load,options);await Promise.resolve();
 assert.equal(calls,1);release([{name:'Corte'}]);const [first,second]=await Promise.all([a,b]);
 first[0].name='Editado';assert.equal(second[0].name,'Corte');
 assert.equal((await cache.read(route,load,options))[0].name,'Corte');assert.equal(calls,1);
 now=21000;const c=cache.read(route,load,options);await Promise.resolve();assert.equal(calls,2);release([]);await c;
});
test('Lecturas: aislamiento por usuario y negocio, y las invalidaciones no se repueblan con respuestas antiguas',async()=>{
 const cache=createReadCache();let calls=0,release;const load=async()=>++calls;
 assert.equal(await cache.read('/api/business/b1/staff',load,{namespace:'u1'}),1);
 assert.equal(await cache.read('/api/business/b1/staff',load,{namespace:'u2'}),2);
 assert.equal(await cache.read('/api/business/b2/staff',load,{namespace:'u1'}),3);
 const pending=cache.read('/api/business/b1/customers?q=',()=>new Promise(r=>release=r),{namespace:'u1'});
 await Promise.resolve();cache.clear();release(['Viejo']);await pending;
 assert.deepEqual(await cache.read('/api/business/b1/customers?q=',async()=>['Nuevo'],{namespace:'u1'}),['Nuevo']);
});
test('Lecturas: errores, Auth, disponibilidad, enlaces privados y exportaciones siempre consultan al servidor',async()=>{
 const cache=createReadCache();let calls=0;const options={namespace:'u'};
 for(const route of ['/api/auth/me','/api/account/sessions','/api/public/negocio/availability?date=2026-10-20','/api/business/b1/availability','/api/manage/private','/api/business/b1/export/bookings']){
  const load=async()=>++calls;const a=await cache.read(route,load,options),b=await cache.read(route,load,options);assert.equal(b,a+1);
 }
 const route='/api/business/b1/services';await assert.rejects(cache.read(route,async()=>{throw new Error('Sin permiso');},options));
 assert.deepEqual(await cache.read(route,async()=>['Actual'],options),['Actual']);
 assert.deepEqual(await cache.read(route,async()=>['Forzado'],{...options,fresh:true}),['Forzado']);
});
