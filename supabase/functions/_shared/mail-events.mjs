// Brevo supports a bearer authentication header. No email, IP or payload body is stored.
export function createMailEvents(config,{fetchImpl=fetch}={}){
 return async req=>{
  if(config.enabled!=='1'||!config.secret||config.secret.length<32)return Response.json({error:'RECEIPTS_DISABLED'},{status:503});
  if(req.method!=='POST')return Response.json({error:'METHOD_NOT_ALLOWED'},{status:405});
  if(req.headers.get('authorization')!==`Bearer ${config.secret}`)return Response.json({error:'FORBIDDEN'},{status:403});
  if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(config.url||'')||!config.serviceKey)return Response.json({error:'NOT_CONFIGURED'},{status:503});
  try{
   const raw=await req.text();if(new TextEncoder().encode(raw).length>64000)return Response.json({error:'TOO_LARGE'},{status:413});const body=JSON.parse(raw),events=Array.isArray(body)?body:[body];if(events.length>50)return Response.json({error:'TOO_MANY_EVENTS'},{status:400});
   let accepted=0;
   for(const event of events){
    const kinds={delivered:'delivered',hard_bounce:'hard_bounce',hardBounce:'hard_bounce',soft_bounce:'soft_bounce',softBounce:'soft_bounce',blocked:'blocked',invalid:'invalid',request:'sent',sent:'sent',deferred:'deferred'},kind=kinds[event.event],messageId=event['message-id'],timestamp=Number(event.ts_event??event.ts);
    if(!kind||typeof messageId!=='string'||!messageId||!Number.isFinite(timestamp))return Response.json({error:'INVALID_EVENT'},{status:400});
    const eventTime=new Date(timestamp*1000).toISOString(),identity=JSON.stringify([messageId,kind,timestamp,event.id??null]);const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(identity));const eventId=Array.from(new Uint8Array(digest),x=>x.toString(16).padStart(2,'0')).join('');
    const response=await fetchImpl(config.url+'/rest/v1/rpc/atry_record_mail_receipt',{method:'POST',headers:{apikey:config.serviceKey,authorization:`Bearer ${config.serviceKey}`,'content-type':'application/json'},body:JSON.stringify({event_id:eventId,message_id:messageId,event_kind:kind,event_time:eventTime}),signal:AbortSignal.timeout(15000)});
    if(!response.ok)return Response.json({error:'RECEIPT_STORAGE_FAILED'},{status:503});accepted++;
   }
   return Response.json({accepted});
  }catch{return Response.json({error:'INVALID_OR_UNAVAILABLE'},{status:400});}
 };
}
