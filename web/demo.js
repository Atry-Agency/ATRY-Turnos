/* Shared availability checks for the disposable demo, never a server adapter. */
(function(root){'use strict';
function create({biz,data}){
 const day=t=>new Date(Date.parse(t)-10800000).toISOString().slice(0,10);
 const hours=p=>p.windows??Array.from({length:6},(_,i)=>({weekday:i+1,start_min:540,end_min:1140}));
 function available(serviceId,personId,t,ignore=[]){
  const v=data.services.find(v=>v.id===serviceId&&v.active),p=data.staff.find(p=>p.id===personId&&p.active);if(!v||!p||!p.service_ids?.includes(serviceId))return false;
  const date=day(t),minute=(Date.parse(t)-Date.parse(date+'T00:00:00-03:00'))/60000,start=minute-Number(v.buffer_before_min||0),end=minute+Number(v.duration_min)+Number(v.buffer_after_min||0),weekday=new Date(date+'T12:00Z').getUTCDay();
  if(!Number.isFinite(minute)||Date.parse(t)<Date.now()+Number(biz.min_notice_min||0)*60000||date>day(new Date(Date.now()+Number(biz.max_days||60)*86400000).toISOString())||start<0||end>1440||data.holidays.some(h=>h.day===date))return false;
  const exceptions=data.exceptions.filter(x=>x.staff_id===personId&&x.day===date),windows=exceptions.length?exceptions:hours(p).filter(x=>Number(x.weekday)===weekday);
  if(exceptions.some(x=>Number(x.closed))||!windows.some(w=>start>=Number(w.start_min)&&end<=Number(w.end_min)))return false;
  if(data.breaks.some(x=>x.staff_id===personId&&Number(x.weekday)===weekday&&start<Number(x.end_min)&&end>Number(x.start_min)))return false;
  const from=new Date(Date.parse(t)-Number(v.buffer_before_min||0)*60000).toISOString(),until=new Date(Date.parse(t)+(Number(v.duration_min)+Number(v.buffer_after_min||0))*60000).toISOString();
  if(data.time_off.some(x=>x.staff_id===personId&&x.starts_at<until&&x.ends_at>from))return false;
  return !data.bookings.some(b=>!ignore.includes(b.id)&&b.staff_id===personId&&!['cancelled','no_show'].includes(b.status)&&(b.blocked_from||b.starts_at)<until&&(b.blocked_until||b.ends_at)>from);
 }
 function slots(date,personId,serviceId){const v=data.services.find(x=>x.id===serviceId&&x.active);if(!v||!/^\d{4}-\d\d-\d\d$/.test(date))return [];const step=Math.max(5,Number(biz.slot_step_min)||15);return data.staff.filter(p=>!personId||p.id===personId).flatMap(p=>Array.from({length:Math.ceil(1440/step)},(_,i)=>{const m=i*step,time=String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0'),start=new Date(date+'T'+time+':00-03:00').toISOString();return {start,starts_at:start,time,staff_id:p.id,staff_name:p.name,end:new Date(Date.parse(start)+v.duration_min*60000).toISOString()};})).filter(x=>available(serviceId,x.staff_id,x.start));}
 return {hours,available,slots};
}
root.ATRY_DEMO_SCHEDULE={create};
})(typeof globalThis==='object'?globalThis:this);

/* Isolated showcase. No fetch, SDK, storage writes or external delivery. */
(function(root){
'use strict';
function createDemo(number,plans){
 const ThemeCore=typeof module!=='undefined'&&module.exports?require('./theme-core'):root.ATRY_THEME_CORE;
 const n=Math.max(1,Math.min(3,Number(number)||1)),code=['individual','negocio','pro'][n-1],plan=structuredClone(plans[code]),stamp=()=>new Date().toISOString(),uid=()=>crypto.randomUUID(),day=offset=>new Date(Date.now()-10800000+offset*86400000).toISOString().slice(0,10),iso=(d,h)=>new Date(d+'T'+h+':00-03:00').toISOString();
 const user={id:'demo-user-'+n,name:'Propietario Demo '+n,email:'plan'+n+'@example.com',platform_admin:0},biz={id:'demo-business-'+n,name:'NegocioPlan'+n,slug:'demo-negocioplan'+n,sector:'Peluquería',description:'Demostración ficticia. No se toman reservas reales ni se envían mensajes.',email:'',phone:'',address:'',city:'Montevideo',role:'owner',plan:code,subscription_status:'active',is_active:1,subscription_started_at:stamp(),paid_until:'2099-01-01T03:00:00.000Z',trial_until:'2099-01-01T03:00:00.000Z',onboarding_completed:1,primary_color:n===1?'#4754E6':n===2?'#137E70':'#252525',secondary_color:'#00A5E2',appearance_mode:'light',logo_url:'./assets/brand/atry.png',timezone:'America/Montevideo',min_notice_min:0,max_days:60,cancel_notice_hours:12,slot_step_min:15,auto_confirm:1,allow_guest:1};
 plan.code=code;plan.price_uyu=0;
 const data={staff:Array.from({length:[1,3,5][n-1]},(_,i)=>({id:'demo-staff-'+i,business_id:biz.id,name:i?'Profesional '+(i+1):user.name,email:'',active:1,color:'#4754E6',user_id:i?null:user.id})),services:['Corte de pelo','Corte y barba','Peinado'].map((name,i)=>({id:'demo-service-'+i,business_id:biz.id,name,description:'Servicio ficticio para explorar el panel.',duration_min:[30,60,45][i],price_uyu:0,deposit_percent:0,buffer_before_min:0,buffer_after_min:0,active:1})),customers:Array.from({length:8},(_,i)=>({id:'demo-customer-'+i,business_id:biz.id,name:'Cliente Ejemplo '+(i+1),email:'',phone:'',notes:'Persona ficticia de demostración.',marketing_consent:0,visits:2})),bookings:[],recurring:[],waitlist:[],resources:[],breaks:[],exceptions:[],holidays:[],time_off:[],assignments:[],members:[],invitations:[],incidents:[]};
 biz.multi_service_enabled=1;biz.theme_config=ThemeCore.defaults(code);biz.theme_revision=0;biz.primary_color='#4754E6';biz.secondary_color='#00A5E2';biz.appearance_mode=code==='pro'?'dark':'light';
 biz.staff_id=data.staff[0].id;for(const s of data.staff)s.service_ids=data.services.map(v=>v.id);for(const v of data.services)v.staff_ids=data.staff.map(s=>s.id);
 if(n>1)for(const [i,name,duration]of [[0,'Diseño de cejas',20],[1,'Depilación',35],[2,'Corte y terminación',45]]){const sid='demo-special-'+i,person=data.staff[i];data.services.push({id:sid,business_id:biz.id,name,description:'Ejemplo de visita con profesionales especializados.',duration_min:duration,price_uyu:0,deposit_percent:0,buffer_before_min:0,buffer_after_min:0,active:1,staff_ids:[person.id]});person.service_ids.push(sid);}
 const decorate=b=>({...b,customer_name:data.customers.find(c=>c.id===b.customer_id)?.name||b.customer_name,customer_email:data.customers.find(c=>c.id===b.customer_id)?.email||b.customer_email||'',customer_phone:data.customers.find(c=>c.id===b.customer_id)?.phone||b.customer_phone||'',service_name:data.services.find(v=>v.id===b.service_id)?.name,staff_name:data.staff.find(s=>s.id===b.staff_id)?.name});
 for(let i=-5;i<=7;i++)for(const hour of ['10:00','14:00']){if(new Date(day(i)+'T12:00Z').getUTCDay()===0)continue;const j=Math.abs(i),starts=iso(day(i),hour),v=data.services[j%3];data.bookings.push({id:uid(),business_id:biz.id,customer_id:data.customers[j%8].id,staff_id:data.staff[j%data.staff.length].id,service_id:v.id,starts_at:starts,ends_at:new Date(Date.parse(starts)+v.duration_min*60000).toISOString(),status:i<0?j%4===0?'cancelled':'completed':'confirmed',price_uyu:0,payment_status:'not_required',notes:'Reserva ficticia; no se envía ni se guarda en servidores.',source:'manual',created_at:stamp()});}
 if(n>1){data.recurring.push({id:uid(),staff_id:data.staff[0].id,staff_name:data.staff[0].name,service_id:data.services[0].id,service_name:data.services[0].name,customer_name:'Cliente fijo de ejemplo',customer_email:'',customer_phone:'',start_day:day(1),minute:1020,interval_weeks:1,active:1,notes:'Serie ficticia',last_error:''});data.waitlist.push({id:uid(),customer_name:'Cliente en espera',customer_email:'',customer_phone:'',service_id:data.services[0].id,service_name:data.services[0].name,desired_date:day(2),status:'waiting'});}
 if(n===3)data.resources.push({id:uid(),name:'Sillón de ejemplo',active:1,service_count:0});
 const entitlements=()=>({...structuredClone(plan),staff_count:data.staff.filter(s=>s.active).length,access_enabled:true,mail_usage:{limit:plan.mail_limit,accepted:0,reserved:0,cycle_start:stamp(),cycle_end:'2099-01-01T00:00:00Z'}});
 const fail=(status,message)=>{throw Object.assign(new Error(message),{status})},preferences={confirmations:0,cancellations:0,reschedules:0,reminders:0,waitlist:0,business_alerts:0,reminder_hours:24};
 const schedule=root.ATRY_DEMO_SCHEDULE.create({biz,data}),slots=schedule.slots;
 const waDemo=(typeof module==='object'&&module.exports?require('./whatsapp-demo'):root.ATRY_WHATSAPP_DEMO).create({biz,data,uid});
 const visitDemo=(typeof module==='object'&&module.exports?require('./visit-demo'):root.ATRY_VISIT_DEMO).createVisitDemo({biz,data,uid,available:schedule.available});
 async function request(route,opts={}){
  const u=new URL(route,'https://demo.invalid'),p=u.pathname,method=opts.method||'GET',body=typeof opts.body==='string'?JSON.parse(opts.body):opts.body||{},q=u.searchParams;
  const waResult=waDemo.handle(p,method,body);if(waResult)return structuredClone(waResult.value);
  const visitResult=visitDemo.handle(p,method,body);if(visitResult)return structuredClone(visitResult.value);
  if(p==='/api/config')return {mail_provider:'disabled',automatic_email_live:false,payments_live:false,whatsapp_live:false,plans:Object.values(plans).map(x=>({...x,price_uyu:0})),tax_status:'pending'};
  if(p==='/api/auth/me')return {user,businesses:[biz]};
  if(p==='/api/auth/logout')return {ok:true,demo:true};
  if(p==='/api/account/sessions')return [];
  if(p==='/api/account/profile'&&method==='PATCH'){user.name=String(body.name||user.name);return user;}
  if(p.startsWith('/api/auth/')||p==='/api/account/password')return fail(403,'La demo no crea cuentas, cambia contraseñas ni envía correos.');
  if(p.startsWith('/api/admin'))return fail(403,'La demostración no tiene acceso a la administración real.');
  const pub=p.match(/^\/api\/public\/([^/]+)(?:\/(.*))?$/);
  if(pub){if(pub[1]!==biz.slug)return fail(404,'Este negocio no pertenece a la demo.');if(!pub[2])return {business:{...biz,theme_config:Object.fromEntries(Object.entries(biz.theme_config||{}).filter(([key])=>key!=='presets')),logo_url:ThemeCore.effective(biz).logo},services:data.services,staff:data.staff,bookable:true,waitlist_enabled:n>1,operational_mail:false};if(pub[2]==='availability')return {slots:slots(q.get('date')||day(1),q.get('staff_id'),q.get('service_id'))};return fail(403,'La demo no acepta reservas públicas ni mensajes reales. Explorá la agenda desde el panel.');}
  const match=p.match(/^\/api\/business\/([^/]+)(.*)$/);if(!match||match[1]!==biz.id)return fail(404,'Operación fuera del entorno ficticio.');const tail=match[2];
  const feature=[[/^\/recurring/,'recurring'],[/^\/waitlist/,'waitlist'],[/^\/statistics/,'statistics'],[/^\/insights/,'advanced'],[/^\/smartslots/,'smartslots'],[/^\/resources/,'resources'],[/^\/export/,'exports'],[/^\/(members|invitations)/,'access'],[/^\/(notification-preferences|mail-jobs|notifications)/,'operational_mail']].find(([re])=>re.test(tail));if(feature&&!plan.features[feature[1]])return fail(403,'Esta función no está incluida en el plan de esta demo.');
  if(tail==='')return method==='GET'?biz:Object.assign(biz,body);
  if(tail==='/appearance'){if(biz.role!=='owner')return fail(403,'Solo el propietario puede editar la apariencia.');if(body.expected_revision!==undefined&&body.expected_revision!==biz.theme_revision)return fail(409,'La apariencia cambió. Actualizá.');let config;try{config=ThemeCore.validate(body.theme_config||{},code);}catch(e){return fail(403,e.message);}if(code==='individual'&&body.logo_url)return fail(403,'El logo requiere Negocio.');biz.theme_config={...(body.reset_theme?ThemeCore.defaults(code):biz.theme_config),...config};if('logo_url'in body)biz.logo_url=body.logo_url;biz.theme_revision++;const effective=ThemeCore.effective(biz);Object.assign(biz,{primary_color:effective.primary,secondary_color:effective.secondary,appearance_mode:effective.mode});return structuredClone(biz);}
  if(tail==='/entitlements')return entitlements();
  if(tail==='/subscription')return {business:biz,entitlements:entitlements(),plans:Object.entries(plans).map(([code,x])=>({...x,code,price_uyu:0})),requests:[],settings:{whatsapp:'',tax_status:'pending'},tax_status:'pending'};
  if(tail==='/plan-requests')return fail(403,'La demo no registra contrataciones ni abre WhatsApp.');
  if(tail==='/bookings'&&method==='GET'){const start=q.get('date')||day(0),end=new Date(Date.parse(start+'T00:00Z')+Number(q.get('days')||1)*86400000).toISOString().slice(0,10);return data.bookings.filter(b=>{const d=new Date(Date.parse(b.starts_at)-10800000).toISOString().slice(0,10);return d>=start&&d<end;}).map(decorate);}
  if(tail==='/availability')return {slots:slots(q.get('date')||day(1),q.get('staff_id'),q.get('service_id'))};
  if(tail==='/dashboard'){const all=data.bookings.map(decorate);return {today:all.filter(b=>b.starts_at.slice(0,10)===day(0)),today_count:all.filter(b=>new Date(Date.parse(b.starts_at)-10800000).toISOString().slice(0,10)===day(0)&&!['cancelled','no_show'].includes(b.status)).length,upcoming:all.filter(b=>Date.parse(b.starts_at)>Date.now()&&['pending','confirmed'].includes(b.status)).sort((a,b)=>a.starts_at.localeCompare(b.starts_at)).slice(0,8),customers:data.customers.length,staff:data.staff.length,services:data.services.length,waitlist:data.waitlist.length,totals:{total:all.length,completed_revenue:0,cancelled:all.filter(b=>b.status==='cancelled').length,no_show:0},daily:Array.from({length:7},(_,i)=>({day:day(i-6),n:all.filter(b=>new Date(Date.parse(b.starts_at)-10800000).toISOString().slice(0,10)===day(i-6)&&b.status!=='cancelled').length})),insights:['Datos ficticios. Los cambios se descartan al recargar esta demostración.']};}
  if(tail==='/statistics')return {total:data.bookings.length,completed:8,cancelled:2};
  if(tail==='/scheduling')return {breaks:data.breaks,exceptions:data.exceptions,holidays:data.holidays,resources:data.resources,assignments:data.assignments};
  if(tail==='/notification-preferences'){if(method!=='GET')return fail(403,'Los envíos están deshabilitados permanentemente en la demo.');return {...preferences};}
  if(['/notifications','/mail-jobs','/audit'].includes(tail))return [];
  if(tail==='/members')return [{id:user.id,user_id:user.id,name:user.name,email:user.email,role:'owner',staff_id:biz.staff_id}];
  if(tail==='/invitations'&&method!=='GET')return fail(403,'La demo no envía invitaciones.');
  if(tail==='/support')return fail(403,'La demo no registra incidencias ni envía mensajes.');
  if(tail==='/export/bookings')return 'Cliente,Servicio,Estado\n'+data.bookings.map(decorate).map(b=>[b.customer_name,b.service_name,b.status].join(',')).join('\n');
  if(tail==='/smartslots')return {date:q.get('date')||day(1),method:'Demostración en memoria, sin disponibilidad real',suggestions:slots(q.get('date')||day(1),null,data.services[0].id).slice(0,3).map(s=>({service_name:data.services[0].name,staff_name:s.staff_name,time:new Date(Date.parse(s.start)-10800000).toISOString().slice(11,16)})),opportunities:[],offers:[],slots:[],message:'Oportunidades ficticias; no se envían ofertas.'};
  if(tail==='/insights')return {bookings:data.bookings.length,cancelled:2,no_show:0,recurrent_customers:8,completed_service_value:0,forecast_service_value:0,payment_explanation:'Demostración: no hay cobros ni envíos.',occupancy:data.staff.map(s=>({name:s.name,booked_minutes:60,scheduled_minutes:480,occupancy_percent:12.5})),occupancy_method:'Datos de ejemplo en memoria',popular_services:data.services.map(s=>({name:s.name,count:4})),demand_hours:[{hour:'10',count:6}],weekly:[],monthly:[],period:{from:day(-30),to:day(0)},totals:{bookings:data.bookings.length,revenue:0,completed:8,cancelled:2,no_show:0},daily:[],services:[],staff:[],customers:[],suggestions:['Demostración ficticia; sin ingresos ni consumo real.']};
  let r=tail.match(/^\/staff\/([^/]+)\/hours$/);if(r){const s=data.staff.find(s=>s.id===r[1]);if(!s)return fail(404,'Profesional no encontrado');if(method!=='GET')s.windows=body.windows||body.hours;return schedule.hours(s);}
  r=tail.match(/^\/customers\/([^/]+)\/history$/);if(r)return {customer:data.customers.find(c=>c.id===r[1]),bookings:data.bookings.filter(b=>b.customer_id===r[1]).map(decorate),recurring:[],summary:{visits:2,cancelled:0,no_show:0,total_spent:0}};
  r=tail.match(/^\/(services|staff|customers|bookings|recurring|waitlist|resources|breaks|exceptions|holidays|time-off|incidents|invitations)(?:\/([^/]+))?(?:\/(end))?$/);
  if(r){const collection=r[1]==='time-off'?'time_off':r[1],list=data[collection];if(method==='GET')return collection==='customers'?list.filter(c=>(c.name+' '+c.email+' '+c.phone).toLowerCase().includes((q.get('q')||'').toLowerCase())):list;
   if(method==='DELETE'){const i=list.findIndex(x=>x.id===r[2]);if(i>=0)list.splice(i,1);return {ok:true,demo:true};}
   if(collection==='staff'&&!r[2]&&list.filter(s=>s.active).length>=plan.staff_limit)return fail(403,'Se alcanzó el límite de profesionales de este plan.');
   let item=r[2]?list.find(x=>x.id===r[2]):null;if(r[2]&&!item)return fail(404,'Registro ficticio no encontrado');
   if(collection==='bookings'){if(!item&&!body.customer_id&&body.customer_name){let customer=data.customers.find(c=>c.name===body.customer_name);if(!customer){customer={id:uid(),name:body.customer_name,email:body.customer_email||'',phone:body.customer_phone||'',notes:'Contacto temporal de demostración',visits:1,marketing_consent:0};data.customers.push(customer);}body.customer_id=customer.id;}const service=data.services.find(x=>x.id===body.service_id||x.id===item?.service_id);if(!service)return fail(400,'Elegí un servicio');const starts=body.starts_at||item?.starts_at,staff=body.staff_id||item?.staff_id,ends=new Date(Date.parse(starts)+service.duration_min*60000).toISOString();if((!item||body.starts_at||body.staff_id||body.service_id)&&!schedule.available(service.id,staff,starts,item?[item.id]:[]))return fail(409,'Ese horario no está disponible: revisá jornada, profesional y bloqueos');if(list.some(b=>b.id!==item?.id&&b.staff_id===staff&&!['cancelled','no_show'].includes(b.status)&&!['cancelled','no_show'].includes(body.status||item?.status)&&Date.parse(starts)<Date.parse(b.ends_at)&&Date.parse(ends)>Date.parse(b.starts_at)))return fail(409,'Ese horario ficticio ya está ocupado');Object.assign(body,{ends_at:ends,price_uyu:0,staff_id:staff,service_id:service.id,status:body.status||item?.status||'confirmed'});}
   if(!item){item={id:uid(),business_id:biz.id,active:1,price_uyu:0,created_at:stamp()};list.push(item);}if(collection==='bookings'&&body.starts_at&&item.starts_at&&body.starts_at!==item.starts_at)waDemo.rememberPrevious(item.id,item.starts_at);Object.assign(item,body);if(collection==='services'){item.price_uyu=0;if(Array.isArray(body.staff_ids))for(const person of data.staff){person.service_ids=(person.service_ids||[]).filter(id=>id!==item.id);if(body.staff_ids.includes(person.id))person.service_ids.push(item.id);}}if(r[3]==='end')item.active=0;return collection==='bookings'?decorate(item):item;
  }
  return fail(404,'Esta operación no se ejecuta en la demo. Ningún dato salió de tu navegador.');
 }
 return {request,number:n,business:biz,data,entitlements};
}
const plans={
  "individual":{"name":"ATRY Individual","price_uyu":790,"staff_limit":1,"mail_limit":0,"features":{"team":false,"access":false,"recurring":false,"waitlist":false,"statistics":false,"advanced":false,"smartslots":false,"resources":false,"exports":false,"operational_mail":false,"auto_offers":false,"priority_support":false}},
  "negocio":{"name":"ATRY Negocio","price_uyu":1490,"staff_limit":4,"mail_limit":300,"features":{"team":true,"access":true,"recurring":true,"waitlist":true,"statistics":true,"advanced":false,"smartslots":false,"resources":false,"exports":false,"operational_mail":true,"auto_offers":false,"priority_support":false}},
  "pro":{"name":"ATRY Pro","price_uyu":2490,"staff_limit":10,"mail_limit":900,"features":{"team":true,"access":true,"recurring":true,"waitlist":true,"statistics":true,"advanced":true,"smartslots":true,"resources":true,"exports":true,"operational_mail":true,"auto_offers":true,"priority_support":true}}
}
;
// Natural, varied fictional data only for the landing's isolated identity demo.
function seedShowcaseData(instance){
 const names=['Ana Costa','Adriana Suárez','Florencia Díaz','Julieta Pérez','Victoria Lima','Natalia Santos','Emilia Torres','Mariana López','Daniela Castro','Cecilia Méndez','Andrea Silva','Gabriela Núñez','Paula Suárez','Carolina Ríos','Lorena Acosta','Verónica Sosa','Patricia Molina','Clara Vidal','Romina Cabrera','Luciana Ramos','Micaela Duarte','Elena Pereira','Sandra Reyes','Inés Ferreira','Beatriz León','Noelia Medina','Laura Benítez','Camila Ortiz','Valeria Santos','Malena Costa'];
 const template=instance.data.customers[0];
 instance.data.customers=names.map((name,i)=>({...template,id:'demo-showcase-customer-'+i,name,email:'',phone:'',visits:0}));
 instance.data.bookings.forEach((booking,i)=>{const customer=instance.data.customers[i%names.length];booking.customer_id=customer.id;customer.visits++;});
 instance.data.services.forEach(service=>{if(service.name==='Corte y barba')service.name='Coloración y brushing';});
 instance.data.staff.forEach((person,i)=>person.name=['Sofía Pereira','Lucía Fernández','Valentina Costa','Martina Silva','Camila Méndez'][i]);
}
if(typeof module==='object'&&module.exports)module.exports={createDemo,plans};
else{let showcaseSeeded=false;function ThemeForPreview(){return root.ATRY_THEME_CORE;}const query=new URLSearchParams(location.search),enabled=query.get('demo')==='1',instance=enabled?createDemo(query.get('plan'),plans):null;if(enabled&&query.get('demo_theme')?.length<2000){try{
 const config=root.ATRY_THEME_CORE.validate(JSON.parse(query.get('demo_theme')),instance.business.plan);
 Object.assign(instance.business,{theme_config:config,name:(query.get('demo_name')||instance.business.name).trim().slice(0,28)||instance.business.name});
 seedShowcaseData(instance);
 }catch{/* Invalid visual URLs leave the ordinary isolated demo unchanged. */}}
 root.ATRY_DEMO={enabled,request:instance?.request,number:instance?.number,showcase:enabled&&query.get('showcase')==='1'&&root.parent!==root?{
 apply(input){
  const config=ThemeForPreview().validate(input.theme_config||{},instance.business.plan);
  const name=typeof input.name==='string'?input.name.trim().slice(0,28):'Tu estudio';
  Object.assign(instance.business,{name:name||'Tu estudio',theme_config:config,description:'Tu próximo momento empieza acá. Elegí cómo querés disfrutarlo.'});
  if(!showcaseSeeded){seedShowcaseData(instance);showcaseSeeded=true;}
  return structuredClone(instance.business);
 }
}:null,loginPlan:email=>/^plan[123]@example\.com$/i.test(email||'')?Number(email[4]):0};}
})(typeof globalThis==='object'?globalThis:this);
