'use strict';
const fs=require('node:fs/promises');const path=require('node:path');
const nodemailer=require('nodemailer');
const {id,now,hashToken,transaction}=require('./db');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const defaults={confirmations:1,cancellations:1,reschedules:1,reminders:1,waitlist:1,reminder_hours:24,business_alerts:1};
const subjects={confirmed:'Reserva confirmada',pending:'Reserva pendiente de confirmación',cancelled:'Reserva cancelada',completed:'Servicio completado',no_show:'Reserva marcada como ausencia',reprogramado:'Reserva reprogramada',waitlist_offer:'Se liberó una oportunidad para reservar',reminder:'Recordatorio de tu turno'};
function preferences(db,businessId){return {...defaults,...db.prepare('SELECT * FROM notification_preferences WHERE business_id=?').get(businessId)};}
function enqueue(db,{key,businessId=null,source='system',sourceId='',kind,recipient,subject,content,scheduled=now()}){
 const jobId=id();db.prepare('INSERT OR IGNORE INTO mail_jobs(id,dedupe_key,business_id,source,source_id,kind,recipient,subject,content,next_attempt_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').run(jobId,key,businessId,source,sourceId,kind,recipient,subjects[kind]||subject,content,scheduled,now(),now());
 return db.prepare('SELECT id FROM mail_jobs WHERE dedupe_key=?').get(key).id;
}
function template(job,publicUrl){
 const base=publicUrl.replace(/\/$/,'');const content=job.content.replace(/\/#[/]([A-Za-z0-9/_-]+)/g,`${base}/#/$1`);
 const link=content.match(/https?:\/\/[^\s]+/)?.[0]?.replace(/[.,;]+$/,'');
 return {text:`ATRY TURNOS\n\n${job.subject}\n\n${content}\n\nMensaje transaccional de Atry Turnos.`,html:`<!doctype html><html lang="es"><body style="margin:0;background:#f5f7f7;font-family:Arial,sans-serif;color:#10191d"><main style="max-width:560px;margin:32px auto;background:white;border:1px solid #dfe7e9;border-radius:20px;overflow:hidden"><header style="padding:26px;background:#071a21;color:white;letter-spacing:2px">ATRY <span style="color:#10bde1">TURNOS</span></header><div style="padding:30px"><h1 style="font-size:24px">${esc(job.subject)}</h1><p style="line-height:1.7;white-space:pre-line">${esc(content)}</p>${link?`<p><a href="${esc(link)}" style="display:inline-block;background:#007fae;color:white;padding:14px 20px;border-radius:12px;text-decoration:none">Abrir enlace seguro</a></p>`:''}<hr style="border:0;border-top:1px solid #dfe7e9"><p style="font-size:12px;color:#526971">Mensaje transaccional de Atry Turnos. No compartas enlaces privados.</p></div></main></body></html>`};
}
function createProvider(env=process.env){
 const mode=env.MAIL_PROVIDER||(env.NODE_ENV==='production'?'disabled':'local');
 if(!['local','smtp','disabled'].includes(mode))throw new Error('MAIL_PROVIDER debe ser local, smtp o disabled');
 if(mode==='disabled')return {mode,async send(){throw Object.assign(new Error('Mail disabled'),{code:'MAIL_DISABLED'});}};
 if(mode==='local'){
  if(env.NODE_ENV==='production')throw new Error('El proveedor local de correo no está habilitado en producción');
  const folder=path.resolve(env.MAIL_LOCAL_DIR||'data/mail');const transport=nodemailer.createTransport({streamTransport:true,buffer:true,newline:'windows'});
  return {mode,async send(job,message){const result=await transport.sendMail(message);await fs.mkdir(folder,{recursive:true});await fs.writeFile(path.join(folder,job.id+'.eml'),result.message);return {state:'stored_local',id:job.id};}};
 }
 if(!env.SMTP_HOST||!env.MAIL_FROM)throw new Error('SMTP requiere SMTP_HOST y MAIL_FROM');
 const port=Number(env.SMTP_PORT||587);if(!Number.isInteger(port)||port<1||port>65535)throw new Error('SMTP_PORT inválido');
 const transport=nodemailer.createTransport({host:env.SMTP_HOST,port,secure:env.SMTP_SECURE==='1',requireTLS:env.NODE_ENV==='production'||env.SMTP_REQUIRE_TLS!=='0',auth:env.SMTP_USER?{user:env.SMTP_USER,pass:env.SMTP_PASSWORD}:undefined,connectionTimeout:10000,greetingTimeout:10000,socketTimeout:20000,disableFileAccess:true,disableUrlAccess:true});
 return {mode,async send(job,message){const result=await transport.sendMail(message);if(!result.accepted?.length)throw Object.assign(new Error('Recipient rejected'),{code:'RECIPIENT_REJECTED'});return {state:'smtp_accepted',id:result.messageId};}};
}
function shouldDeliver(db,job){
 if(job.business_id){
  const p=preferences(db,job.business_id);const category=({confirmed:'confirmations',pending:'confirmations',cancelled:'cancellations',reprogramado:'reschedules',waitlist_offer:'waitlist',reminder:'reminders',business_alert:'business_alerts'})[job.kind];if(category&&p[category]===0)return false;
 }
 const token=job.content.match(/\/#\/(?:invitacion|restablecer|oferta)\/([A-Za-z0-9_-]+)/)?.[1];
 if(token){const hash=hashToken(token);if(job.kind==='invitation')return !!db.prepare('SELECT id FROM invitations WHERE token_hash=? AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at>?').get(hash,now());
  if(job.kind==='password_reset')return !!db.prepare('SELECT user_id FROM password_resets WHERE token_hash=? AND used_at IS NULL AND expires_at>?').get(hash,now());
  if(job.kind==='waitlist_offer')return !!db.prepare("SELECT id FROM waitlist WHERE offer_token_hash=? AND status='offered' AND offer_expires_at>?").get(hash,now());
 }
 if(job.kind==='reminder'){const booking=db.prepare('SELECT * FROM bookings WHERE id=?').get(job.source_id);if(!booking||!['confirmed','pending'].includes(booking.status)||booking.starts_at<=now())return false;if(job.dedupe_key!==`reminder:${booking.id}:${booking.starts_at}`)return false;}
 return true;
}
function ingest(db){
 transaction(db,()=>{
  db.prepare("UPDATE waitlist SET status='waiting',offer_token_hash=NULL,offer_expires_at=NULL WHERE status='offered' AND offer_expires_at<?").run(now());
  for(const n of db.prepare("SELECT n.* FROM notifications n WHERE state='queued' AND NOT EXISTS(SELECT 1 FROM mail_jobs j WHERE j.source='notification' AND j.source_id=n.id) LIMIT 500").all()){
   if(n.recipient)enqueue(db,{key:'notification:'+n.id,businessId:n.business_id,source:'notification',sourceId:n.id,kind:n.kind,recipient:n.recipient,subject:n.subject,content:n.content});else db.prepare("UPDATE notifications SET state='internal_only' WHERE id=?").run(n.id);
   if(['confirmed','pending','cancelled','reprogramado','no_show'].includes(n.kind)&&preferences(db,n.business_id).business_alerts){const booking=db.prepare('SELECT b.starts_at,c.name customer_name,s.name service_name,bu.email,bu.name business_name FROM bookings b JOIN customers c ON c.id=b.customer_id JOIN services s ON s.id=b.service_id JOIN businesses bu ON bu.id=b.business_id WHERE b.id=?').get(n.booking_id);if(booking?.email)enqueue(db,{key:'business-alert:'+n.id,businessId:n.business_id,source:'business_alert',sourceId:n.id,kind:'business_alert',recipient:booking.email,subject:'Actualización de agenda · '+booking.business_name,content:`${subjects[n.kind]||n.kind}: ${booking.customer_name}, ${booking.service_name}, ${new Intl.DateTimeFormat('es-UY',{timeZone:'America/Montevideo',dateStyle:'medium',timeStyle:'short'}).format(new Date(booking.starts_at))}. Revisá el panel en /#/app/agenda.`});}
  }
  for(const n of db.prepare("SELECT n.* FROM system_outbox n WHERE state='queued' AND NOT EXISTS(SELECT 1 FROM mail_jobs j WHERE j.source='outbox' AND j.source_id=n.id) LIMIT 500").all()){
   const token=n.content.match(/invitacion\/([A-Za-z0-9_-]+)/)?.[1];const businessId=token?db.prepare('SELECT business_id FROM invitations WHERE token_hash=?').get(hashToken(token))?.business_id:null;
   enqueue(db,{key:'outbox:'+n.id,businessId:businessId||null,source:'outbox',sourceId:n.id,kind:n.kind,recipient:n.recipient,subject:n.kind==='invitation'?'Invitación a tu equipo':'Recuperá el acceso a tu cuenta',content:n.content});
  }
  for(const b of db.prepare("SELECT b.*,c.email,c.name,s.name service_name FROM bookings b JOIN customers c ON c.id=b.customer_id JOIN services s ON s.id=b.service_id WHERE b.status IN ('confirmed','pending') AND b.starts_at>? AND c.email!='' AND NOT EXISTS(SELECT 1 FROM mail_jobs j WHERE j.dedupe_key='reminder:'||b.id||':'||b.starts_at) LIMIT 500").all(now())){
   const p=preferences(db,b.business_id);if(!p.reminders)continue;
   const scheduled=new Date(Date.parse(b.starts_at)-p.reminder_hours*3600000).toISOString();const date=new Intl.DateTimeFormat('es-UY',{timeZone:'America/Montevideo',dateStyle:'medium',timeStyle:'short'}).format(new Date(b.starts_at));
   enqueue(db,{key:`reminder:${b.id}:${b.starts_at}`,businessId:b.business_id,source:'reminder',sourceId:b.id,kind:'reminder',recipient:b.email,subject:'Recordatorio de tu turno',content:`Hola ${b.name}. Tu reserva de ${b.service_name} es el ${date} (Uruguay).`,scheduled});
  }
 });
}
function createWorker(db,{provider=createProvider(),env=process.env,clock=()=>Date.now(),maxAttempts=5}={}){
 let running=false;
 async function tick(){if(running)return {busy:true};running=true;try{
  ingest(db);const current=new Date(clock()).toISOString();
  db.prepare("UPDATE mail_jobs SET state='retry',lease_until=NULL WHERE state='processing' AND lease_until<?").run(current);
  if(provider.mode==='disabled')return {provider:'disabled',processed:0};
  let processed=0;
  for(let i=0;i<20;i++){
   const job=transaction(db,()=>{const candidate=db.prepare("SELECT * FROM mail_jobs WHERE state IN ('queued','retry') AND next_attempt_at<=? ORDER BY next_attempt_at,created_at LIMIT 1").get(current);if(!candidate)return null;db.prepare("UPDATE mail_jobs SET state='processing',lease_until=?,attempts=attempts+1,updated_at=? WHERE id=?").run(new Date(clock()+60000).toISOString(),current,candidate.id);return {...candidate,attempts:candidate.attempts+1};});if(!job)break;
   let state,providerId=null,error=null,next=current;
   if(!shouldDeliver(db,job))state='skipped';
   else try{const result=await provider.send(job,{from:env.MAIL_FROM||'Atry Turnos <no-reply@atryturnos.test>',to:job.recipient,subject:job.subject,messageId:`<${job.id}@atryturnos.local>`,...template(job,env.PUBLIC_URL||'http://localhost:3300'),disableFileAccess:true,disableUrlAccess:true});if(!['stored_local','smtp_accepted'].includes(result.state))throw Object.assign(new Error('Invalid provider response'),{code:'INVALID_PROVIDER_RESPONSE'});state=result.state;providerId=result.id;}
   catch(e){error=String(e.code||'PROVIDER_ERROR').replace(/[^A-Z0-9_-]/gi,'').slice(0,80);state=job.attempts>=maxAttempts?'failed':'retry';next=new Date(clock()+Math.min(3600000,30000*2**(job.attempts-1))).toISOString();}
   transaction(db,()=>{db.prepare('UPDATE mail_jobs SET state=?,provider_id=?,last_error=?,next_attempt_at=?,lease_until=NULL,updated_at=? WHERE id=?').run(state,providerId,error,next,new Date(clock()).toISOString(),job.id);if(['stored_local','smtp_accepted','skipped','failed'].includes(state)){if(job.source==='notification')db.prepare('UPDATE notifications SET state=? WHERE id=?').run(state,job.source_id);if(job.source==='outbox')db.prepare('UPDATE system_outbox SET state=? WHERE id=?').run(state,job.source_id);}});processed++;
  }return {provider:provider.mode,processed};
 }finally{running=false;}}
 return {tick,provider:provider.mode,start({keepAlive=false}={}){const interval=setInterval(()=>tick().catch(e=>console.error('Mail worker:',e.code||'WORKER_ERROR')),Number(env.MAIL_INTERVAL_MS)||5000);if(!keepAlive)interval.unref();tick().catch(e=>console.error('Mail worker:',e.code||'WORKER_ERROR'));return ()=>clearInterval(interval);}};
}
module.exports={enqueue,preferences,template,createProvider,createWorker,ingest,shouldDeliver};
