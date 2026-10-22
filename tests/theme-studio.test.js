'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const T=require('../web/theme-core'),{prepare,publicConfig}=require('../server/appearance');

test('Temas: cada plan tiene composición propia y contraste accesible incluso con colores extremos',()=>{
 assert.equal(T.effective({plan:'individual'}).mode,'light');assert.equal(T.effective({plan:'negocio'}).name,'ATRY Negocio');assert.equal(T.effective({plan:'pro'}).mode,'light');assert.equal(T.effective({plan:'pro'}).sidebar,'#4754E6');
 for(const mode of ['light','dark'])for(const color of ['#FFFFFF','#000000','#777777','#FFFF00','#00EFFF']){const v=T.effective({plan:'pro',theme_config:{version:1,mode,primary:color,sidebar:color,surface:color,background:mode==='dark'?'#FFFFFF':'#000000'}});assert.ok(T.contrast(v.ink,v.surface)>=4.5);assert.ok(T.contrast(v.ink,v.background)>=4.5);assert.ok(T.contrast(v.action,v.surface)>=4.5);assert.ok(T.contrast(v.onAction,v.action)>=4.5);assert.ok(T.contrast(v.onSidebar,v.sidebar)>=4.5);}
});

test('Temas: opciones permitidas por plan, sin CSS, URLs, fuentes externas ni estilos recursivos',()=>{
 assert.throws(()=>T.validate({primary:'#B33A75'},'individual'),/colores esenciales/);assert.throws(()=>T.validate({surface:'#000000'},'negocio'),/Pro/);assert.throws(()=>T.validate({font:'https://fuente.invalid/font'},'pro'));assert.throws(()=>T.validate({primary:'red;display:none'},'pro'));assert.throws(()=>T.validate([],'pro'));assert.throws(()=>T.validate({presets:[{name:'Prueba',config:{presets:[]}}]},'pro'));
 assert.equal(T.validate({primary:'#187459',mode:'dark'},'individual').primary,'#187459');assert.equal(T.validate({primary:'#B33A75',secondary:'#00A5E2',public_mode:'light'},'negocio').public_mode,'light');
});

test('Temas: baja de plan proyecta opciones seguras sin destruir el estilo avanzado ni sus presets',()=>{
 const saved={version:1,primary:'#B33A75',mode:'dark',surface:'#23242D',font:'system',cards:'flat',presets:[{name:'Mi estilo',config:{version:1,mode:'dark',font:'system'}}]},b={plan:'individual',theme_config:JSON.stringify(saved),theme_revision:4};
 assert.equal(T.effective(b).primary,'#4754E6');assert.equal(T.effective(b).font,'atry');const changed=prepare(b,{theme_config:{version:1,primary:'#2056A0',mode:'light'},expected_revision:4});const stored=JSON.parse(changed.theme_config);assert.equal(stored.surface,saved.surface);assert.equal(stored.font,'system');assert.equal(stored.presets.length,1);assert.equal(T.effective({...b,...changed,plan:'pro'}).font,'system');assert.equal(b.theme_config,JSON.stringify(saved));
 assert.throws(()=>prepare(b,{theme_config:{version:1},expected_revision:3}),/otra ventana/);assert.throws(()=>prepare(b,{logo_url:'data:image/png;base64,AA=='}),/Negocio/);assert.equal(publicConfig({...b,plan:'pro'}).presets,undefined);
});

test('Temas HTTP: guardado duradero, propietarios, aislamiento, restricciones y exposición pública segura',async()=>{
 const {connect}=require('../server/db'),{seedDemo}=require('../server/seed'),{createApp}=require('../server/app');const db=connect(':memory:');seedDemo(db);const server=createApp({db}).createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 async function req(route,body,cookie='',method=body?'POST':'GET'){const r=await fetch(base+route,{method,headers:{'Content-Type':'application/json',cookie},body:body?JSON.stringify(body):undefined});return {status:r.status,data:await r.json(),cookie:r.headers.get('set-cookie')};}
 try{const owner=(await req('/api/auth/login',{email:'usuario1@example.com',password:'AtryDemo2026!'})).cookie,admin=(await req('/api/auth/login',{email:'admin.prueba@example.com',password:'AtryAdmin2026!'})).cookie,b=db.prepare('SELECT * FROM businesses LIMIT 1').get(),route='/api/business/'+b.id+'/appearance';
 const config={version:1,mode:'dark',primary:'#4754E6',font:'system',cards:'outlined',presets:[{name:'Noche',config:{version:1,mode:'dark'}}]};
 assert.equal((await req(route,{theme_config:config,expected_revision:0},admin,'PATCH')).status,403);assert.equal((await req(route,{theme_config:config,expected_revision:0},owner,'PATCH')).status,200);
 const read=(await req('/api/business/'+b.id,null,owner)).data;assert.equal(read.theme_config.font,'system');assert.equal(read.theme_revision,1);assert.equal(JSON.parse(db.prepare('SELECT theme_config FROM businesses WHERE id=?').get(b.id).theme_config).presets[0].name,'Noche');
 assert.equal((await req(route,{theme_config:config,expected_revision:0},owner,'PATCH')).status,409);
 const pub=(await req('/api/public/'+b.slug)).data.business;assert.equal(pub.theme_config.font,'system');assert.equal(pub.theme_config.presets,undefined);
 const org=await req('/api/organizations',{name:'Negocio separado',slug:'negocio-separado'},owner),id=org.data.id;assert.ok(id);db.prepare("UPDATE businesses SET plan='individual',subscription_status='active',paid_until=? WHERE id=?").run(new Date(Date.now()+86400000*30).toISOString(),id);assert.equal((await req('/api/business/'+id+'/appearance',{theme_config:config},owner,'PATCH')).status,403);assert.equal((await req('/api/business/'+id+'/appearance',{logo_url:'data:image/png;base64,AA=='},owner,'PATCH')).status,403);assert.equal((await req('/api/business/'+id,{primary_color:'#B33A75'},owner,'PATCH')).status,403);
 assert.equal((await req('/api/business/'+id+'/appearance',{theme_config:{version:1,primary:'#187459',mode:'dark'},expected_revision:0},owner,'PATCH')).status,200);assert.equal((await req('/api/business/'+b.id,null,owner)).data.theme_config.primary,'#4754E6');
 db.prepare("UPDATE businesses SET plan='individual' WHERE id=?").run(b.id);assert.equal(T.effective((await req('/api/business/'+b.id,null,owner)).data).font,'atry');assert.equal(JSON.parse(db.prepare('SELECT theme_config FROM businesses WHERE id=?').get(b.id).theme_config).font,'system');db.prepare("UPDATE businesses SET plan='pro' WHERE id=?").run(b.id);assert.equal(T.effective((await req('/api/business/'+b.id,null,owner)).data).font,'system');
 }finally{await new Promise(r=>server.close(r));db.close();}
});

test('Armonía: superficies intensas se suavizan y una navegación personalizada coordina los acentos por defecto',()=>{
const input={plan:'pro',theme_config:{primary:'#4754E6',sidebar:'#F779A3',surface:'#FF9494',background:'#F7A8F0'}},v=T.effective(input);
assert.notEqual(v.action,'#4754E6');assert.equal(v.action,v.secondaryInk);assert.equal(v.sidebar,'#F779A3');assert.notEqual(v.surface,'#FF9494');assert.notEqual(v.background,'#F7A8F0');assert.ok(T.contrast(v.ink,v.surface)>=4.5);assert.ok(T.contrast(v.action,v.surface)>=4.5);assert.equal(input.theme_config.surface,'#FF9494');
const explicit=T.effective({plan:'pro',theme_config:{primary:'#2056A0',sidebar:'#F779A3'}});assert.equal(explicit.action,'#2056A0');
assert.equal(T.effective({plan:'pro'}).surface,'#FFFFFF');assert.equal(T.effective({plan:'pro'}).action,'#4754E6');
});
