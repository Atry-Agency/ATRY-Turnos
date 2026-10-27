'use strict';
// Artifact-only checks: never authenticates or contacts Supabase.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
function check(directory=path.resolve('dist/github-preview')){
 const sandbox={window:{}};vm.runInNewContext(fs.readFileSync(path.join(directory,'runtime-config.js'),'utf8'),sandbox,{timeout:1000});
 const config=sandbox.window.ATRY_CONFIG;
 assert.equal(config.backend,'supabase');assert.equal(config.supabaseUrl,'https://djoxdtloqwbrhgtgencc.supabase.co');
 assert.match(config.supabaseKey,/^sb_publishable_[A-Za-z0-9_-]+$/);assert.equal(Boolean(config.experimentalConnectionLocked),false);assert.equal(Boolean(config.verificationOnly),false);
 assert.deepEqual(Object.keys(config).sort(),['backend','supabaseKey','supabaseUrl','turnstileSiteKey'].sort());
 const attestation={};vm.runInNewContext(fs.readFileSync(path.join(directory,'iatry-operational-audit.js'),'utf8'),attestation,{timeout:1000});const boundary=attestation.ATRY_IATRY_BUILD,policy=require('./iatry-operational-audit.cjs').policy();assert.equal(boundary.mode,'operational-restricted');assert.equal(boundary.understanding.mode,'deterministic');assert.equal(boundary.understanding.automaticExecution,false);assert.equal(boundary.project,config.supabaseUrl);assert.equal(boundary.rollback,'a0e3e79f715988cca22ce87182a24fa1add437cd');assert.deepEqual(Array.from(boundary.writes),[]);assert.deepEqual(Array.from(boundary.reads),Array.from(policy.verifiedProductionReads));assert.equal(boundary.scope.business,policy.validationBusiness);assert.equal(boundary.scope.role,'owner');assert.deepEqual(Array.from(boundary.publicDemo.writes),[]);assert.deepEqual(Array.from(boundary.publicDemo.reads),Array.from(policy.verifiedProductionReads));
 const html=fs.readFileSync(path.join(directory,'index.html'),'utf8');assert.match(html,/type="module"/);assert.doesNotMatch(html,/<script[^>]+src=["'][^"']*(?:\/app\.js|cloud-backend\.js|pilot\.js)/);
 assert.equal(fs.existsSync(path.join(directory,'.nojekyll')),true);
 for(const file of ['index.html','descubrir.html','runtime-config.js','sw.js','assets/brand/atry.png'])assert.equal(fs.existsSync(path.join(directory,file)),true,'Missing public entry or asset');
 const files=JSON.parse(fs.readFileSync(path.join(directory,'react-assets.json'),'utf8'));for(const file of files){assert.doesNotMatch(file,/(?:^|\/)(?:tests?|fixtures?|scripts|docs|evidence|backups?|node_modules|validacion)(?:\/|$)/);assert.ok(file.startsWith('/')&&!file.includes('..'));assert.equal(fs.existsSync(path.join(directory,file)),true,'Missing manifest asset')}
 for(const file of files.filter(file=>file.endsWith('.js'))){const code=fs.readFileSync(path.join(directory,file),'utf8');assert.doesNotMatch(code,/IAtry · Cliente controlado 2026-10-26|iatry-cliente-20261026@example\.invalid|IAtry · Validación controlada 2026-10-26|createOperationValidation|IAtry · Servicio operativo controlado 2026-10-27|iatry-operativo-20261027@example\.invalid|createCustomerValidation|createServiceValidation|createReadonlyValidation|sb_secret_[A-Za-z0-9_-]{20,}/,'Private trial or secret leaked into the artifact')}
 return {assistant:'operational-restricted',productionWrites:0,productionReads:boundary.reads.length,project:'djoxdtloqwbrhgtgencc',frontend:'react-iatry',assets:files.length,connectionLocked:false,supabaseRequests:0};
}
if(require.main===module){try{console.log(JSON.stringify(check(process.argv[2])))}catch{console.error('Release artifact validation failed; configuration values are not logged.');process.exitCode=1}}
module.exports={check};
