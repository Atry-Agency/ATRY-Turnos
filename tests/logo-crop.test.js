'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {logoCropRect,preparedBusinessLogo}=require('../web/logo-editor');
test('Logo: recorte cuadrado dentro de imagen horizontal/vertical, zoom y extremos de desplazamiento',()=>{
 assert.deepEqual(logoCropRect(1200,600),{x:300,y:0,size:600});
 assert.deepEqual(logoCropRect(600,1200,2,100,100),{x:300,y:900,size:300});
 for(const [width,height] of [[600,1200],[1200,600],[512,512]])for(const zoom of [1,2,4])for(const x of [0,50,100])for(const y of [0,50,100]){const r=logoCropRect(width,height,zoom,x,y);assert.ok(r.x>=0&&r.y>=0&&r.x+r.size<=width&&r.y+r.size<=height);}
 assert.throws(()=>logoCropRect(0,600));
});
test('Logo: solo se envía el recorte confirmado, cancelar conserva el actual y quitar tiene prioridad',()=>{
 const form={elements:{remove_logo:{checked:false}},dataset:{},querySelector:()=>null};
 assert.equal(preparedBusinessLogo(form),undefined);
 form.dataset.logoData='data:image/png;base64,confirmed';assert.equal(preparedBusinessLogo(form),form.dataset.logoData);
 form.querySelector=()=>({});assert.throws(()=>preparedBusinessLogo(form),/Aplicá/);
 form.elements.remove_logo.checked=true;assert.equal(preparedBusinessLogo(form),'');
});
