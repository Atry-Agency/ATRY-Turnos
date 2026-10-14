'use strict';
const fs=require('node:fs'),{createClient}=require('@supabase/supabase-js');
async function main(){
 const filename=process.argv[2];if(!/^data\/cloud-private\/(integration|modules)-[a-f0-9-]+\.json$/.test(filename||''))throw new Error('FIXTURE_MANIFEST_REQUIRED');
 const manifest=JSON.parse(fs.readFileSync(filename,'utf8')),config=JSON.parse(fs.readFileSync('data/cloud-private/connection.json','utf8'));
 if(manifest.project!=='djoxdtloqwbrhgtgencc'||config.url!=='https://djoxdtloqwbrhgtgencc.supabase.co')throw new Error('TARGET_MISMATCH');
 const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}},admin=createClient(config.url,config.serverKey,options);
 for(const user of manifest.users){
  const found=await admin.auth.admin.getUserById(user.id);
  if(found.error||found.data.user.user_metadata.atry_test_run!==manifest.run)throw new Error('TEST_IDENTITY_SCOPE_MISMATCH');
  const actor=createClient(config.url,config.publicKey,options);const signed=await actor.auth.signInWithPassword({email:user.email,password:user.password});if(signed.error)throw new Error('TEST_LOGIN_FAILED');
  const profile=await actor.rpc('atry_me');if(profile.error||profile.data.user!==null||profile.data.businesses.length!==0)throw new Error('APP_FIXTURES_MUST_BE_REMOVED_FIRST');
  const removed=await admin.auth.admin.deleteUser(user.id);if(removed.error)throw new Error('AUTH_CLEANUP_FAILED');delete user.password;user.removed=true;
  fs.writeFileSync(filename,JSON.stringify(manifest,null,2));
 }
 const remaining=await admin.auth.admin.listUsers({perPage:1000});if(remaining.error)throw new Error('AUTH_AUDIT_FAILED');
 manifest.cleaned=true;fs.writeFileSync(filename,JSON.stringify(manifest,null,2));console.log(JSON.stringify({project:manifest.project,fixturesRemoved:manifest.users.length,remainingAuthUsers:remaining.data.users.length}));
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
