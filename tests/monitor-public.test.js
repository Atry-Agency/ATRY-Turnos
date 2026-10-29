const {test}=require('node:test');
const assert=require('node:assert/strict');
const {probe}=require('../scripts/monitor-public');
const base='https://atryturnos.com/';
const tools=['services.list','services.create','services.price','services.duration','services.details','services.publish','services.hide','customers.create','customers.update','customers.search','customers.history','schedule.read','schedule.day','schedule.absence','schedule.blocks','team.list','business.statistics'];
const reads=['services.list','customers.search','customers.history','schedule.read','schedule.blocks','team.list','business.statistics'];
function fixture(overrides={}){
 const audit={project:'https://djoxdtloqwbrhgtgencc.supabase.co',understanding:{automaticExecution:false},scope:{role:'owner',plan:'negocio'},reads,writes:tools.filter(id=>!reads.includes(id)),fieldRestrictions:{'customers.update':['notes']},publicDemo:{writes:[]}};
 return {...{
  'index.html':'<div id="root"></div><script type="module" crossorigin src="./assets/index-current.js"></script>',
  'runtime-config.js':'window.ATRY_CONFIG='+JSON.stringify({backend:'supabase',supabaseUrl:audit.project,supabaseKey:'sb_publishable_test'})+';',
  'react-assets.json':JSON.stringify(['/index.html','/assets/index-current.js','/iatry-operational-audit.js']),
  'assets/index-current.js':'const app="React production entry";',
  'iatry-operational-audit.js':'globalThis.ATRY_IATRY_BUILD=Object.freeze('+JSON.stringify(audit)+');\n',
 },...overrides};
}
async function run(files){const calls=[];const result=await probe(async(url)=>{calls.push(String(url));const key=String(url).replace(base,'');return {ok:key in files,status:key in files?200:404,url:String(url),async text(){return files[key]||'missing';}};});return {result,calls};}
test('React hashed entry discovered from HTML and manifest; no obsolete control-center or backend request',async()=>{
 const {result,calls}=await run(fixture());assert.ok(result.results.every(r=>r.status==='http_confirmed'));assert.equal(result.auth,'unknown');assert.equal(result.database,'unknown');assert.ok(calls.includes(base+'assets/index-current.js'));assert.ok(!calls.some(x=>x.includes('control-center')||x.includes('supabase.co')));
});
test('changed hashed entry follows the current HTML rather than a fixed bundle name',async()=>{
 const f=fixture();f['index.html']=f['index.html'].replaceAll('index-current','index-new');f['react-assets.json']=f['react-assets.json'].replaceAll('index-current','index-new');f['assets/index-new.js']=f['assets/index-current.js'];delete f['assets/index-current.js'];const {result}=await run(f);assert.ok(result.results.every(r=>r.status==='http_confirmed'));
});
test('missing bundle, manifest mismatch, wrong project, privileged key and scope changes fail closed',async()=>{
 const changes=[{'iatry-operational-audit.js':fixture()['iatry-operational-audit.js'].replace('schedule.blocks','bookings.create')},{'assets/index-current.js':'<html>fallback</html>'},{'react-assets.json':'["/index.html"]'},{'runtime-config.js':fixture()['runtime-config.js'].replace('djoxdtloqwbrhgtgencc','another-project')},{'runtime-config.js':fixture()['runtime-config.js'].replace('sb_publishable_test','sb_secret_not-allowed')},{'iatry-operational-audit.js':fixture()['iatry-operational-audit.js'].replace('"negocio"','"pro"')},{'iatry-operational-audit.js':fixture()['iatry-operational-audit.js'].replace('["notes"]','["notes","email"]')}];
 for(const change of changes){const {result}=await run(fixture(change));assert.ok(result.results.some(r=>r.status==='error'));}
 const f=fixture();delete f['assets/index-current.js'];const {result}=await run(f);assert.ok(result.results.some(r=>r.code==='HTTP_404'));
});
test('external module URLs are rejected before requesting them; downloaded metadata is never executed',async()=>{
 const {result,calls}=await run(fixture({'index.html':'<script type="module" src="https://untrusted.test/code.js"></script>','runtime-config.js':'window.ATRY_CONFIG=(()=>{throw Error("executed")})();'}));assert.ok(result.results.some(r=>r.code==='UNSAFE_ASSET'));assert.ok(!calls.some(x=>x.includes('untrusted')));assert.ok(result.results.some(r=>r.component==='runtime-config.js'&&r.status==='error'));
});
test('redirect outside canonical domain is rejected',async()=>{
 const result=await probe(async()=>({ok:true,status:200,url:'https://untrusted.test/',text:async()=>''}));assert.ok(result.results.every(r=>r.code==='WRONG_DOMAIN'));
});
