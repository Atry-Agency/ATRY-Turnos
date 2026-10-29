'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),{execFileSync}=require('child_process'),{buildSync}=require('esbuild');
function policy(){const file=path.resolve(__dirname,'../../frontend/react/src/iatry/v3/production-policy.ts'),sandbox={module:{exports:{}},exports:{}};vm.runInNewContext(buildSync({entryPoints:[file],bundle:true,write:false,platform:'node',format:'cjs'}).outputFiles[0].text,sandbox,{timeout:1000});return sandbox.module.exports}
function plugin(readPolicy=policy){return{name:'iatry-operational-release-boundary',generateBundle(_,bundle){
 const modules=[...new Set(Object.values(bundle).filter(x=>x.type==='chunk').flatMap(x=>Object.keys(x.modules)).filter(x=>x.includes('/src/iatry/')))];
 if(modules.some(x=>/\/(?:reservation-validation|operation-validation|customer-validation|service-validation|readonly-validation)\.ts$/.test(x)))throw Error('Private live-trial code must never enter the release artifact.');
 const p=readPolicy();if(typeof p.phaseOneReleaseApproved!=='boolean')throw Error('Missing code-owned approval boundary.');if(p.verifiedProductionReads.some(id=>!p.auditedReadTools.includes(id)))throw Error('An unaudited production capability was enabled.');
 if(!modules.some(x=>x.endsWith('/v3/instructions.ts'))||!modules.some(x=>x.endsWith('/v3/conversation-copy.ts')))throw Error('Missing deterministic understanding modules.');
 const enabled=p.phaseOneReleaseApproved,reads=enabled?p.phaseOneReadTools:p.verifiedProductionReads,writes=enabled?p.phaseOneReleaseTools.filter(id=>!reads.includes(id)):[];
 const data={understanding:{mode:'deterministic',automaticExecution:false},mode:enabled?'phase-one-operational':'operational-restricted',revision:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),rollback:p.productionRollback,project:p.productionProject,scope:enabled?{business:'authorized-active-business',role:'owner',plans:p.productionOwnerPlans}:{business:p.validationBusiness,role:'owner'},reads,writes,...(enabled?{toolsByPlan:p.productionToolsByPlan}:{}),...(enabled?{fieldRestrictions:{'customers.update':['notes']}}:{}),publicDemo:{reads:p.verifiedProductionReads,writes:[]},incompatible:['schedule.exception','waitlist.booked']};
 this.emitFile({type:'asset',fileName:'iatry-operational-audit.js',source:'globalThis.ATRY_IATRY_BUILD=Object.freeze('+JSON.stringify(data)+');\n'});
}}}
module.exports={policy,plugin};
