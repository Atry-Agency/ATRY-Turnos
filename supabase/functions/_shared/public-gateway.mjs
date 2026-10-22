import {createProof} from './proof.mjs';
// Bearer links travel in POST bodies, never query strings.
export function createPublicHandler({supabaseUrl,serviceKey,siteUrl,turnstileSecret,protectionMode='turnstile',fetchImpl=fetch}){
 const proof=serviceKey?createProof({secret:serviceKey}):null;
 const reply=(status,body,origin='')=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json','cache-control':'no-store',...(origin?{'access-control-allow-origin':origin,'vary':'Origin','access-control-allow-methods':'GET, POST, OPTIONS','access-control-allow-headers':'content-type, apikey, authorization, x-client-info'}:{})}});
 const reject=(status,code)=>Object.assign(new Error(code),{status,code});
 const rpc=async(name,args)=>{
  const r=await fetchImpl(`${supabaseUrl}/rest/v1/rpc/${name}`,{method:'POST',headers:{apikey:serviceKey,authorization:`Bearer ${serviceKey}`,'content-type':'application/json'},body:JSON.stringify(args),signal:AbortSignal.timeout(15000)});
  if(!r.ok){let error;try{error=await r.json();}catch{}
   if(r.status===401||r.status===403)throw reject(403,'FORBIDDEN');
   if(error?.code==='23P01'||error?.code==='23505')throw reject(409,'BOOKING_CONFLICT');
   if(error?.code==='P0001'&&/^[A-Z0-9_]{1,64}$/.test(error.message||''))throw reject(['NOT_AVAILABLE','INVALID_TOKEN'].includes(error.message)?404:409,error.message);
   if(['22P02','22007','22008','23514','23503'].includes(error?.code))throw reject(400,'INVALID_INPUT');
   throw reject(503,'PUBLIC_OPERATION_FAILED');
  }return r.json();
 };
 const readBody=async req=>{
  const reader=req.body?.getReader();if(!reader)throw reject(400,'EMPTY_BODY');let text='',size=0;const decoder=new TextDecoder();
  for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>8192){await reader.cancel();throw reject(413,'REQUEST_TOO_LARGE');}text+=decoder.decode(value,{stream:true});}text+=decoder.decode();
  let payload;try{payload=JSON.parse(text);}catch{throw reject(400,'INVALID_JSON');}
  if(!payload||typeof payload!=='object'||Array.isArray(payload))throw reject(400,'INVALID_JSON');return payload;
 };
 const operations=['info','availability','book','waitlist','manage','manage_availability','cancel','reschedule','offer','accept_offer','invitation','challenge','visit_availability','visit_book','visit_manage_availability'];
 return async req=>{
  let expectedOrigin;try{expectedOrigin=new URL(siteUrl).origin;}catch{return reply(503,{error:'PUBLIC_NOT_CONFIGURED'});}
  if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(supabaseUrl||'')||!serviceKey||!['turnstile','proof'].includes(protectionMode)||(protectionMode==='turnstile'&&!turnstileSecret)||!expectedOrigin.startsWith('https://'))return reply(503,{error:'PUBLIC_NOT_CONFIGURED'});
  const origin=req.headers.get('origin');if(origin!==expectedOrigin)return reply(403,{error:'ORIGIN_REJECTED'});
  if(req.method==='OPTIONS')return reply(200,{ok:true},origin);
  const url=new URL(req.url),slug=url.searchParams.get('slug'),operation=url.searchParams.get('operation');
  if(!operations.includes(operation)||url.searchParams.has('token'))return reply(400,{error:'INVALID_REQUEST'},origin);
  const businessOperation=['info','availability','book','waitlist','visit_availability','visit_book'].includes(operation);
  if(businessOperation&&!/^[a-z0-9][a-z0-9-]{1,53}[a-z0-9]$/.test(slug||''))return reply(400,{error:'INVALID_REQUEST'},origin);
  if(req.method!==(['info','availability'].includes(operation)?'GET':'POST'))return reply(405,{error:'METHOD_NOT_ALLOWED'},origin);
  try{
   // Supabase's gateway puts the client first; later hops rotate between invocations.
   // Header limits supplement the signed challenge; they do not prove a human visitor.
   const ip=(req.headers.get('x-forwarded-for')||'unknown').split(',')[0].trim();
   const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(serviceKey),{name:'HMAC',hash:'SHA-256'},false,['sign']);
   const hashed=[...new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode('atry-rate-v1:'+ip)))].map(x=>x.toString(16).padStart(2,'0')).join('');
   if(!await rpc('atry_public_rate',{key_hash:hashed,request_scope:operation+':'+(businessOperation||operation==='challenge'?slug||'private-link':'private-link')}))return reply(429,{error:'PUBLIC_RATE_LIMIT'},origin);
   if(operation==='info')return reply(200,await rpc('atry_public_info',{slug}),origin);
   if(operation==='availability'){
    const day=url.searchParams.get('date'),service_id=url.searchParams.get('service_id'),staff_id=url.searchParams.get('staff_id')||null;
    if(!/^\d{4}-\d{2}-\d{2}$/.test(day||'')||!service_id||service_id.length>100||(staff_id&&staff_id.length>100))return reply(400,{error:'INVALID_AVAILABILITY'},origin);
    return reply(200,await rpc('atry_public_availability',{slug,service_id,day,staff_id}),origin);
   }
   const payload=await readBody(req),token=payload.token;
   if(operation==='challenge'){
    if(protectionMode!=='proof'||!['booking','waitlist','offer'].includes(payload.action)||!/^[A-Za-z0-9_-]{16,100}$/.test(payload.key||'')||(payload.action!=='offer'&&!/^[a-z0-9][a-z0-9-]{1,53}[a-z0-9]$/.test(slug||'')))throw reject(400,'INVALID_CHALLENGE');
    return reply(200,await proof.issue({ip:hashed,action:payload.action,key:payload.key,slug:slug||''}),origin);
   }
   if(!businessOperation&&(typeof token!=='string'||!/^[A-Za-z0-9_-]{32,100}$/.test(token)))throw reject(400,'INVALID_TOKEN');
   if(['book','visit_book','waitlist','accept_offer'].includes(operation)){
    const action=['book','visit_book'].includes(operation)?'booking':operation==='waitlist'?'waitlist':'offer';
    if(typeof payload.idempotency_key!=='string'||!/^[A-Za-z0-9_-]{16,100}$/.test(payload.idempotency_key))throw reject(400,'INVALID_REQUEST');
    if(protectionMode==='proof'){
     if(!await proof.verify(payload.proof_challenge,payload.proof_counter,{ip:hashed,action,key:payload.idempotency_key,slug:slug||''}))throw reject(403,'PROTECTION_REJECTED');
    }else{
    if(typeof payload.turnstile_token!=='string'||payload.turnstile_token.length>2048||typeof payload.idempotency_key!=='string'||!/^[A-Za-z0-9_-]{16,100}$/.test(payload.idempotency_key))throw reject(400,'CAPTCHA_REQUIRED');
    const verification=await fetchImpl('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({secret:turnstileSecret,response:payload.turnstile_token}),signal:AbortSignal.timeout(15000)});
    if(!verification.ok)throw reject(503,'CAPTCHA_PROVIDER_ERROR');const result=await verification.json();
    if(result.success!==true||result.hostname!==new URL(siteUrl).hostname||result.action!==action||result.cdata!==payload.idempotency_key)throw reject(403,'CAPTCHA_REJECTED');
    }
   }
   const {turnstile_token,proof_challenge,proof_counter,token:ignoredToken,...data}=payload;
   if(operation==='visit_availability')return reply(200,await rpc('atry_public_visit_availability',{slug,payload:data}),origin);
   if(operation==='visit_book')return reply(200,await rpc('atry_public_visit_book',{slug,payload:data}),origin);
   if(operation==='visit_manage_availability')return reply(200,await rpc('atry_manage_visit_availability',{token,payload:data}),origin);
   if(operation==='book')return reply(200,await rpc('atry_public_book',{slug,payload:data}),origin);
   if(operation==='waitlist')return reply(200,await rpc('atry_public_waitlist',{slug,payload:data}),origin);
   if(operation==='manage')return reply(200,await rpc('atry_manage',{token}),origin);
   if(operation==='manage_availability'){
    if(!/^\d{4}-\d{2}-\d{2}$/.test(data.date||''))throw reject(400,'INVALID_DATE');
    return reply(200,await rpc('atry_manage_availability',{token,day:data.date}),origin);
   }
   if(operation==='cancel'||operation==='reschedule')return reply(200,await rpc('atry_manage_change',{token,operation,payload:data}),origin);
   if(operation==='offer')return reply(200,await rpc('atry_offer',{token}),origin);
   if(operation==='accept_offer')return reply(200,await rpc('atry_accept_offer',{token,payload:data}),origin);
   if(operation==='invitation')return reply(200,await rpc('atry_invitation',{token}),origin);
  }catch(e){return reply(e.status||503,{error:e.code||'PUBLIC_OPERATION_FAILED'},origin);}
 };
}
