'use strict';
const assert=require('node:assert/strict'),{buildSync}=require('esbuild'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'iatry-presentation-')),file=path.join(dir,'ack.cjs');
try{buildSync({entryPoints:['frontend/react/src/iatry/v3/acknowledgement.ts'],outfile:file,bundle:true,platform:'node',format:'cjs'});const {acknowledgement}=require(file),plan={payload:{price_uyu:10},summary:[],success:'Guardado'},tool={id:'services.price',title:'Precio',fields:[]};
assert.throws(()=>acknowledgement(plan,tool,{id:'test'},'operation-validation'),/verificar/);
let r=acknowledgement(plan,tool,{id:'test',name:'Ficha autorizada',price_uyu:12,confirmed_readback:true},'operation-validation');assert.equal(r.verified,true);assert.equal(r.preview.rows.find(x=>x.label==='Precio UYU').value,'12');assert.equal(r.preview.kind,'service');assert.ok(!JSON.stringify(r.preview).includes('Barba'));
r=acknowledgement(plan,tool,{id:'test',price_uyu:10},'local');assert.equal(r.verified,false);assert.equal(r.preview,undefined);
r=acknowledgement({...plan,payload:{}},{...tool,id:'schedule.absence'},{id:'period',reason:'Descanso',starts_at:'2026-11-16T16:00:00Z',ends_at:'2026-11-16T17:00:00Z',confirmed_readback:true},'operation-validation');assert.match(r.preview.interval.start,/13:00/);assert.match(r.preview.interval.end,/14:00/);
r=acknowledgement({...plan,payload:{starts_at:'2026-11-16T16:00:00.000Z',ends_at:'2026-11-16T17:00:00.000Z'}},{...tool,id:'schedule.absence'},{id:'period',starts_at:'2026-11-16T16:00:00+00:00',ends_at:'2026-11-16T17:00:00+00:00',confirmed_readback:true},'operation-validation');assert.ok(!r.message.includes('valores ajustados'));assert.match(r.message,/comprobé/);
console.log('PASS presentation: no verified state without re-read; actual server values only; no demo facts; period uses Uruguay time');
}finally{fs.rmSync(dir,{recursive:true,force:true})}
