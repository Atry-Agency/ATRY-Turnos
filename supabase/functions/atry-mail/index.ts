// Serverless invocation. Disabled until a real sender and provider are validated.
const json=(status:number,body:unknown)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}});
Deno.serve(async(req:Request)=>{
 const serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
 if(!serviceKey||req.headers.get('authorization')!==`Bearer ${serviceKey}`)return json(403,{error:'FORBIDDEN'});
 if(req.method!=='POST')return json(405,{error:'METHOD_NOT_ALLOWED'});
 if(Deno.env.get('MAIL_DELIVERY_ENABLED')!=='1')return json(503,{error:'DELIVERY_DISABLED'});
 const apiKey=Deno.env.get('BREVO_API_KEY'),sender=Deno.env.get('BREVO_SENDER_EMAIL'),url=Deno.env.get('SUPABASE_URL');
 if(!apiKey||!sender||!url)return json(503,{error:'PROVIDER_NOT_CONFIGURED'});
 const rpc=async(name:string,body:unknown)=>{const r=await fetch(`${url}/rest/v1/rpc/${name}`,{method:'POST',headers:{apikey:serviceKey,authorization:`Bearer ${serviceKey}`,'content-type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(20000)});if(!r.ok)throw new Error('DATABASE_ERROR');return r.json();};
 try{
  const jobs=await rpc('atry_mail_claim',{batch_size:10});let accepted=0;
  for(const job of jobs){let providerId=null,errorCode=null;
   try{const r=await fetch('https://api.brevo.com/v3/smtp/email',{method:'POST',headers:{'api-key':apiKey,'content-type':'application/json'},body:JSON.stringify({sender:{email:sender,name:'Atry Turnos'},to:[{email:job.recipient}],subject:job.subject,textContent:job.content,tags:['atry-turnos'],headers:{'X-Atry-Job':job.id}}),signal:AbortSignal.timeout(20000)});if(!r.ok){errorCode=r.status===429?'BREVO_QUOTA':`BREVO_HTTP_${r.status}`;}else{const body=await r.json();providerId=typeof body.messageId==='string'?body.messageId:null;if(!providerId)errorCode='BREVO_MISSING_ID';}}
   catch{errorCode='PROVIDER_CONNECTION_ERROR';}
   await rpc('atry_mail_result',{job_id:job.id,expected_attempt:job.attempts,provider_id:providerId,error_code:errorCode});if(providerId)accepted++;
  }
  return json(200,{processed:jobs.length,provider_accepted:accepted});
 }catch{return json(503,{error:'WORKER_ERROR'});}
});
