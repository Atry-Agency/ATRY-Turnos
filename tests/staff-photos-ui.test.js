'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
test('Fotos UI: iniciales accesibles, publicación explícita, guardado sin cambios no hace consultas',async()=>{
 let requests=0;const scope={window:{AtryStaffPhoto:require('../web/staff-photo-core'),addEventListener(){}},document:{readyState:'loading',addEventListener(){}},state:{business:{id:'b'},me:{user:{id:'u'}}},Map,URL,ic:()=>'<svg></svg>',esc:s=>String(s).replaceAll('"','&quot;').replaceAll('<','&lt;'),api:async()=>{requests++;return [];}};
 vm.createContext(scope);vm.runInContext(fs.readFileSync('web/staff-photos.js','utf8'),scope);
 const avatar=scope.staffAvatar({id:'s',name:'Agustina Rojas'});assert.ok(avatar.includes('AR'));assert.match(avatar,/data-photo-public="0"/);assert.match(avatar,/aria-hidden="true"/);
 assert.match(scope.staffAvatar({id:'s',name:'Agustina'},'staff-avatar',true,'b'),/data-photo-public="1"/);
 const editor=scope.staffPhotoEditor({id:'s',name:'Claudia'});assert.match(editor,/data-photo-visible disabled/);assert.ok(!editor.includes(' checked'));assert.ok(editor.includes('64 KB'));assert.ok(editor.includes('data-photo-pick disabled'));assert.ok(editor.includes('data-photo-remove disabled hidden'));assert.ok(editor.includes('<details class="staff-photo-requirements">')); 
 await scope.saveStaffPhoto({querySelector:()=>({dataset:{}})});assert.equal(requests,0);
 await assert.rejects(scope.saveStaffPhoto({querySelector:()=>({dataset:{preparing:'true'}})}),/preparación/);
 const commercial=fs.readFileSync('web/commercial.js','utf8'),context={state:{entitlements:{features:{team:false}}},staffPhotoProfiles(){},document:{addEventListener(){}},window:{addEventListener(){}}};vm.createContext(context);vm.runInContext(commercial.slice(0,commercial.indexOf('function pruneCommercialControls'))+'\nglobalThis.allowed= commercialRouteAllowed("equipo");',context);assert.equal(context.allowed,true);assert.equal(context.state.entitlements.features.team,false);
});
test('Fotos UI: integración espera el modal antes de cargar datos y conserva los tamaños circulares',()=>{
 const source=fs.readFileSync('web/app.js','utf8'),css=fs.readFileSync('web/staff-photos.css','utf8');
 assert.match(source,/async function staffModal/);assert.ok(source.includes("bindStaffPhotoEditor(document.querySelector('[data-form=update-staff]'),staff)"));
 assert.ok(css.includes('border-radius:50%'));assert.ok(css.includes('object-fit:cover'));
 assert.ok(source.includes('Datos del profesional guardados. No se pudo guardar la foto:'));
});
