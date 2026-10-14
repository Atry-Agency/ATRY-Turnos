'use strict';
// Staged transport. Not enabled in the web until the full API has verified parity.
// Uses Supabase Auth's documented REST API; no legacy password hashes or cookies.
function createAuthTransport({url,publicKey,fetchImpl=fetch,clock=Date.now}){
 if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url||'')||!/^sb_publishable_/.test(publicKey||''))throw new Error('Se requiere URL Supabase y clave pública publishable');
 let session=null,refreshing=null,generation=0;
 const error=(status,code)=>Object.assign(new Error(code),{status,code});
 async function request(path,body,token,method='POST'){
  let response;try{response=await fetchImpl(url+path,{method,headers:{apikey:publicKey,...(token?{authorization:'Bearer '+token}:{}),...(body!==undefined?{'content-type':'application/json'}:{})},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(20000)});}catch{throw error(503,'CONNECTION_ERROR');}
  if(!response.ok)throw error(response.status,response.status===429?'AUTH_RATE_LIMIT':response.status===401||response.status===400?'AUTH_REJECTED':'AUTH_PROVIDER_ERROR');
  if(response.status===204)return {ok:true};return response.json();
 }
 function accept(body){if(typeof body.access_token!=='string'||typeof body.refresh_token!=='string'||!Number.isFinite(Number(body.expires_in)))throw error(502,'INVALID_AUTH_RESPONSE');session={accessToken:body.access_token,refreshToken:body.refresh_token,expiresAt:clock()+Number(body.expires_in)*1000};}
 async function refresh(){
  if(refreshing)return refreshing;if(!session)throw error(401,'SIGN_IN_REQUIRED');const version=generation,token=session.refreshToken;
  refreshing=(async()=>{try{const body=await request('/auth/v1/token?grant_type=refresh_token',{refresh_token:token});if(version!==generation)throw error(401,'SESSION_CHANGED');accept(body);}catch(e){if(version===generation&&e.status!==503)session=null;throw e;}finally{refreshing=null;}})();return refreshing;
 }
 return {
  async signIn(email,password){generation++;const version=generation;session=null;const body=await request('/auth/v1/token?grant_type=password',{email,password});if(version!==generation)throw error(401,'SESSION_CHANGED');accept(body);return {ok:true};},
  async signUp(name,email,password){if(String(name||'').trim().length<2||String(password||'').length<10)throw error(400,'INVALID_REGISTRATION');const body=await request('/auth/v1/signup',{email,password,data:{name}});return {requiresEmailVerification:!body.access_token};},
  async user(){if(!session)throw error(401,'SIGN_IN_REQUIRED');if(session.expiresAt<=clock()+30000)await refresh();return request('/auth/v1/user',undefined,session.accessToken,'GET');},
  async rpc(name,args={}){if(!/^atry_[a-z_]+$/.test(name))throw error(400,'INVALID_RPC');if(!session)throw error(401,'SIGN_IN_REQUIRED');if(session.expiresAt<=clock()+30000)await refresh();try{return await request('/rest/v1/rpc/'+name,args,session.accessToken);}catch(e){if(e.status!==401)throw e;await refresh();return request('/rest/v1/rpc/'+name,args,session.accessToken);}},
  async signOut(){const token=session?.accessToken;generation++;session=null;if(token)await request('/auth/v1/logout?scope=local',{},token);return {ok:true};},
  hasSession(){return session!==null;}
 };
}
module.exports={createAuthTransport};
