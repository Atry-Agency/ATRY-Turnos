const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),esbuild=require('esbuild');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'iatry-onboarding-'));
try{
 const out=path.join(dir,'model.cjs');esbuild.buildSync({entryPoints:['frontend/react/src/onboarding/model.ts'],outfile:out,bundle:true,platform:'node',format:'cjs'});
 const {buildOnboarding,planStaffLimit}=require(out);
 const base={business:{id:'biz-a',role:'owner',plan:'negocio',name:'Estudio',sector:'Peluquería',city:'Montevideo',email:'test@example.invalid',slug:'estudio',access_enabled:true,onboarding_completed:0},services:[{id:'service',name:'Corte',active:1,price_uyu:500,duration_min:30}],staff:[{id:'person',name:'Ana',active:1,service_ids:['service']}],scheduling:{hours:[{staff_id:'person',weekday:1,start_min:540,end_min:1080}],breaks:[]},reviewedPublic:true};
 const model=(patch={})=>buildOnboarding({...base,...patch});
 assert.deepEqual(['individual','negocio','pro','trial'].map(planStaffLimit),[1,4,10,0]);
 assert.equal(model().completed,5);assert.equal(model().readyToFinish,true);assert.equal(model().nextStep,'review');
 assert.equal(model({business:{...base.business,onboarding_completed:1}}).completed,6);
 const empty=model({business:{id:'new',role:'owner',plan:'individual',access_enabled:false},services:[],staff:[],scheduling:{},reviewedPublic:false});assert.equal(empty.completed,0);assert.equal(empty.nextStep,'identity');assert.equal(empty.bookable,false);
 const partial=model({services:[],reviewedPublic:false});assert.equal(partial.steps.find(s=>s.id==='services').complete,false);assert.equal(partial.bookable,false);assert.equal(partial.readyToFinish,false);
 // Visiting, legacy completion flags and malformed data never replace real prerequisites.
 assert.equal(model({reviewedPublic:false}).readyToFinish,false);
 assert.equal(model({business:{...base.business,onboarding_completed:1},services:[]}).steps.at(-1).complete,false);
 assert.equal(model({services:[{...base.services[0],duration_min:0}]}).bookable,false);
 assert.equal(model({services:[{...base.services[0],price_uyu:'500'}]}).bookable,false);
 assert.equal(model({staff:[{...base.staff[0],service_ids:[]}]}).bookable,false);
 assert.equal(model({scheduling:{hours:[],breaks:[]}}).bookable,false);
 assert.equal(model({scheduling:{hours:base.scheduling.hours,breaks:base.scheduling.hours}}).bookable,false);
 assert.equal(model({scheduling:{hours:[{...base.scheduling.hours[0],start_min:1080,end_min:540}],breaks:[]}}).bookable,false);
 assert.equal(model({scheduling:{hours:[{...base.scheduling.hours[0],staff_id:'foreign'}],breaks:[]}}).bookable,false);
 assert.equal(model({business:{...base.business,access_enabled:false}}).bookable,false);
 assert.equal(model({business:{...base.business,access_enabled:undefined,is_active:1,subscription_status:'active',paid_until:'2000-01-01'}}).subscriptionEnabled,false);
 const two=[base.staff[0],{id:'person-b',name:'B',active:1,service_ids:['service']}];
 assert.equal(model({business:{...base.business,plan:'individual'},staff:two}).readyToFinish,false);
 assert.equal(model({business:{...base.business,plan:'trial'}}).readyToFinish,false);
 for(const role of ['manager','staff','']){const x=model({business:{...base.business,role}});assert.equal(x.eligible,false);assert.equal(x.readyToFinish,false);assert.equal(x.bookable,false);assert.equal(x.completed,0)}
 for(const plan of ['individual','negocio','pro'])assert.equal(model({business:{...base.business,plan}}).readyToFinish,true);
 console.log('PASS onboarding: evidence-derived new/partial/complete states, explicit review, owner-only eligibility, 1/4/10 limits, expired access, assignments and valid effective hours; zero transport.');
}finally{fs.rmSync(dir,{recursive:true,force:true})}
