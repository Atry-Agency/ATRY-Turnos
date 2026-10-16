export function createMailWorker(config,{fetchImpl=fetch,now=Date.now}={}){
 const json=(status,body)=>Response.json(body,{status});
 return async req=>{
  const invocationKey=config.invocationKey||config.serviceKey;
  if(!config.serviceKey||!invocationKey||req.headers.get('authorization')!==`Bearer ${invocationKey}`)return json(403,{error:'FORBIDDEN'});
  if(req.method!=='POST')return json(405,{error:'METHOD_NOT_ALLOWED'});
  if(config.enabled!=='1')return json(503,{error:'DELIVERY_DISABLED'});
  const validSite=/^https:\/\/[a-z0-9-]+\.pages\.dev\/?$/.test(config.siteUrl||'')||/^https:\/\/atry-agency\.github\.io\/ATRY-Turnos\/?$/.test(config.siteUrl||'');
  if(!config.apiKey||!config.sender||config.senderVerified!=='1'||!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(config.url||'')||!validSite)return json(503,{error:'PROVIDER_NOT_CONFIGURED'});
  const rpc=async(name,body)=>{const r=await fetchImpl(`${config.url}/rest/v1/rpc/${name}`,{method:'POST',headers:{apikey:config.serviceKey,authorization:`Bearer ${config.serviceKey}`,'content-type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(15000)});if(!r.ok)throw new Error('DATABASE_ERROR');return r.json();};
  let processed=0,accepted=0,unknown=0;const deadline=now()+85000;
  try{
   if(config.telemetry)await rpc('atry_control_worker',{phase:'start'});
   await rpc('atry_mail_ingest',{});
   // Claim immediately before each send so other jobs cannot lose their lease while waiting.
   while(processed<10&&now()<deadline){
    const jobs=await rpc('atry_mail_claim',{batch_size:1});if(!jobs.length)break;
    const job=jobs[0];let providerId=null,errorCode=null;
    try{
     const r=await fetchImpl('https://api.brevo.com/v3/smtp/email',{method:'POST',headers:{'api-key':config.apiKey,'content-type':'application/json'},body:JSON.stringify({sender:{email:config.sender,name:'Atry Turnos'},to:[{email:job.recipient}],subject:job.subject,textContent:String(job.content||'').replaceAll('/#/',config.siteUrl.replace(/\/$/,'')+'/#/'),tags:['atry-turnos'],headers:{idempotencyKey:job.id,'X-Atry-Job':job.id}}),signal:AbortSignal.timeout(20000)});
     if(r.ok){const body=await r.json();providerId=typeof body.messageId==='string'&&body.messageId.trim()?body.messageId:null;if(!providerId)errorCode='PROVIDER_CONNECTION_ERROR';}
     else{const body=await r.json().catch(()=>({}));errorCode=body.code==='duplicate_parameter'?'BREVO_DUPLICATE_UNKNOWN':r.status===429?'BREVO_QUOTA':r.status>=500?'BREVO_HTTP_503':`BREVO_HTTP_${r.status}`;}
    }catch{errorCode='PROVIDER_CONNECTION_ERROR';}
    const acknowledged=await rpc('atry_mail_result',{job_id:job.id,expected_attempt:job.attempts,provider_id:providerId,error_code:errorCode});
    if(acknowledged!==true)throw new Error('LEASE_NOT_ACKNOWLEDGED');
    processed++;if(providerId)accepted++;if(['PROVIDER_CONNECTION_ERROR','BREVO_DUPLICATE_UNKNOWN','BREVO_HTTP_503'].includes(errorCode))unknown++;
   }
   if(config.telemetry)await rpc('atry_control_worker',{phase:'finish',outcome:'ok'});
   return json(200,{processed,provider_accepted:accepted,delivery_unknown:unknown});
  }catch{if(config.telemetry)try{await rpc('atry_control_worker',{phase:'finish',outcome:'error'});}catch{}return json(503,{error:'WORKER_ERROR',processed,provider_accepted:accepted,delivery_unknown:unknown});}
 };
}
