'use strict';
// HTTP transport shared by local verification; serverless worker can use fetch directly.
function createBrevo({apiKey,senderEmail,senderName='Atry Turnos',fetchImpl=fetch}){
 if(!apiKey||!senderEmail)throw new Error('Brevo requiere configuración segura de clave y remitente');
 return {mode:'brevo',async send(job,message){
  const domain=String(job.recipient).split('@').at(-1)?.toLowerCase();
  if(!domain||['example.com','example.net','example.org'].includes(domain)||/\.(test|invalid|example|localhost)$/.test(domain))throw Object.assign(new Error('Destinatario de prueba bloqueado'),{code:'TEST_RECIPIENT_BLOCKED'});
  const response=await fetchImpl('https://api.brevo.com/v3/smtp/email',{method:'POST',headers:{'api-key':apiKey,'content-type':'application/json','accept':'application/json'},signal:AbortSignal.timeout(20000),body:JSON.stringify({sender:{email:senderEmail,name:senderName},to:[{email:job.recipient}],subject:job.subject,htmlContent:message.html,textContent:message.text,headers:{'X-Atry-Job':job.id},tags:['atry-turnos']})});
  if(!response.ok)throw Object.assign(new Error('Brevo rechazó la solicitud'),{code:response.status===429?'BREVO_QUOTA':`BREVO_HTTP_${response.status}`});
  const body=await response.json();if(typeof body.messageId!=='string'||!body.messageId)throw Object.assign(new Error('Brevo sin confirmación'),{code:'BREVO_MISSING_ID'});
  return {state:'provider_accepted',id:body.messageId};
 }};
}
module.exports={createBrevo};
