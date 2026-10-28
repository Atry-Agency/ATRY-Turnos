'use strict';
const assert=require('node:assert/strict'),{buildSync}=require('esbuild'),fs=require('fs'),os=require('os'),path=require('path');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'iatry-policy-')),file=path.join(dir,'policy.cjs');
buildSync({stdin:{contents:"export * from './frontend/react/src/iatry/v3/production-policy';export * from './frontend/react/src/iatry/v3/readonly-validation';export * from './frontend/react/src/iatry/v3/catalogue';export * from './frontend/react/src/iatry/v3/engine';",resolveDir:process.cwd(),loader:'ts'},outfile:file,bundle:true,platform:'node',format:'cjs'});
(async()=>{try{globalThis.ATRY_THEME_CORE=require('../../web/theme-core');const s=require(file),scope={userId:'test-owner',businessId:s.validationBusiness,role:'owner',sessionVersion:1,accessEnabled:true,sector:'General'};let now={...scope},calls=[];
 const gate=s.createReadonlyValidation(async(r)=>{calls.push(r);return []},s.productionProject,()=>now);
 for(const [route,opts] of [['/dashboard',{}],['/bookings?date=2026-10-26',{}],['/customers',{method:'POST',body:'{}'}],['/customers',{body:'{}'}],['/customers/../bookings',{}]])await assert.rejects(()=>gate.request('/api/business/'+scope.businessId+route,opts));assert.equal(calls.length,0);
 await gate.request('/api/business/'+scope.businessId+'/services');assert.equal(calls.length,1);now={...scope,sessionVersion:2};await assert.rejects(()=>gate.request('/api/business/'+scope.businessId+'/services'));now={...scope};
 const port={scope:()=>now,business:()=>({id:scope.businessId,role:scope.role,plan:'negocio'}),capability:k=>k==='statistics',request:async(r,opts={})=>{calls.push(r);assert.equal(opts.method,undefined);return []}};
 const e=s.createConversation(port,scope,s.capabilities,'connected');assert.deepEqual(e.available().map(t=>t.id).sort(),[...s.phaseOneReleaseTools].sort());
 for(const t of s.capabilities.filter(t=>!s.phaseOneReleaseTools.includes(t.id))){const n=calls.length;await assert.rejects(()=>e.begin(t.id));assert.equal(calls.length,n)}
 for(const patch of [{role:'manager'},{role:'staff'},{businessId:'foreign'}]){const q={...scope,...patch};const x=s.createConversation({...port,scope:()=>q},q,s.capabilities,'connected');assert.equal(x.available().length,0);x.dispose()}
 await e.begin('services.list');assert.equal(e.snapshot().phase,'done');e.dispose();
 const bypass={id:'services.list',kind:'read',roles:['owner'],fields:[],prepare:async ctx=>{await ctx.api.read('/dashboard',v=>v);return{tail:'/customers',method:'POST',payload:{},summary:[]}}};const b=s.createConversation(port,scope,[bypass],'connected');const n=calls.length;await b.begin(bypass.id);assert.equal(b.snapshot().phase,'error');assert.equal(calls.length,n);b.dispose();
 const fake={...bypass,prepare:async()=>({tail:'/customers',method:'POST',payload:{},summary:[]})},f=s.createConversation(port,scope,[fake],'connected');await f.begin(fake.id);assert.equal(f.snapshot().phase,'review');await assert.rejects(()=>f.confirm(f.snapshot().token),/relectura homologada/);assert.equal(calls.length,n);f.dispose();
 const customer=s.capabilities.find(t=>t.id==='customers.create');await assert.rejects(()=>customer.prepare({}, {name:'Test',email:'',phone:'',notes:''}),/contacto/);
 console.log('PASS production: 17 approved tools; owner/Negocio scope; incomplete writes and unknown/materializing reads denied; stale sessions denied; contact required; no live requests');
}finally{fs.rmSync(dir,{recursive:true,force:true})}})().catch(e=>{console.error(e);process.exitCode=1});
