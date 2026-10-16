'use strict';
const {id,now,randomToken,hashToken,passwordHash,transaction}=require('./db');
const {fail,isDate,available,createBooking,checkSlot}=require('./booking');
function register({r,db,auth,authorized,string,isEmail,record}){
 r('GET','/api/offers/([A-Za-z0-9_-]+)',({params})=>{
  const w=db.prepare("SELECT w.*,b.name business_name,s.name service_name FROM waitlist w JOIN businesses b ON b.id=w.business_id JOIN services s ON s.id=w.service_id WHERE offer_token_hash=? AND w.status='offered' AND offer_expires_at>?").get(hashToken(params[0]),now());if(!w)fail(404,'Oferta vencida o no disponible');
  require('./commercial').requireFeature(db,w.business_id,'waitlist');checkSlot(db,w.business_id,w.offer_staff_id,w.service_id,w.offer_starts_at);return {business_name:w.business_name,service_name:w.service_name,starts_at:w.offer_starts_at,expires_at:w.offer_expires_at};
 });
 r('POST','/api/offers/([A-Za-z0-9_-]+)/accept',({params,body})=>{
  if(body.accept_policy!==true)fail(400,'Aceptá la política de reservas');
  return transaction(db,()=>{
   const key=body.idempotency_key,scope='offer:'+hashToken(params[0]);
   if(key!==undefined){if(typeof key!=='string'||!/^[A-Za-z0-9_-]{16,100}$/.test(key))fail(400,'Clave de idempotencia inválida');const previous=db.prepare('SELECT response FROM idempotency_keys WHERE scope=? AND key_hash=?').get(scope,hashToken(key));if(previous)return JSON.parse(previous.response);}
   const w=db.prepare("SELECT * FROM waitlist WHERE offer_token_hash=? AND status='offered' AND offer_expires_at>?").get(hashToken(params[0]),now());if(!w)fail(409,'Oferta vencida o ya utilizada');
   require('./commercial').requireFeature(db,w.business_id,'waitlist');const booked=createBooking(db,{business_id:w.business_id,service_id:w.service_id,staff_id:w.offer_staff_id,starts_at:w.offer_starts_at,customer_name:w.customer_name,customer_email:w.customer_email,customer_phone:w.customer_phone},{withinTransaction:true});
   db.prepare("UPDATE waitlist SET status='booked',offer_token_hash=NULL WHERE id=?").run(w.id);if(key!==undefined)db.prepare('INSERT INTO idempotency_keys VALUES(?,?,?,?,?)').run(scope,hashToken(key),hashToken('accepted'),JSON.stringify(booked),now());return booked;
  });
 });
 const recoveryLimits=new Map();
 r('POST','/api/auth/forgot-password',({req,body})=>{
  const key=req.socket.remoteAddress||'local',entry=recoveryLimits.get(key)||{count:0,until:Date.now()+900000};
  if(entry.until<Date.now()){entry.count=0;entry.until=Date.now()+900000;}if(++entry.count>5)fail(429,'Esperá unos minutos antes de volver a solicitarlo');recoveryLimits.set(key,entry);
  const email=string(body.email,150).toLowerCase();if(!isEmail(email))fail(400,'Ingresá un correo válido');
  const user=db.prepare('SELECT id FROM users WHERE email=?').get(email);
  if(user)transaction(db,()=>{const token=randomToken();db.prepare('DELETE FROM password_resets WHERE user_id=?').run(user.id);db.prepare('INSERT INTO password_resets VALUES(?,?,?,?,?)').run(hashToken(token),user.id,new Date(Date.now()+1800000).toISOString(),null,now());db.prepare('INSERT INTO system_outbox(id,kind,recipient,content,created_at) VALUES(?,?,?,?,?)').run(id(),'password_reset',email,`/#/restablecer/${token}`,now());});
  return {message:'Si existe una cuenta, la solicitud quedó registrada en la cola de correo. En desarrollo los mensajes se guardan en el buzón local; SMTP requiere configuración.',delivery:'queued'};
 });
 r('POST','/api/auth/reset-password',({body})=>{
  const password=String(body.password||'');if(password.length<10||password.length>128)fail(400,'Usá entre 10 y 128 caracteres');
  return transaction(db,()=>{const reset=db.prepare('SELECT * FROM password_resets WHERE token_hash=? AND used_at IS NULL AND expires_at>?').get(hashToken(String(body.token||'')),now());if(!reset)fail(400,'Enlace inválido o vencido');db.prepare('UPDATE users SET password_hash=? WHERE id=?').run(passwordHash(password),reset.user_id);db.prepare('UPDATE password_resets SET used_at=? WHERE token_hash=?').run(now(),reset.token_hash);db.prepare('DELETE FROM sessions WHERE user_id=?').run(reset.user_id);return {ok:true};});
 });
 r('GET','/api/business/([A-Za-z0-9_-]+)/customers/([A-Za-z0-9_-]+)/history',({req,params})=>{
  authorized(req,params[0]);if(!db.prepare('SELECT id FROM customers WHERE business_id=? AND id=?').get(...params))fail(404,'Cliente no encontrado');
  return db.prepare('SELECT b.id,b.starts_at,b.status,b.price_uyu,s.name service_name,st.name staff_name FROM bookings b JOIN services s ON s.id=b.service_id JOIN staff st ON st.id=b.staff_id WHERE b.business_id=? AND b.customer_id=? ORDER BY b.starts_at DESC LIMIT 100').all(...params);
 });
 r('GET','/api/business/([A-Za-z0-9_-]+)/smartslots',({req,params,url})=>{
  const {biz}=authorized(req,params[0]);const date=url.searchParams.get('date');if(!isDate(date))fail(400,'Fecha inválida');const services=db.prepare('SELECT id,name FROM services WHERE business_id=? AND active=1').all(biz.id);
  return {date,method:'Disponibilidad validada por el motor; hasta tres alternativas por servicio',suggestions:services.flatMap(s=>available(db,biz,s.id,date).slice(0,3).map(slot=>({...slot,service_id:s.id,service_name:s.name})))};
 });
 r('GET','/api/business/([A-Za-z0-9_-]+)/members',({req,params})=>{authorized(req,params[0],['owner']);return db.prepare('SELECT u.id,u.name,u.email,m.role FROM memberships m JOIN users u ON u.id=m.user_id WHERE m.business_id=? ORDER BY u.name').all(params[0]);});
 r('POST','/api/business/([A-Za-z0-9_-]+)/members',({req,params,body})=>{
  const {biz,user}=authorized(req,params[0],['owner']);const role=body.role;if(!['manager','staff'].includes(role))fail(400,'Rol inválido');
  const email=string(body.email,150).toLowerCase();const member=db.prepare('SELECT id FROM users WHERE email=?').get(email);if(!member)fail(404,'La persona debe tener una cuenta registrada antes de vincularla');
  return transaction(db,()=>{if(db.prepare('SELECT role FROM memberships WHERE business_id=? AND user_id=?').get(biz.id,member.id))fail(409,'La persona ya pertenece al negocio');
   if(role==='staff'){const staff=db.prepare('SELECT id,user_id FROM staff WHERE id=? AND business_id=?').get(body.staff_id,biz.id);if(!staff||staff.user_id)fail(409,'Elegí un profesional sin cuenta vinculada');db.prepare('UPDATE staff SET user_id=? WHERE id=?').run(member.id,staff.id);}
   db.prepare('INSERT INTO memberships(user_id,business_id,role) VALUES(?,?,?)').run(member.id,biz.id,role);record(biz.id,user.id,'member.added','user',member.id);return {ok:true};});
 });
 r('GET','/api/admin/operations',({req})=>{if(!auth(req).platform_admin)fail(403,'Solo administración Atry');return {organizations:db.prepare('SELECT count(*) n FROM businesses').get().n,queued_notifications:db.prepare("SELECT count(*) n FROM notifications WHERE state='queued'").get().n,integrations:{email:process.env.MAIL_PROVIDER||(process.env.NODE_ENV==='production'?'disabled':'local'),mercado_pago:'Sin credenciales ni cobros',whatsapp:'Pendiente de integración oficial'},audit:db.prepare('SELECT action,entity,created_at FROM audit_log ORDER BY created_at DESC LIMIT 30').all()};});
}
module.exports={register};
