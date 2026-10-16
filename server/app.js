'use strict';
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {connect,id,now,hashToken,randomToken,passwordHash,verifyPassword,transaction,audit}=require('./db');
const {HttpError,fail,isDate,asMinutes,localISO,localDay,localHM,isLive,available,createBooking,updateBooking}=require('./booking');
const root=path.join(__dirname,'../web');
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon','.json':'application/json; charset=utf-8','.webmanifest':'application/manifest+json'};
const string=(val,max=200)=>String(val??'').trim().slice(0,max);
const integer=(val,min,max,name)=>{let n=Number(val);if(!Number.isInteger(n)||n<min||n>max)fail(400,`${name} debe estar entre ${min} y ${max}`);return n;};
const isEmail=e=>/^\S+@\S+\.\S+$/.test(e) && e.length<=150;
const clamp=(n,min,max)=>Math.min(max,Math.max(min,n));
const slugify=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,55);
function send(res,status,obj,headers={}){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...headers});res.end(JSON.stringify(obj));}
function cookie(req,key){return (req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(key+'='))?.slice(key.length+1)||'';}
function readBody(req){return new Promise((resolve,reject)=>{let out='',size=0;req.on('data',ch=>{size+=ch.length;if(size>150_000){reject(new HttpError(413,'Solicitud demasiado grande'));req.destroy();return;}out+=ch;});req.on('end',()=>{try{resolve(out?JSON.parse(out):{});}catch{reject(new HttpError(400,'JSON inválido'));}});req.on('error',reject);});}
function route(method,pattern,handler){return {method,regex:new RegExp('^'+pattern+'$'),handler};}
function createApp({db=connect(),webRoot=root}={}) {
  const routes=[];const r=(method,pattern,fn)=>routes.push(route(method,pattern,fn));
  const cookieHeader=(value,req,maxAge)=>`atry_session=${value}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${maxAge}; ${((req.headers['x-forwarded-proto']==='https')||process.env.NODE_ENV==='production')?'Secure; ':''}`;
  function user(req){
    const token=cookie(req,'atry_session'); if(!token)return null;
    return db.prepare('SELECT u.id,u.name,u.email,u.platform_admin FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?').get(hashToken(token),now())||null;
  }
  const auth=req=>{if(!req.user)fail(401,'Iniciá sesión para continuar');return req.user;};
  function authorized(req,businessId,roles=['owner','manager']){
    const u=auth(req);
    const biz=db.prepare('SELECT * FROM businesses WHERE id=?').get(businessId);
    if(!biz)fail(404,'Negocio no encontrado');
    const membership=db.prepare('SELECT role FROM memberships WHERE business_id=? AND user_id=?').get(businessId,u.id);
    if(!membership||!roles.includes(membership.role))fail(403,'No tenés permiso para esta acción');
    return {biz,role:membership.role,user:u};
  }
  const dataBusiness=b=>({id:b.id,slug:b.slug,name:b.name,sector:b.sector,description:b.description,phone:b.phone,email:b.email,address:b.address,city:b.city,primary_color:b.primary_color,logo_url:b.logo_url,onboarding_completed:b.onboarding_completed,timezone:b.timezone,min_notice_min:b.min_notice_min,max_days:b.max_days,cancel_notice_hours:b.cancel_notice_hours,slot_step_min:b.slot_step_min,auto_confirm:b.auto_confirm,plan:b.plan,subscription_status:b.subscription_status,paid_until:b.paid_until,subscription_started_at:b.subscription_started_at,trial_until:b.trial_until,is_active:b.is_active});
  function appointmentList(bizId,from,to){return db.prepare(`SELECT b.id,b.business_id,b.staff_id,b.service_id,b.starts_at,b.ends_at,b.status,b.source,b.recurring_id,b.occurrence_day,b.price_uyu,b.payment_status,b.notes,b.created_at, st.name staff_name,s.name service_name,c.id customer_id,c.name customer_name,c.phone customer_phone,c.email customer_email
    FROM bookings b JOIN staff st ON st.id=b.staff_id JOIN services s ON s.id=b.service_id JOIN customers c ON c.id=b.customer_id
    WHERE b.business_id=? AND b.starts_at>=? AND b.starts_at<? ORDER BY b.starts_at`).all(bizId,from,to);}
  const staffList=biz=>db.prepare('SELECT * FROM staff WHERE business_id=? ORDER BY created_at').all(biz);
  const serviceList=biz=>db.prepare('SELECT * FROM services WHERE business_id=? ORDER BY created_at').all(biz);
  const getBizFromSlug=slug=>{const b=db.prepare('SELECT * FROM businesses WHERE slug=?').get(slug);if(!b)fail(404,'No encontramos ese negocio');return b;};
  const record=(biz,userId,action,entity,entityId)=>audit(db,biz,userId,action,entity,entityId);

  r('GET','/api/health',()=>({status:'ok',app:'Atry Turnos',version:'1.2.0'}));
  r('GET','/api/config',()=>({app:'Atry Turnos',version:'1.2.0',currency:'UYU',timezone:'America/Montevideo',payments_live:false,mail_provider:process.env.MAIL_PROVIDER||(process.env.NODE_ENV==='production'?'disabled':'local'),automatic_email_live:process.env.MAIL_PROVIDER==='smtp',whatsapp_live:false,tax_status:require('./commercial').settings(db).tax_status,plans:['individual','negocio','pro'].map(code=>require('./commercial').plan(db,code))}));
  r('POST','/api/auth/register',async({req,body})=>{
    const email=string(body.email,150).toLowerCase(),name=string(body.name,100),password=String(body.password||'');
    const businessName=string(body.business_name,100),slug=slugify(body.slug||businessName);
    if(!isEmail(email)||name.length<2||businessName.length<2||password.length<10||password.length>128||slug.length<3)fail(400,'Verificá los datos. La contraseña debe tener al menos 10 caracteres.');
    const uid=id(),bid=id();
    transaction(db,()=>{
      if(db.prepare('SELECT id FROM users WHERE email=?').get(email))fail(409,'Este correo ya tiene una cuenta');
      if(db.prepare('SELECT id FROM businesses WHERE slug=?').get(slug))fail(409,'Ese enlace ya está en uso');
      db.prepare('INSERT INTO users(id,name,email,password_hash,created_at) VALUES(?,?,?,?,?)').run(uid,name,email,passwordHash(password),now());
      const trialUntil=new Date(Date.now()+14*86400000).toISOString();
      db.prepare('INSERT INTO businesses(id,slug,name,email,sector,trial_until,created_at) VALUES(?,?,?,?,?,?,?)').run(bid,slug,businessName,email,string(body.sector,100)||'General',trialUntil,now());
      db.prepare("INSERT INTO memberships(user_id,business_id,role) VALUES(?,?,'owner')").run(uid,bid);
      const sid=id();db.prepare('INSERT INTO staff(id,business_id,user_id,name,email,created_at) VALUES(?,?,?,?,?,?)').run(sid,bid,uid,name,email,now());
      const wk=db.prepare('INSERT INTO working_hours(staff_id,weekday,start_min,end_min) VALUES(?,?,?,?)');for(let d=1;d<=6;d++)wk.run(sid,d,9*60,18*60);
      db.prepare("UPDATE businesses SET subscription_status='pending',trial_until=? WHERE id=?").run(now(),bid);record(bid,uid,'business.created','business',bid);
    });
    return {business_id:bid,slug};
  });
  const loginAttempts=new Map();
  r('POST','/api/auth/login',({req,body,res})=>{
    const attemptKey=(req.socket.remoteAddress||'unknown')+':'+Math.floor(Date.now()/(15*60000));
    const attempts=loginAttempts.get(attemptKey)||0;if(attempts>=12)fail(429,'Demasiados intentos de acceso. Reintentá más tarde');
    const email=string(body.email,150).toLowerCase(),pwd=String(body.password||'');
    const found=db.prepare('SELECT * FROM users WHERE email=?').get(email);
    if(!found||!verifyPassword(pwd,found.password_hash)){if(loginAttempts.size>10000)loginAttempts.clear();loginAttempts.set(attemptKey,attempts+1);fail(401,'Correo o contraseña incorrectos');}
    loginAttempts.delete(attemptKey);
    const token=randomToken();
    db.prepare('INSERT INTO sessions(token_hash,user_id,expires_at,created_at) VALUES(?,?,?,?)').run(hashToken(token),found.id,new Date(Date.now()+7*86400000).toISOString(),now());
    res.setHeader('Set-Cookie',cookieHeader(token,req,7*86400));
    return {user:{id:found.id,name:found.name,email:found.email,platform_admin:found.platform_admin}};
  });
  r('POST','/api/auth/logout',({req,res})=>{
    const token=cookie(req,'atry_session');if(token)db.prepare('DELETE FROM sessions WHERE token_hash=?').run(hashToken(token));
    res.setHeader('Set-Cookie',cookieHeader('',req,0));return {ok:true};
  });
  r('GET','/api/auth/me',({req})=>{
    const u=auth(req);
    const businesses=db.prepare(`SELECT b.id,b.name,b.slug,b.plan,b.subscription_status,m.role FROM memberships m JOIN businesses b ON b.id=m.business_id WHERE m.user_id=?`).all(u.id);
    return {user:u,businesses};
  });

  r('GET','/api/public/([a-z0-9-]+)',({params})=>{
    const b=getBizFromSlug(params[0]);
    const services=serviceList(b.id).filter(x=>x.active).map(s=>({id:s.id,name:s.name,description:s.description,duration_min:s.duration_min,price_uyu:s.price_uyu,deposit_percent:s.deposit_percent}));
    const staff=staffList(b.id).filter(x=>x.active).map(s=>({id:s.id,name:s.name,service_ids:db.prepare('SELECT service_id FROM staff_services WHERE staff_id=?').all(s.id).map(x=>x.service_id)}));
    return {waitlist_enabled:require('./commercial').has(db,b.id,'waitlist'),operational_mail:require('./commercial').has(db,b.id,'operational_mail'),business:{id:b.id,name:b.name,slug:b.slug,sector:b.sector,description:b.description,city:b.city,address:b.address,phone:b.phone,primary_color:b.primary_color,logo_url:b.logo_url,min_notice_min:b.min_notice_min,max_days:b.max_days,cancel_notice_hours:b.cancel_notice_hours},services,staff,bookable:isLive(b)};
  });
  r('GET','/api/public/([a-z0-9-]+)/availability',({params,url})=>{
    const b=getBizFromSlug(params[0]);const date=url.searchParams.get('date'),service=url.searchParams.get('service_id'),staff=url.searchParams.get('staff_id')||null;
    if(!service||!date)fail(400,'Faltan datos de disponibilidad');
    return {date,slots:available(db,b,service,date,staff)};
  });
  r('POST','/api/public/([a-z0-9-]+)/book',({params,body})=>{
    const b=getBizFromSlug(params[0]);
    if(!isLive(b))fail(403,'Este negocio no acepta reservas en este momento');
    if(body.accept_policy!==true)fail(400,'Debés aceptar la política de reservas');
    return createBooking(db,{...body,business_id:b.id},{source:'public'});
  });
  r('POST','/api/public/([a-z0-9-]+)/waitlist',({params,body})=>{
    const biz=getBizFromSlug(params[0]);require('./commercial').requireFeature(db,biz.id,'waitlist');if(!isLive(biz))fail(403,'Este negocio no acepta solicitudes');
    const service=db.prepare('SELECT id FROM services WHERE id=? AND business_id=? AND active=1').get(body.service_id,biz.id);
    if(!service)fail(404,'Servicio no disponible');
    const date=string(body.desired_date,10);
    if(!isDate(date)||date<localDay(now())||date>localDay(new Date(Date.now()+biz.max_days*86400000).toISOString()))fail(400,'Fecha fuera de período');
    const name=string(body.customer_name,100),email=string(body.customer_email,150).toLowerCase();
    if(name.length<2||!isEmail(email)||body.accept_policy!==true)fail(400,'Ingresá un nombre y correo válidos y aceptá las condiciones');
    if(body.staff_id&&!db.prepare('SELECT id FROM staff WHERE id=? AND business_id=?').get(body.staff_id,biz.id))fail(400,'Profesional inválido');
    if(db.prepare("SELECT id FROM waitlist WHERE business_id=? AND service_id=? AND desired_date=? AND customer_email=? AND status IN ('waiting','offered')").get(biz.id,service.id,date,email))fail(409,'Ese correo ya está en la lista de espera para este servicio y día');
    const wid=id();db.prepare('INSERT INTO waitlist(id,business_id,service_id,staff_id,desired_date,customer_name,customer_email,customer_phone,created_at) VALUES(?,?,?,?,?,?,?,?,?)')
      .run(wid,biz.id,service.id,body.staff_id||null,date,name,email,string(body.customer_phone,35),now());
    return {id:wid,status:'waiting',message:'Solicitud agregada. No es una reserva confirmada.'};
  });
  r('GET','/api/manage/([A-Za-z0-9_-]+)',({params})=>{
    const b=db.prepare(`SELECT b.id,b.business_id,b.starts_at,b.ends_at,b.status,b.price_uyu,bu.name business_name,bu.slug business_slug,bu.cancel_notice_hours,s.name service_name,st.name staff_name,c.name customer_name FROM bookings b JOIN businesses bu ON bu.id=b.business_id JOIN services s ON s.id=b.service_id JOIN staff st ON st.id=b.staff_id JOIN customers c ON c.id=b.customer_id WHERE b.manage_token_hash=?`).get(hashToken(params[0]));
    if(!b)fail(404,'Enlace inválido o expirado');return b;
  });
  r('GET','/api/manage/([A-Za-z0-9_-]+)/availability',({params,url})=>{const b=db.prepare('SELECT * FROM bookings WHERE manage_token_hash=?').get(hashToken(params[0]));if(!b)fail(404,'Enlace privado no válido');if(!['pending','confirmed'].includes(b.status))fail(409,'El turno ya está finalizado');const biz=db.prepare('SELECT * FROM businesses WHERE id=?').get(b.business_id);if(Date.parse(b.starts_at)-Date.now()<biz.cancel_notice_hours*3600000)fail(409,'Se superó el plazo de reprogramación');return {slots:available(db,biz,b.service_id,url.searchParams.get('date'),b.staff_id)};});
  r('POST','/api/manage/([A-Za-z0-9_-]+)/cancel',({params})=>{
    const b=db.prepare('SELECT b.*, bu.cancel_notice_hours FROM bookings b JOIN businesses bu ON bu.id=b.business_id WHERE b.manage_token_hash=?').get(hashToken(params[0]));
    if(!b)fail(404,'No encontramos ese turno');
    if(b.status==='cancelled')return {id:b.id,status:b.status,starts_at:b.starts_at,ends_at:b.ends_at};
    if(Date.parse(b.starts_at)-Date.now()<b.cancel_notice_hours*3600000)fail(409,'Se superó el plazo permitido para cancelar en línea');
    const result=updateBooking(db,b.business_id,b.id,{status:'cancelled'});return {id:result.id,status:result.status,starts_at:result.starts_at,ends_at:result.ends_at};
  });
  r('POST','/api/manage/([A-Za-z0-9_-]+)/reschedule',({params,body})=>{
    const b=db.prepare('SELECT b.*,bu.cancel_notice_hours FROM bookings b JOIN businesses bu ON bu.id=b.business_id WHERE b.manage_token_hash=?').get(hashToken(params[0]));
    if(!b)fail(404,'No encontramos ese turno');
    if(Date.parse(b.starts_at)-Date.now()<b.cancel_notice_hours*3600000)fail(409,'Se superó el plazo de reprogramación');
    if(typeof body.starts_at!=='string')fail(400,'Elegí un nuevo horario');
    const biz=db.prepare('SELECT * FROM businesses WHERE id=?').get(b.business_id);
    require('./booking').checkSlot(db,b.business_id,body.staff_id||b.staff_id,b.service_id,body.starts_at,{ignoreBooking:b.id,enforceNotice:true});
    if(!isLive(biz))fail(403,'El negocio no admite nuevas reservas');
    const result=updateBooking(db,b.business_id,b.id,{starts_at:body.starts_at,staff_id:body.staff_id||b.staff_id});return {id:result.id,status:result.status,starts_at:result.starts_at,ends_at:result.ends_at};
  });

  r('GET','/api/business/([A-Za-z0-9_-]+)',({req,params})=>{const a=authorized(req,params[0],['owner','manager','staff']);return {...dataBusiness(a.biz),role:a.role,staff_id:db.prepare('SELECT id FROM staff WHERE business_id=? AND user_id=? AND active=1').get(a.biz.id,a.user.id)?.id||null,public_url:`/#/reservar/${a.biz.slug}`};});
  r('PATCH','/api/business/([A-Za-z0-9_-]+)',({req,params,body})=>{
    const {biz,user}=authorized(req,params[0],['owner','manager']);
    if(!isLive(biz))fail(403,'El acceso del negocio requiere habilitación o renovación de Atry');
    const editable={name:100,description:800,phone:35,email:150,address:180,city:100,sector:100,primary_color:30,logo_url:140000};
    const updates={};for(const [key,max] of Object.entries(editable))if(body[key]!==undefined)updates[key]=string(body[key],max);
    if(updates.name!==undefined&&updates.name.length<2)fail(400,'Nombre demasiado corto');
    if(updates.primary_color&&!/^#[0-9a-fA-F]{6}$/.test(updates.primary_color))fail(400,'Color inválido');
    if(updates.logo_url&&!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(updates.logo_url))fail(400,'El logo debe ser una imagen PNG, JPEG o WebP');
    if(body.onboarding_completed===1){if(!db.prepare('SELECT id FROM services WHERE business_id=? AND active=1').get(biz.id))fail(409,'Creá al menos un servicio antes de completar la configuración');updates.onboarding_completed=1;}
    for(const [key,min,max] of [['min_notice_min',0,10080],['max_days',1,365],['cancel_notice_hours',0,168],['slot_step_min',5,60],['auto_confirm',0,1]])if(body[key]!==undefined)updates[key]=integer(body[key],min,max,key);
    if(updates.slot_step_min && ![5,10,15,20,30,60].includes(updates.slot_step_min))fail(400,'Elegí un intervalo válido');
    if(Object.keys(updates).length){const keys=Object.keys(updates);db.prepare('UPDATE businesses SET '+keys.map(k=>k+'=?').join(',')+' WHERE id=?').run(...keys.map(k=>updates[k]),biz.id);record(biz.id,user.id,'business.updated','business',biz.id);}
    return dataBusiness(db.prepare('SELECT * FROM businesses WHERE id=?').get(biz.id));
  });
  r('GET','/api/business/([A-Za-z0-9_-]+)/services',({req,params})=>{authorized(req,params[0]);return serviceList(params[0]);});
  r('POST','/api/business/([A-Za-z0-9_-]+)/services',({req,params,body})=>{
    const {biz,user}=authorized(req,params[0],['owner','manager']);
    const name=string(body.name,100);if(name.length<2)fail(400,'Ingresá un servicio válido');
    const dur=integer(body.duration_min,5,720,'Duración'),price=integer(body.price_uyu,0,2000000,'Precio');
    const dep=integer(body.deposit_percent??0,0,100,'Seña');const before=integer(body.buffer_before_min??0,0,180,'Preparación');const after=integer(body.buffer_after_min??0,0,180,'Limpieza');
    const sid=id();db.prepare('INSERT INTO services(id,business_id,name,description,duration_min,price_uyu,deposit_percent,buffer_before_min,buffer_after_min,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)')
      .run(sid,biz.id,name,string(body.description,400),dur,price,dep,before,after,now());
    const assign=Array.isArray(body.staff_ids)?body.staff_ids:staffList(biz.id).filter(s=>s.active).map(s=>s.id);
    for(const stid of assign){if(db.prepare('SELECT id FROM staff WHERE id=? AND business_id=?').get(stid,biz.id))db.prepare('INSERT OR IGNORE INTO staff_services(staff_id,service_id) VALUES(?,?)').run(stid,sid);}
    record(biz.id,user.id,'service.created','service',sid);return db.prepare('SELECT * FROM services WHERE id=?').get(sid);
  });
  r('PATCH','/api/business/([A-Za-z0-9_-]+)/services/([A-Za-z0-9_-]+)',({req,params,body})=>{
    const {biz,user}=authorized(req,params[0],['owner','manager']);
    const service=db.prepare('SELECT * FROM services WHERE id=? AND business_id=?').get(params[1],biz.id);if(!service)fail(404,'Servicio inexistente');
    const fields={};for(const k of ['name','description'])if(body[k]!==undefined)fields[k]=string(body[k],k==='name'?100:400);
    for(const [k,min,max] of [['duration_min',5,720],['price_uyu',0,2000000],['deposit_percent',0,100],['buffer_before_min',0,180],['buffer_after_min',0,180],['active',0,1]])if(body[k]!==undefined)fields[k]=integer(body[k],min,max,k);
    // No se permite cambiar la duración si existe una reserva futura activa: preserva integridad de agenda.
    if(fields.duration_min!==undefined&&fields.duration_min!==service.duration_min&&db.prepare("SELECT id FROM bookings WHERE service_id=? AND status IN ('pending','confirmed') AND starts_at>? LIMIT 1").get(service.id,now()))fail(409,'Hay reservas futuras: creá otro servicio o finalizá las reservas antes de cambiar duración');
    if(fields.name!==undefined&&fields.name.length<2)fail(400,'Nombre inválido');
    const keys=Object.keys(fields);if(keys.length)db.prepare('UPDATE services SET '+keys.map(k=>`${k}=?`).join(',')+' WHERE id=?').run(...keys.map(k=>fields[k]),service.id);
    if(Array.isArray(body.staff_ids)){
      db.prepare('DELETE FROM staff_services WHERE service_id=?').run(service.id);
      for(const stid of body.staff_ids)if(db.prepare('SELECT id FROM staff WHERE id=? AND business_id=?').get(stid,biz.id))db.prepare('INSERT OR IGNORE INTO staff_services(staff_id,service_id) VALUES(?,?)').run(stid,service.id);
    }
    record(biz.id,user.id,'service.updated','service',service.id);return db.prepare('SELECT * FROM services WHERE id=?').get(service.id);
  });
  r('GET','/api/business/([A-Za-z0-9_-]+)/staff',({req,params})=>{authorized(req,params[0]);return staffList(params[0]).map(s=>({...s,service_ids:db.prepare('SELECT service_id FROM staff_services WHERE staff_id=?').all(s.id).map(x=>x.service_id)}));});
  r('POST','/api/business/([A-Za-z0-9_-]+)/staff',({req,params,body})=>{
    const {biz,user}=authorized(req,params[0],['owner','manager']);
    const name=string(body.name,100);if(name.length<2)fail(400,'Nombre inválido');
    const planLimit=db.prepare('SELECT staff_limit FROM plans WHERE code=?').get(biz.plan)?.staff_limit||1;
    const count=db.prepare('SELECT count(*) n FROM staff WHERE business_id=? AND active=1').get(biz.id).n;
    if(count>=planLimit)fail(403,`El plan ${biz.plan} admite hasta ${planLimit} profesionales activos`);
    const sid=id();db.prepare('INSERT INTO staff(id,business_id,name,email,created_at) VALUES(?,?,?,?,?)').run(sid,biz.id,name,string(body.email,150),now());
    for(let d=1;d<=6;d++)db.prepare('INSERT INTO working_hours(staff_id,weekday,start_min,end_min) VALUES(?,?,?,?)').run(sid,d,540,1080);
    const assign=Array.isArray(body.service_ids)?body.service_ids:serviceList(biz.id).filter(s=>s.active).map(s=>s.id);
    for(const serviceId of assign)if(db.prepare('SELECT id FROM services WHERE id=? AND business_id=?').get(serviceId,biz.id))db.prepare('INSERT OR IGNORE INTO staff_services(staff_id,service_id) VALUES(?,?)').run(sid,serviceId);
    record(biz.id,user.id,'staff.created','staff',sid);return db.prepare('SELECT * FROM staff WHERE id=?').get(sid);
  });
  r('PATCH','/api/business/([A-Za-z0-9_-]+)/staff/([A-Za-z0-9_-]+)',({req,params,body})=>{
    const {biz,user}=authorized(req,params[0],['owner','manager']);const s=db.prepare('SELECT * FROM staff WHERE id=? AND business_id=?').get(params[1],biz.id);if(!s)fail(404,'Profesional inexistente');
    const changes={};for(const k of ['name','email'])if(body[k]!==undefined)changes[k]=string(body[k],k==='name'?100:150);
    if(body.active!==undefined)changes.active=integer(body.active,0,1,'Estado');
    if(changes.active===0&&db.prepare("SELECT id FROM bookings WHERE staff_id=? AND starts_at>? AND status IN ('pending','confirmed') LIMIT 1").get(s.id,now()))fail(409,'El profesional tiene reservas futuras activas');
    if(changes.active===1&&!s.active){const planLimit=db.prepare('SELECT staff_limit FROM plans WHERE code=?').get(biz.plan)?.staff_limit||1;const count=db.prepare('SELECT count(*) n FROM staff WHERE business_id=? AND active=1').get(biz.id).n;if(count>=planLimit)fail(403,'El plan actual alcanzó su límite de profesionales');}
    const keys=Object.keys(changes);if(keys.length)db.prepare('UPDATE staff SET '+keys.map(k=>k+'=?').join(',')+' WHERE id=?').run(...keys.map(k=>changes[k]),s.id);
    if(Array.isArray(body.service_ids)){
      db.prepare('DELETE FROM staff_services WHERE staff_id=?').run(s.id);
      for(const sr of body.service_ids)if(db.prepare('SELECT id FROM services WHERE id=? AND business_id=?').get(sr,biz.id))db.prepare('INSERT OR IGNORE INTO staff_services(staff_id,service_id) VALUES(?,?)').run(s.id,sr);
    }
    record(biz.id,user.id,'staff.updated','staff',s.id);return db.prepare('SELECT * FROM staff WHERE id=?').get(s.id);
  });
  r('GET','/api/business/([A-Za-z0-9_-]+)/staff/([A-Za-z0-9_-]+)/hours',({req,params})=>{
    authorized(req,params[0]);if(!db.prepare('SELECT id FROM staff WHERE id=? AND business_id=?').get(params[1],params[0]))fail(404,'Profesional inexistente');
    return db.prepare('SELECT weekday,start_min,end_min FROM working_hours WHERE staff_id=? ORDER BY weekday').all(params[1]);
  });
  r('PUT','/api/business/([A-Za-z0-9_-]+)/staff/([A-Za-z0-9_-]+)/hours',({req,params,body})=>{
    const {biz,user}=authorized(req,params[0],['owner','manager']);if(!db.prepare('SELECT id FROM staff WHERE id=? AND business_id=?').get(params[1],biz.id))fail(404,'Profesional inexistente');
    if(!Array.isArray(body.hours)||body.hours.length>7)fail(400,'Ingresá una semana válida');
    const days=new Set();for(const h of body.hours){const day=integer(h.weekday,0,6,'Día'),start=integer(h.start_min,0,1439,'Inicio'),end=integer(h.end_min,1,1440,'Fin');if(days.has(day)||start>=end)fail(400,'Hay días duplicados u horarios inválidos');days.add(day);}
    transaction(db,()=>{
      // No permitir que un nuevo horario deje turnos futuros fuera de la jornada.
      const booked=db.prepare("SELECT starts_at,ends_at FROM bookings WHERE staff_id=? AND starts_at>? AND status IN ('pending','confirmed')").all(params[1],now());
      for(const appointment of booked){
        const localDate=new Date(Date.parse(appointment.starts_at)-3*3600000);
        const day=localDate.getUTCDay(),start=localDate.getUTCHours()*60+localDate.getUTCMinutes();
        const endDate=new Date(Date.parse(appointment.ends_at)-3*3600000),end=endDate.getUTCHours()*60+endDate.getUTCMinutes();
        const rule=body.hours.find(h=>h.weekday===day);
        if(!rule||start<rule.start_min||end>rule.end_min)fail(409,'La nueva jornada dejaría reservas futuras fuera del horario. Reprogramalas primero.');
      }
      db.prepare('DELETE FROM working_hours WHERE staff_id=?').run(params[1]);for(const h of body.hours)db.prepare('INSERT INTO working_hours(staff_id,weekday,start_min,end_min) VALUES(?,?,?,?)').run(params[1],h.weekday,h.start_min,h.end_min);record(biz.id,user.id,'staff.hours.updated','staff',params[1]);
    });
    return {ok:true};
  });
  r('GET','/api/business/([A-Za-z0-9_-]+)/time-off',({req,params})=>{authorized(req,params[0]);return db.prepare('SELECT t.*,s.name staff_name FROM time_off t JOIN staff s ON s.id=t.staff_id WHERE t.business_id=? ORDER BY starts_at DESC LIMIT 100').all(params[0]);});
  r('POST','/api/business/([A-Za-z0-9_-]+)/time-off',({req,params,body})=>{
    const {biz,user}=authorized(req,params[0],['owner','manager']);if(!db.prepare('SELECT id FROM staff WHERE id=? AND business_id=?').get(body.staff_id,biz.id))fail(404,'Profesional inexistente');
    const start=Date.parse(body.starts_at),end=Date.parse(body.ends_at);if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start)fail(400,'Intervalo inválido');
    const existing=db.prepare("SELECT id FROM bookings WHERE staff_id=? AND status IN ('pending','confirmed') AND blocked_from<? AND blocked_until>? LIMIT 1").get(body.staff_id,new Date(end).toISOString(),new Date(start).toISOString());
    if(existing)fail(409,'Hay reservas activas en ese período: reprogramalas antes');
    const tid=id();db.prepare('INSERT INTO time_off(id,business_id,staff_id,starts_at,ends_at,reason) VALUES(?,?,?,?,?,?)').run(tid,biz.id,body.staff_id,new Date(start).toISOString(),new Date(end).toISOString(),string(body.reason,250));record(biz.id,user.id,'time_off.created','time_off',tid);return {id:tid};
  });
  r('DELETE','/api/business/([A-Za-z0-9_-]+)/time-off/([A-Za-z0-9_-]+)',({req,params})=>{const {biz,user}=authorized(req,params[0],['owner','manager']);const d=db.prepare('DELETE FROM time_off WHERE id=? AND business_id=?').run(params[1],biz.id);if(!d.changes)fail(404,'Ausencia inexistente');record(biz.id,user.id,'time_off.deleted','time_off',params[1]);return {ok:true};});

  r('GET','/api/business/([A-Za-z0-9_-]+)/bookings',({req,params,url})=>{
    const a=authorized(req,params[0],['owner','manager','staff']);const date=url.searchParams.get('date')||localDay(now());if(!isDate(date))fail(400,'Fecha inválida');
    const days=integer(url.searchParams.get('days')||1,1,url.searchParams.get('calendar')==='month'?42:31,'Período');
    require('./recurring').expand(db,params[0],date,days);
    let items=appointmentList(params[0],localISO(date,0),localISO(date,1440*days));
    if(a.role==='staff'){const own=db.prepare('SELECT id FROM staff WHERE business_id=? AND user_id=?').get(a.biz.id,a.user.id);items=items.filter(x=>x.staff_id===own?.id);}
    return items;
  });

  r('GET','/api/business/([A-Za-z0-9_-]+)/recurring',({req,params})=>{authorized(req,params[0],['owner','manager']);return require('./recurring').list(db,params[0]);});
  r('POST','/api/business/([A-Za-z0-9_-]+)/recurring',({req,params,body})=>{const a=authorized(req,params[0],['owner','manager']);return require('./recurring').create(db,a.biz.id,body,a.user.id);});
  r('POST','/api/business/([A-Za-z0-9_-]+)/recurring/([A-Za-z0-9_-]+)/end',({req,params,body})=>{const a=authorized(req,params[0],['owner','manager']);return require('./recurring').end(db,a.biz.id,params[1],body.from_day,a.user.id);});
  r('POST','/api/business/([A-Za-z0-9_-]+)/bookings',({req,params,body})=>{const a=authorized(req,params[0],['owner','manager','staff']);if(a.role==='staff'&&!db.prepare('SELECT id FROM staff WHERE id=? AND business_id=? AND user_id=? AND active=1').get(body.staff_id||'',a.biz.id,a.user.id))fail(403,'Solo podés crear turnos en tu agenda');return createBooking(db,{...body,business_id:a.biz.id},{actorId:a.user.id,source:'manual',enforceNotice:false});});
  r('PATCH','/api/business/([A-Za-z0-9_-]+)/bookings/([A-Za-z0-9_-]+)',({req,params,body})=>{const a=authorized(req,params[0],['owner','manager','staff']);if(a.role==='staff'){const own=db.prepare('SELECT id FROM staff WHERE business_id=? AND user_id=? AND active=1').get(a.biz.id,a.user.id);const booking=db.prepare('SELECT staff_id FROM bookings WHERE id=? AND business_id=?').get(params[1],a.biz.id);if(!own||booking?.staff_id!==own.id||(body.staff_id&&body.staff_id!==own.id))fail(403,'Solo podés modificar turnos de tu agenda');}return updateBooking(db,a.biz.id,params[1],body,a.user.id);});
  r('GET','/api/business/([A-Za-z0-9_-]+)/waitlist',({req,params})=>{
    authorized(req,params[0]);return db.prepare(`SELECT w.*,s.name AS service_name,st.name AS staff_name FROM waitlist w JOIN services s ON s.id=w.service_id LEFT JOIN staff st ON st.id=w.staff_id WHERE w.business_id=? ORDER BY w.created_at DESC LIMIT 200`).all(params[0]);
  });
  r('PATCH','/api/business/([A-Za-z0-9_-]+)/waitlist/([A-Za-z0-9_-]+)',({req,params,body})=>{
    const {biz,user}=authorized(req,params[0],['owner','manager']);const item=db.prepare('SELECT id FROM waitlist WHERE id=? AND business_id=?').get(params[1],biz.id);if(!item)fail(404,'Solicitud no encontrada');
    if(!['waiting','offered','booked','cancelled'].includes(body.status))fail(400,'Estado inválido');
    db.prepare('UPDATE waitlist SET status=? WHERE id=?').run(body.status,item.id);record(biz.id,user.id,'waitlist.updated','waitlist',item.id);return {ok:true};
  });
  r('GET','/api/business/([A-Za-z0-9_-]+)/customers',({req,params,url})=>{
    authorized(req,params[0]);const q=string(url.searchParams.get('q'),80);
    const rows=db.prepare(`SELECT c.*, (SELECT COUNT(*) FROM bookings b WHERE b.customer_id=c.id AND b.status!='cancelled') visits FROM customers c WHERE c.business_id=? ORDER BY c.created_at DESC`).all(params[0]);
    const normalized=q.toLowerCase(),digits=require('./customers').digits(q);return rows.filter(c=>!q||[c.name,c.email,c.phone].some(v=>v.toLowerCase().includes(normalized))||(digits&&require('./customers').digits(c.phone).includes(digits))).sort((a,b)=>q?a.name.localeCompare(b.name):0).slice(0,100);
  });
  r('POST','/api/business/([A-Za-z0-9_-]+)/customers',({req,params,body})=>{const {biz,user}=authorized(req,params[0]);return require('./customers').save(db,biz.id,null,body,user.id);});
  r('PATCH','/api/business/([A-Za-z0-9_-]+)/customers/([A-Za-z0-9_-]+)',({req,params,body})=>{const {biz,user}=authorized(req,params[0]);return require('./customers').save(db,biz.id,params[1],body,user.id);});
  r('GET','/api/business/([A-Za-z0-9_-]+)/dashboard',({req,params})=>{
    const {biz}=authorized(req,params[0]);const today=localDay(now());const beginning=localISO(today,0),end=localISO(today,1440);
    require('./recurring').expand(db,biz.id,today,31);
    const todayBookings=appointmentList(biz.id,beginning,end);
    const totals=db.prepare(`SELECT COUNT(*) total, SUM(CASE WHEN status='completed' THEN price_uyu ELSE 0 END) completed_revenue, SUM(CASE WHEN status='cancelled' THEN 1 ELSE 0 END) cancelled, SUM(CASE WHEN status='no_show' THEN 1 ELSE 0 END) no_show FROM bookings WHERE business_id=? AND starts_at>=? AND starts_at<?`).get(biz.id,new Date(Date.now()-30*86400000).toISOString(),now());
    const next=db.prepare(`SELECT b.id,b.starts_at,b.status,c.name customer_name,s.name service_name,st.name staff_name FROM bookings b JOIN customers c ON c.id=b.customer_id JOIN services s ON s.id=b.service_id JOIN staff st ON st.id=b.staff_id WHERE b.business_id=? AND b.starts_at>=? AND b.status IN ('confirmed','pending') ORDER BY b.starts_at LIMIT 8`).all(biz.id,now());
    const daily=db.prepare(`SELECT substr(datetime(starts_at,'-3 hours'),1,10) day,COUNT(*) n FROM bookings WHERE business_id=? AND starts_at>=? AND starts_at<? AND status!='cancelled' GROUP BY day ORDER BY day`).all(biz.id,localISO(today,-6*1440),end);
    const insights=[];
    const queued=db.prepare("SELECT count(*) n FROM notifications WHERE business_id=? AND state='queued'").get(biz.id).n;
    if(queued)insights.push(`${queued} notificaciones esperan conexión a un proveedor de correo. No fueron enviadas.`);
    if((totals.cancelled||0)>2)insights.push(`Registraste ${totals.cancelled} cancelaciones en los últimos 30 días. Revisá tus políticas de confirmación.`);
    const firstService=db.prepare('SELECT id,name FROM services WHERE business_id=? AND active=1 ORDER BY duration_min LIMIT 1').get(biz.id);
    if(firstService){
      const nextDay=localDay(new Date(Date.now()+86400000).toISOString());
      const open=available(db,biz,firstService.id,nextDay);
      if(open.length)insights.push(`Mañana hay ${open.length} combinaciones de horario y profesional para ${firstService.name}. Compartí tu enlace de reservas.`);
    }
    if(!firstService)insights.push('Agregá tu primer servicio para comenzar a recibir reservas en línea.');
    return {today:todayBookings,today_count:todayBookings.length,upcoming:next,customers:db.prepare('SELECT count(*) n FROM customers WHERE business_id=?').get(biz.id).n,staff:db.prepare('SELECT count(*) n FROM staff WHERE business_id=? AND active=1').get(biz.id).n,services:db.prepare('SELECT count(*) n FROM services WHERE business_id=? AND active=1').get(biz.id).n,waitlist:db.prepare("SELECT count(*) n FROM waitlist WHERE business_id=? AND status IN ('waiting','offered')").get(biz.id).n,totals:{total:totals.total||0,completed_revenue:totals.completed_revenue||0,cancelled:totals.cancelled||0,no_show:totals.no_show||0},daily,insights};
  });
  r('GET','/api/business/([A-Za-z0-9_-]+)/notifications',({req,params})=>{authorized(req,params[0],['owner','manager']);return db.prepare('SELECT * FROM notifications WHERE business_id=? ORDER BY created_at DESC LIMIT 100').all(params[0]);});
  r('GET','/api/business/([A-Za-z0-9_-]+)/audit',({req,params})=>{authorized(req,params[0],['owner','manager']);return db.prepare('SELECT * FROM audit_log WHERE business_id=? ORDER BY created_at DESC LIMIT 80').all(params[0]);});
  r('GET','/api/business/([A-Za-z0-9_-]+)/export/bookings',({req,res,params})=>{
    authorized(req,params[0],['owner','manager']);
    const items=db.prepare(`SELECT b.starts_at,b.ends_at,b.status,s.name service,st.name professional,c.name customer,c.email,c.phone,b.price_uyu FROM bookings b JOIN services s ON s.id=b.service_id JOIN staff st ON st.id=b.staff_id JOIN customers c ON c.id=b.customer_id WHERE b.business_id=? ORDER BY b.starts_at`).all(params[0]);
    const field=x=>'"'+String(x??'').replace(/^[=+@-]/,"'").replace(/"/g,'""')+'"';
    const rows=[['Inicio UTC','Fin UTC','Estado','Servicio','Profesional','Cliente','Correo','Teléfono','Precio UYU'],...items.map(x=>Object.values(x))].map(x=>x.map(field).join(','));
    res.writeHead(200,{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="atry-turnos-reservas.csv"','Cache-Control':'no-store'});res.end('\uFEFF'+rows.join('\r\n'));return null;
  });
  r('GET','/api/admin/businesses',({req})=>{
    if(!auth(req).platform_admin)fail(403,'Solo administración Atry');
    return db.prepare(`SELECT b.id,b.name,b.slug,b.email,b.phone,b.plan,b.subscription_status,b.trial_until,b.paid_until,b.subscription_started_at,b.created_at,b.is_active,
    (SELECT COUNT(*) FROM bookings x WHERE x.business_id=b.id) bookings,
    (SELECT COUNT(*) FROM memberships m WHERE m.business_id=b.id) members FROM businesses b ORDER BY b.created_at DESC`).all().map(b=>({...b,active_staff:db.prepare('SELECT id,name FROM staff WHERE business_id=? AND active=1').all(b.id),phone:b.phone,license_history:db.prepare('SELECT * FROM subscription_events WHERE business_id=? ORDER BY created_at DESC').all(b.id).map(e=>({...e,after_state:JSON.parse(e.after_state),actor_name:db.prepare('SELECT name FROM users WHERE id=?').get(e.actor_id)?.name||'Atry'}))}));
  });
  r('PATCH','/api/admin/businesses/([A-Za-z0-9_-]+)',({req,params,body})=>{
    if(!auth(req).platform_admin)fail(403,'Solo administración Atry');
    const biz=db.prepare('SELECT * FROM businesses WHERE id=?').get(params[0]);if(!biz)fail(404,'Negocio inexistente');
    return require('./subscriptions').save(db,biz.id,body,req.user.id);
  });

  require('./product').register({r,db,auth,authorized,string,isEmail,record,dataBusiness});
  require('./accounts').register({r,db,auth,authorized,string,isEmail,record,dataBusiness});
  require('./communications').register({r,db,auth,authorized,string,isEmail,record,dataBusiness});
  require('./realtime').register({r,db,auth,authorized,string,isEmail,record,dataBusiness});
  require('./scheduling').register({r,db,auth,authorized,string,isEmail,record,dataBusiness});
  require('./operations').register({r,db,auth,authorized,string,isEmail,record,dataBusiness});
  require('./commercial').register({r,db,auth,authorized});
  const requestCounts=new Map();
  const handler=async(req,res)=>{
    try{
      const u=new URL(req.url,'http://local.atry');const pathname=decodeURIComponent(u.pathname);
      res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');res.setHeader('X-Frame-Options','DENY');
      res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; style-src-attr 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'");
      if(pathname.startsWith('/api/')){
        const ip=req.socket.remoteAddress||'unknown',bucket=Math.floor(Date.now()/60000),key=ip+':'+bucket;
        if(requestCounts.size>4000)requestCounts.clear();const hits=(requestCounts.get(key)||0)+1;requestCounts.set(key,hits);
        if(hits>240)fail(429,'Demasiadas solicitudes. Intentá nuevamente en un minuto');
        if(!['GET','HEAD','OPTIONS'].includes(req.method)){
          const origin=req.headers.origin;
          if(origin){let source;try{source=new URL(origin);}catch{fail(403,'Origen no autorizado');}
            const host=req.headers.host||'';
            if(source.host!==host && origin!==process.env.PUBLIC_URL)fail(403,'Origen no autorizado');}
        }
        const matched=routes.find(x=>x.method===req.method&&x.regex.test(pathname));
        if(!matched)fail(404,'Ruta API inexistente');
        req.user=user(req);
        const params=matched.regex.exec(pathname).slice(1),body=['POST','PATCH','PUT','DELETE'].includes(req.method)?await readBody(req):{};
        const gated=pathname.match(/^\/api\/business\/([A-Za-z0-9_-]+)\/(.*)$/);
        if(gated){
          const tail=gated[2],modules=[[/^smartslots(?:$|\/)/,'smartslots'],[/^resources(?:$|\/)|^services\/[^/]+\/resources$/,'resources'],[/^insights$/,'advanced'],[/^statistics$/,'statistics'],[/^export\//,'exports'],[/^recurring(?:$|\/)/,'recurring'],[/^waitlist(?:$|\/)/,'waitlist'],[/^(members|invitations)(?:$|\/)/,'access'],[/^(notifications|mail-jobs|notification-preferences)$/,'operational_mail']];
          const match=modules.find(([pattern])=>pattern.test(tail));
          const closing=req.method==='POST'&&/^recurring\/[^/]+\/end$/.test(tail);
          if(match&&!closing){authorized(req,gated[1],['owner','manager','staff']);require('./commercial').requireFeature(db,gated[1],match[1]);}
        }
        let result=await matched.handler({req,res,params,body,url:u,db});
        if(gated&&gated[2]==='scheduling'&&!require('./commercial').has(db,gated[1],'resources'))result={...result,resources:[],assignments:[]};
        if(gated&&gated[2]==='dashboard'&&!require('./commercial').has(db,gated[1],'statistics'))result={today:result.today,today_count:result.today_count,upcoming:result.upcoming,customers:result.customers,staff:result.staff,services:result.services,totals:{},daily:[],insights:[],waitlist:0};
        if(!res.writableEnded&&!res.headersSent)send(res,200,result===undefined?{ok:true}:result);
        return;
      }
      if(!['GET','HEAD'].includes(req.method))fail(405,'Método no permitido');
      const filepath=pathname==='/'?'/index.html':pathname;
      if(!['/index.html','/read-cache.js','/app.js','/features.js','/management.js','/recurring.js','/onboarding.js','/subscriptions.js','/commercial.js','/styles.css','/product.css','/favicon.svg','/manifest.webmanifest','/sw.js'].includes(filepath)&&!/^\/assets\/brand\/[a-zA-Z0-9.-]+\.(png|woff2|otf|ttf)$/.test(filepath))fail(404,'No encontramos esa página');
      const full=path.join(webRoot,filepath);
      const content=fs.readFileSync(full);
      res.writeHead(200,{'Content-Type':mime[path.extname(full)]||'application/octet-stream','Cache-Control':'no-cache'});
      if(req.method==='HEAD')res.end();else res.end(content);
    }catch(e){
      if(/FEATURE_DISABLED|STAFF_LIMIT/.test(e.message||''))e=new HttpError(403,'Esta operación supera las capacidades del plan');
      if(e.message?.includes('SUBSCRIPTION_REQUIRED'))e=new HttpError(403,'El acceso del negocio requiere habilitación o renovación de Atry');
      if(!res.writableEnded){if(!(e instanceof HttpError)){const errorId=id();console.error('Error de servidor:',errorId,e.code||'INTERNAL_ERROR');try{db.prepare('INSERT INTO system_errors VALUES(?,?,?)').run(errorId,String(e.code||'INTERNAL_ERROR').slice(0,80),now());}catch{}}send(res,e.status||500,{error:e.status?e.message:'Error interno del servidor'});}
    }
  };
  return {handler,db,createServer:()=>http.createServer(handler)};
}
module.exports={createApp};
