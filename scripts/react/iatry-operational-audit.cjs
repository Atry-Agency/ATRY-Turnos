'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),{execFileSync}=require('child_process'),{transformSync}=require('esbuild');
function policy(){const file=path.resolve(__dirname,'../../frontend/react/src/iatry/v3/production-policy.ts'),sandbox={module:{exports:{}},exports:{}};vm.runInNewContext(transformSync(fs.readFileSync(file,'utf8'),{loader:'ts',format:'cjs'}).code,sandbox,{timeout:1000});return sandbox.module.exports}
function plugin(){return{name:'iatry-operational-release-boundary',generateBundle(_,bundle){
 const modules=[...new Set(Object.values(bundle).filter(x=>x.type==='chunk').flatMap(x=>Object.keys(x.modules)).filter(x=>x.includes('/src/iatry/')))];
 if(modules.some(x=>/\/(?:customer-validation|service-validation|readonly-validation)\.ts$/.test(x)))throw Error('Private live-trial code must never enter the release artifact.');
 const p=policy();if(p.verifiedProductionReads.some(id=>!p.auditedReadTools.includes(id)))throw Error('An unaudited production capability was enabled.');
 const data={mode:'operational-restricted',revision:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),rollback:'1d48879164ee7059cd08171f5b124f5c36c8e44c',project:p.productionProject,scope:{business:p.validationBusiness,role:'owner'},reads:p.verifiedProductionReads,writes:[],incompatible:['schedule.exception','waitlist.booked']};
 this.emitFile({type:'asset',fileName:'iatry-operational-audit.js',source:'globalThis.ATRY_IATRY_BUILD=Object.freeze('+JSON.stringify(data)+');\n'});
}}}
module.exports={policy,plugin};
