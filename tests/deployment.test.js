'use strict';const test=require('node:test'),assert=require('node:assert/strict');const {config}=require('../scripts/build-pages');
test('GitHub Pages: publica los recursos de la interfaz y bloquea solicitudes de datos en preview',async()=>{
 const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),vm=require('node:vm');
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'atry-pages-'));
 try{
  require('../scripts/build-github-preview').build(dir);
  const html=fs.readFileSync(path.join(dir,'index.html'),'utf8');
  assert.match(html,/backend:"preview"/);
  for(const match of html.matchAll(/(?:src|href)="\.\/([^"?#]+)(?:\?[^"#]*)?"/g))assert.ok(fs.existsSync(path.join(dir,match[1])),match[1]);
  for(const name of ['server','data','.env','supabase','README.md'])assert.equal(fs.existsSync(path.join(dir,name)),false,name);
  const js=fs.readFileSync(path.join(dir,'app.js'),'utf8');
  const fn=js.slice(js.indexOf('async function api('),js.indexOf('const post='));
  let calls=0;
  const context=vm.createContext({window:{ATRY_CONFIG:{backend:'preview'}},fetch:()=>{calls++;throw new Error('No debe llamarse');}});
  vm.runInContext(fn,context);
  await assert.rejects(context.api('/api/auth/login',{method:'POST',body:'{}'}),/conexión online/);
  assert.equal(calls,0);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('Pages: rechaza secretos y bloquea publicación antes de validar equivalencia',()=>{const base={PUBLIC_SUPABASE_URL:'https://project.supabase.co',PUBLIC_SUPABASE_KEY:'sb_publishable_test'};assert.throws(()=>config(base),/equivalencia/);assert.throws(()=>config({...base,PUBLIC_SUPABASE_KEY:'sb_secret_secret',CLOUD_BACKEND_VALIDATED:'1'}),/pública/);const jwt='eyJx.'+Buffer.from(JSON.stringify({role:'service_role'})).toString('base64url')+'.signature';assert.throws(()=>config({...base,PUBLIC_SUPABASE_KEY:jwt,CLOUD_BACKEND_VALIDATED:'1'}),/privilegiada/);assert.equal(config({...base,CLOUD_BACKEND_VALIDATED:'1'}).backend,'supabase');});
