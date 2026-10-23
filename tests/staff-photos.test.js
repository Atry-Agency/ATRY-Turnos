'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),Core=require('../web/staff-photo-core'),{connect}=require('../server/db'),{seedDemo}=require('../server/seed');
const image='data:image/webp;base64,'+Buffer.concat([Buffer.from('RIFF'),Buffer.alloc(4),Buffer.from('WEBP'),Buffer.alloc(16)]).toString('base64');
test('Fotos: formato, tamaño y rutas quedan limitados a WebP y negocio/profesional',()=>{
 assert.equal(Core.bytes(image).length,28);assert.equal(Core.path('b','s','r'),'b/s/r.webp');assert.ok(Core.validPath('b/s/r.webp','b','s'));assert.ok(!Core.validPath('other/s/r.webp','b','s'));assert.throws(()=>Core.path('../b','s','r'));for(const value of ['data:image/svg+xml;base64,AAAA','javascript:1','data:image/webp;base64,AAAA'])assert.throws(()=>Core.bytes(value));assert.throws(()=>Core.bytes('data:image/webp;base64,'+Buffer.alloc(65537).toString('base64')));
});
test('Fotos local: subir, ocultar/publicar, reemplazar con revisión y eliminar sin modificar profesional',()=>{
 const db=connect(':memory:');seedDemo(db);try{
 const b=db.prepare('SELECT * FROM businesses LIMIT 1').get(),s=db.prepare('SELECT * FROM staff WHERE business_id=? LIMIT 1').get(b.id),before=JSON.stringify(s),routes=[];
 require('../server/staff-photos').register({db,r:(method,p,handler)=>routes.push({method,re:new RegExp('^'+p+'$'),handler}),authorized:(req,bid,roles)=>{if(bid!==b.id||!roles.includes(req.role))throw Error('FORBIDDEN');return {user:{id:null}};},record:()=>{}});
 const call=(method,path,body={},role='owner')=>{const url=new URL(path,'http://local'),route=routes.find(r=>r.method===method&&r.re.test(url.pathname));return route.handler({req:{role},params:route.re.exec(url.pathname).slice(1),body:method==='PUT'?{expected_revision:db.prepare('SELECT revision FROM staff_photos WHERE staff_id=?').get(s.id)?.revision||0,...body}:body,url});};
 const route='/api/business/'+b.id+'/staff/'+s.id+'/photo',list='/api/staff-photos/'+b.id;
 let row=call('PUT',route,{expected_path:null,image,show_public:false});assert.equal(call('GET',list+'?public=1').length,0);assert.equal(call('GET',list).length,1);
 assert.throws(()=>call('PUT',route,{expected_path:row.path,image,show_public:true},'staff'),/FORBIDDEN/);
 assert.throws(()=>call('PUT',route,{expected_path:null,image,show_public:true}),/cambió/);
 const staleRevision=row.revision;row=call('PUT',route,{expected_path:row.path,show_public:true});assert.throws(()=>call('PUT',route,{expected_path:row.path,expected_revision:staleRevision,show_public:false}),/cambió/);assert.equal(call('GET',list+'?public=1').length,1);
 const old=row.path;row=call('PUT',route,{expected_path:old,image,show_public:false});assert.notEqual(row.path,old);
 assert.throws(()=>call('GET','/api/staff-photos/'+old.replace('.webp','')+'?public=1'));
 assert.throws(()=>call('GET',list.replace(b.id,'foreign')),/FORBIDDEN/);
 call('PUT',route,{expected_path:row.path,image:null,show_public:false});assert.equal(call('GET',list).length,0);assert.equal(JSON.stringify(db.prepare('SELECT * FROM staff WHERE id=?').get(s.id)),before);
 }finally{db.close();}
});
test('Fotos cloud: carga única, fallo de confirmación ambiguo y limpieza posterior segura',async()=>{
 const {createStaffPhotoAdapter}=await import('../cloud/staff-photos.mjs');let current=null,fail=false,ambiguous=false;const calls=[];
 const client={storage:{from:bucket=>{assert.equal(bucket,'staff-photos');return {upload:async(path,bytes,opts)=>{calls.push(['upload',path,opts]);return {};},remove:async paths=>{calls.push(['remove',paths]);return {};},download:async()=>({data:new Blob(['x'],{type:'image/webp'})})};}}};
 const request=createStaffPhotoAdapter({client,rpc:async(name,args)=>{assert.equal(name,'atry_staff_photos');if(!args.payload)return current?[current]:[];if(fail&&!ambiguous)throw Error('STALE_REVISION');current=args.payload.path===null?null:{staff_id:'s',path:args.payload.path||current?.path,show_public:args.payload.show_public};if(ambiguous)throw Error('Respuesta perdida después de COMMIT');return {photo:current,old_path:args.payload.expected_path};}});
 const route='/api/business/b/staff/s/photo',url=new URL('http://local'+route);let result=await request(route,'PUT',{expected_path:null,image,show_public:false},url);assert.ok(result.handled);assert.ok(result.data.path);assert.equal(calls[0][2].upsert,false);assert.equal(calls[0][2].cacheControl,'0');
 fail=true;const removes=calls.filter(x=>x[0]==='remove').length;await assert.rejects(request(route,'PUT',{expected_path:null,image,show_public:false},url));assert.equal(calls.filter(x=>x[0]==='remove').length,removes+1);
 ambiguous=true;const next=calls.filter(x=>x[0]==='remove').length;await assert.rejects(request(route,'PUT',{expected_path:null,image,show_public:false},url));assert.equal(calls.filter(x=>x[0]==='remove').length,next,'No borrar una imagen cuyo COMMIT pudo tener éxito');
});
