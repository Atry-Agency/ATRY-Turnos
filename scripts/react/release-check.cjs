'use strict';
// Artifact-only checks: never authenticates or contacts Supabase.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
function check(directory=path.resolve('dist/github-preview')){
 const sandbox={window:{}};vm.runInNewContext(fs.readFileSync(path.join(directory,'runtime-config.js'),'utf8'),sandbox,{timeout:1000});
 const config=sandbox.window.ATRY_CONFIG;
 assert.equal(config.backend,'supabase');assert.equal(config.supabaseUrl,'https://djoxdtloqwbrhgtgencc.supabase.co');
 assert.match(config.supabaseKey,/^sb_publishable_[A-Za-z0-9_-]+$/);assert.equal(Boolean(config.experimentalConnectionLocked),false);assert.equal(Boolean(config.verificationOnly),false);
 assert.deepEqual(Object.keys(config).sort(),['backend','supabaseKey','supabaseUrl','turnstileSiteKey'].sort());
 const auditSandbox={};vm.runInNewContext(fs.readFileSync(path.join(directory,'iatry-visual-audit.js'),'utf8'),auditSandbox,{timeout:1000});
 const visual=auditSandbox.ATRY_IATRY_BUILD,{allowed,approvedBase}=require('./iatry-visual-audit.cjs');assert.equal(visual.mode,'visual-only');assert.equal(visual.automatedOperations,false);assert.equal(visual.approvedBase,approvedBase);assert.match(visual.revision,/^[a-f0-9]{40}$/);assert.ok(visual.assistantModules.length>0);for(const id of visual.assistantModules)assert.ok(allowed.has(id),'Unapproved assistant module');
 const html=fs.readFileSync(path.join(directory,'index.html'),'utf8');assert.match(html,/type="module"/);assert.doesNotMatch(html,/<script[^>]+src=["'][^"']*(?:\/app\.js|cloud-backend\.js|pilot\.js)/);
 assert.equal(fs.existsSync(path.join(directory,'.nojekyll')),true);
 for(const file of ['index.html','descubrir.html','runtime-config.js','sw.js','assets/brand/atry.png'])assert.equal(fs.existsSync(path.join(directory,file)),true,'Missing public entry or asset');
 const files=JSON.parse(fs.readFileSync(path.join(directory,'react-assets.json'),'utf8'));for(const file of files){assert.doesNotMatch(file,/(?:^|\/)(?:tests?|fixtures?|scripts|docs|evidence|backups?|node_modules|validacion|legacy)(?:\/|$)/);assert.ok(file.startsWith('/')&&!file.includes('..'));assert.equal(fs.existsSync(path.join(directory,file)),true,'Missing manifest asset')}
 for(const file of files.filter(x=>x.endsWith('.js'))){const code=fs.readFileSync(path.join(directory,file),'utf8');assert.doesNotMatch(code,/data-iatry-operations|Confirmar y ejecutar|Cerrar sin reintentar|iatry-v3-local/,'Experimental assistant execution present in production artifact')}
 return {assistant:'visual-only',automatedOperations:false,assistantModules:visual.assistantModules.length,project:'djoxdtloqwbrhgtgencc',frontend:'react-iatry',assets:files.length,connectionLocked:false,supabaseRequests:0};
}
if(require.main===module){try{console.log(JSON.stringify(check(process.argv[2])))}catch{console.error('Release artifact validation failed; configuration values are not logged.');process.exitCode=1}}
module.exports={check};
