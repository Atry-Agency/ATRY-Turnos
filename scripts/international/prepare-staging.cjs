'use strict';
// Offline preparation only: no env inspection, credential access, child processes or network.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function prepare(destination){const dest=destination?path.resolve(destination):fs.mkdtempSync(path.join(os.tmpdir(),'atry-staging-'));if(destination)fs.mkdirSync(dest,{recursive:false});const copy=(source,target)=>{const to=path.join(dest,target);fs.mkdirSync(path.dirname(to),{recursive:true});fs.copyFileSync(path.join(root,source),to)};
const regional=JSON.parse(fs.readFileSync(path.join(root,'docs/international/effective/candidate-manifest.json'),'utf8')).migrations;
if(regional.length!==6)throw Error('Expected exactly six reviewed regional migrations');const names=fs.readdirSync(path.join(root,'supabase/migrations')).filter(n=>/^\d+_.*\.sql$/.test(n)&&n<=[...regional].map(x=>x.file).sort().at(-1)).sort(),manifest=[];
for(const file of names){const bytes=fs.readFileSync(path.join(root,'supabase/migrations',file)),hash=sha(bytes),r=regional.find(x=>x.file===file);if(r&&r.sha256!==hash)throw Error('Reviewed regional migration changed: '+file);const phase=file<'202611130001'?'baseline':'regional';if(phase==='regional'&&!r)throw Error('Unreviewed regional migration: '+file);manifest.push({file,sha256:hash,phase});copy('supabase/migrations/'+file,'candidate/supabase/migrations/'+file);if(phase==='baseline')copy('supabase/migrations/'+file,'baseline/supabase/migrations/'+file)}
for(const phase of ['baseline','candidate'])copy('supabase/config.toml',phase+'/supabase/config.toml');
for(const folder of ['_shared','atry-public','atry-mail','atry-mail-events'])for(const file of fs.readdirSync(path.join(root,'supabase/functions',folder)))if(fs.statSync(path.join(root,'supabase/functions',folder,file)).isFile())copy('supabase/functions/'+folder+'/'+file,'candidate/supabase/functions/'+folder+'/'+file);
for(const file of ['regional-preflight.sql','regional-staging-check.sql'])copy('supabase/operations/'+file,'checks/'+file);
for(const file of ['EJECUCION.md','CONFIGURACION.md','CASOS.md','RECUPERACION.md','environment.example','authorization.example.json'])copy('docs/international/staging/'+file,file);
fs.writeFileSync(path.join(dest,'manifest.json'),JSON.stringify({remoteExecuted:false,authorization:false,productionRefForbidden:'djoxdtloqwbrhgtgencc',baseline:manifest.filter(x=>x.phase==='baseline').length,regional:regional.length,migrations:manifest},null,2)+'\n');
fs.writeFileSync(path.join(dest,'README.txt'),'OFFLINE PACKAGE ONLY. No remote operation is authorized by generating this directory. Start with EJECUCION.md. No seed, credentials, Auth users, production data or linked project state included.\n');return dest;}
if(require.main===module)console.log(prepare(process.argv[2]));module.exports={prepare};
