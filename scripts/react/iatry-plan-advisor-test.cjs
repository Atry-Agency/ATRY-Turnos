const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),esbuild=require('esbuild');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'iatry-plan-advisor-'));
try{
 const out=path.join(dir,'advisor.cjs');esbuild.buildSync({entryPoints:['frontend/react/src/iatry/v3/plan-advisor.ts'],outfile:out,bundle:true,platform:'node',format:'cjs'});
 const {advisePlan,detectPlanNeed}=require(out);
 // Capacity and feature names mirror the commercial contract. Prices deliberately absent.
 const plans=[['individual','Individual',1,{}],['negocio','Negocio',4,{team:true,statistics:true}],['pro','Pro',10,{team:true,statistics:true,resources:true}]].map(([code,name,staff_limit,features])=>({code,name,staff_limit,features}));
 const base={role:'owner',blocker:'plan',need:{kind:'staff',additional:1},plans,entitlements:{code:'individual',staff_count:1,staff_limit:1,access_enabled:true,features:{}}};
 assert.equal(advisePlan(base).planCode,'negocio');assert.equal(advisePlan(base).priceUyu,undefined);
 assert.equal(advisePlan({...base,entitlements:{...base.entitlements,code:'negocio',staff_count:4,staff_limit:4}}).planCode,'pro');
 assert.equal(advisePlan({...base,entitlements:{...base.entitlements,code:'pro',staff_count:10,staff_limit:10}}).kind,'unknown');
 assert.equal(advisePlan({...base,entitlements:{...base.entitlements,staff_count:0}}).kind,'no-upgrade');
 for(const role of ['manager','staff'])assert.equal(advisePlan({...base,role}).kind,'no-upgrade');
 for(const blocker of ['role','homologation'])assert.equal(advisePlan({...base,blocker}).kind,'no-upgrade');
 assert.equal(advisePlan({...base,blocker:'unknown'}).kind,'unknown');
 assert.equal(advisePlan({...base,need:{kind:'feature',key:'resources'}}).planCode,'pro');
 assert.equal(advisePlan({...base,need:{kind:'feature',key:'invented'}}).kind,'unknown');
 assert.equal(advisePlan({...base,need:{kind:'feature',key:'statistics'},entitlements:{...base.entitlements,features:{statistics:true}}}).kind,'no-upgrade');
 assert.equal(advisePlan({...base,need:{kind:'staff',additional:0}}).kind,'unknown');
 assert.equal(advisePlan({...base,entitlements:{...base.entitlements,access_enabled:false}}).kind,'no-upgrade');
 assert.equal(advisePlan({...base,plans:[]}).kind,'unknown');
 const priced=advisePlan({...base,plans:plans.map(p=>({...p,price_uyu:777})),taxStatus:'included'});assert.equal(priced.priceUyu,777);assert.equal(priced.taxStatus,'included');assert.equal(priced.href,'#/app/suscripcion');
 // Unsupported or malformed server values never invent a plan.
 assert.equal(advisePlan({...base,entitlements:{...base.entitlements,code:'trial'}}).kind,'unknown');
 assert.equal(advisePlan({...base,plans:plans.map(p=>({...p,staff_limit:NaN}))}).kind,'unknown');
 assert.equal(advisePlan({...base,plans:[...plans].reverse()}).planCode,'negocio');
 for(const source of ['hola','gracias','quiero vacaciones','agregar profesionales','necesito dos profesionales','no quiero agregar otro profesional','necesito recursos compartidos y estadisticas'])assert.equal(detectPlanNeed(source),undefined);
 assert.deepEqual(detectPlanNeed('Quiero agregar el quinto profesional'),{kind:'staff',desiredTotal:5});assert.equal(advisePlan({...base,need:{kind:'staff',desiredTotal:5}}).planCode,'pro');assert.equal(advisePlan({...base,need:{kind:'staff',desiredTotal:5,additional:5}}).kind,'unknown');
 assert.deepEqual(detectPlanNeed('Quiero agregar otro profesional'),{kind:'staff',additional:1});assert.deepEqual(detectPlanNeed('Necesito incorporar dos profesionales'),{kind:'staff',additional:2});assert.deepEqual(detectPlanNeed('Quiero ver estadísticas avanzadas'),{kind:'feature',key:'advanced'});assert.deepEqual(detectPlanNeed('Necesito recursos compartidos'),{kind:'feature',key:'resources'});
 console.log('PASS plan advisor: capacity, feature, role, homologation, missing-offer, pricing and concrete-need detector checks; zero transport.');
}finally{fs.rmSync(dir,{recursive:true,force:true})}
