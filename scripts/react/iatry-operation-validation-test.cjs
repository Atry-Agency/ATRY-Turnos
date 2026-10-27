'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{buildSync}=require('esbuild');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'iatry-trial-test-')),file=path.join(dir,'trial.cjs');
buildSync({entryPoints:['frontend/react/src/iatry/v3/operation-validation.ts'],outfile:file,bundle:true,platform:'node',format:'cjs'});
const {createOperationValidation,operationTrial:t}=require(file),project='https://djoxdtloqwbrhgtgencc.supabase.co',businessId='374cd00d-3e37-497f-9292-9bb959c1ef88',base='/api/business/'+businessId;
let scope={businessId,role:'owner',accessEnabled:true,userId:'owner',sessionVersion:1},calls=0;
const tables={'/services':[],'/customers':[],'/staff':[],'/time-off':[]};
async function request(route,options={}){calls++;const tail=route.slice(base.length),table='/'+tail.split('/')[1],rows=tables[table];if(!options.method||options.method==='GET')return structuredClone(rows);const body=JSON.parse(options.body),id=tail.split('/')[2];if(options.method==='POST'){const row={...body,id:'record-'+calls,business_id:businessId,...(table==='/services'?{active:1}:{})};rows.push(row);return {...row}}const row=rows.find(r=>r.id===id);Object.assign(row,body);return {...row}}
const post=(gate,tail,body,method='POST')=>gate.request(base+tail,{method,body:JSON.stringify(body)});
(async()=>{try{
 const denied=createOperationValidation(request,project,()=>scope,'services-customers');await assert.rejects(post(denied,'/services',{}),/autorización/);assert.equal(calls,0);
 const gate=createOperationValidation(request,project,()=>scope,'services-customers',true);
 await assert.rejects(post(gate,'/services',{name:'Other'}),/autorización/);assert.equal(calls,0);
 const service={name:t.serviceName,description:t.description,price_uyu:0,duration_min:15,deposit_percent:0,buffer_before_min:0,buffer_after_min:0,staff_ids:[]};
 let row=await post(gate,'/services',service);assert.equal(row.confirmed_readback,true);const id=row.id;
 await post(gate,'/services/'+id,{...service,price_uyu:1},'PATCH');await post(gate,'/services/'+id,{...service,price_uyu:1,duration_min:20},'PATCH');await post(gate,'/services/'+id,{active:0},'PATCH');
 const customer={name:t.customerName,email:t.email,phone:'',notes:t.notes,marketing_consent:false};row=await post(gate,'/customers',customer);await post(gate,'/customers/'+row.id,{...customer,notes:t.updatedNotes},'PATCH');assert.equal(gate.state().done,true);assert.equal(gate.evidence().length,6);await assert.rejects(post(gate,'/customers',customer),/cerrado/);
 const replay=createOperationValidation(request,project,()=>scope,'services-customers',true);await assert.rejects(post(replay,'/services',service),/ya existe/);
 tables['/staff']=[{id:t.staffId,active:1,business_id:businessId}];const absence=createOperationValidation(request,project,()=>scope,'absence',true);const block=await post(absence,'/time-off',{staff_id:t.staffId,starts_at:t.startsAt,ends_at:t.endsAt,reason:t.reason});assert.equal(block.confirmed_readback,true);assert.equal(absence.state().done,true);
 scope={...scope,role:'employee'};await assert.rejects(gate.request(base+'/services'),/sesión/);
 console.log('PASS finite private trial: authorization default denied, exact payloads, seven locally simulated writes/readbacks across two groups, replay and stale scope blocked; zero network requests');
 }finally{fs.rmSync(dir,{recursive:true,force:true})}})().catch(e=>{console.error(e);process.exitCode=1});
