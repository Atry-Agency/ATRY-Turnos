'use strict';
const fs=require('node:fs'),{createClient}=require('@supabase/supabase-js');
async function main(){
 const config=JSON.parse(fs.readFileSync('data/cloud-private/connection.json','utf8'));
 if(config.url!=='https://djoxdtloqwbrhgtgencc.supabase.co')throw new Error('TARGET_MISMATCH');
 const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:async(url,options)=>{const response=await fetch(url,options);console.log(JSON.stringify({path:new URL(url).pathname,status:response.status}));return response;}}};
 const admin=createClient(config.url,config.serverKey,options),guest=createClient(config.url,config.publicKey,options);
 const users=await admin.auth.admin.listUsers({page:1,perPage:1});if(users.error)throw new Error('AUTH_ADMIN_'+users.error.status);
 const forbidden=await guest.rpc('atry_create_organization',{payload:{name:'Intento anónimo',slug:'anon-forbidden'}});
 if(!forbidden.error)throw new Error('ANON_WRITE_WAS_NOT_BLOCKED');
 const publicInfo=await admin.rpc('atry_public_info',{slug:'nonexistent-connection-check'});
 if(publicInfo.error?.code!=='P0001')throw new Error('PUBLIC_RPC_'+(publicInfo.error?.code||'UNEXPECTED_RESPONSE'));
 console.log(JSON.stringify({project:'djoxdtloqwbrhgtgencc',authConnected:true,usersReturned:users.data.users.length,publicRpcConnected:true,anonymousOrganizationWriteBlocked:true}));
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
