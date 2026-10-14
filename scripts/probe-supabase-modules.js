'use strict';
const fs=require('node:fs'),crypto=require('node:crypto'),assert=require('node:assert/strict'),{createClient}=require('@supabase/supabase-js');
async function main(){
 if(!process.argv.includes('--run'))throw new Error('Usar --run para crear fixtures temporales');
 const config=JSON.parse(fs.readFileSync('data/cloud-private/connection.json','utf8'));
 if(config.url!=='https://djoxdtloqwbrhgtgencc.supabase.co')throw new Error('TARGET_MISMATCH');
 const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}},admin=createClient(config.url,config.serverKey,options);
 const run=crypto.randomUUID(),manifest={run,project:'djoxdtloqwbrhgtgencc',users:[],businesses:[],bookings:[],checks:[]};
 const file='data/cloud-private/modules-'+run+'.json';const save=()=>fs.writeFileSync(file,JSON.stringify(manifest,null,2));save();
 const call=async(client,name,args={})=>{const result=await client.rpc(name,args);if(result.error)throw new Error(name+':'+(result.error.code||'UNKNOWN')+':'+result.error.message.replace(/[^A-Z0-9_]/g,'').slice(0,60));return result.data;};
 const check=label=>{manifest.checks.push(label);save();console.log(label);};
 try{
  const clients=[];
  for(let i=1;i<=3;i++){
   const email=`prueba${i}.${run}@example.com`,password=crypto.randomBytes(32).toString('base64url');
   const created=await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{name:'Usuario Prueba '+i,atry_test_run:run}});
   if(created.error)throw new Error('AUTH_CREATE_FAILED');manifest.users.push({id:created.data.user.id,email,password});save();
   const client=createClient(config.url,config.publicKey,options),signed=await client.auth.signInWithPassword({email,password});if(signed.error)throw new Error('AUTH_LOGIN_FAILED');clients.push(client);
   if(i<=2){const org=await call(client,'atry_create_organization',{payload:{name:'Negocio Prueba '+i,slug:'negocio-prueba-'+run.slice(0,12)+'-'+i}});manifest.businesses.push(org.id);save();}
  }
  const owner=clients[0],bid=manifest.businesses[0],biz=await call(owner,'atry_business',{bid});
  const catalog=await call(owner,'atry_catalog',{bid}),sid=catalog.staff[0].id;
  const service=await call(owner,'atry_save_service',{bid,service_id:null,payload:{name:'Servicio 1',duration_min:30,price_uyu:1000,staff_ids:[sid]}});
  const employee=await call(owner,'atry_save_staff',{bid,staff_id:null,payload:{name:'Empleado 1',service_ids:[service.id]}});
  await call(owner,'atry_save_rule',{bid,kind:'hours',rule_id:null,remove:false,payload:{staff_id:employee.id,hours:[{weekday:1,start_min:540,end_min:1080},{weekday:2,start_min:540,end_min:1080},{weekday:3,start_min:540,end_min:1080},{weekday:4,start_min:540,end_min:1080},{weekday:5,start_min:540,end_min:1080},{weekday:6,start_min:540,end_min:1080}]}});
  await call(owner,'atry_add_member',{bid,payload:{email:manifest.users[2].email,role:'staff',staff_id:employee.id}});
  const restricted=await clients[2].rpc('atry_customers',{bid,query:''});assert.equal(restricted.error?.code,'42501');
  const crossed=await clients[1].rpc('atry_catalog',{bid});assert.equal(crossed.error?.code,'42501');check('Equipo verificado, rol empleado y aislamiento entre organizaciones');
  const day=new Date(Date.now()+7*86400000).toISOString().slice(0,10);
  const availability=await call(admin,'atry_public_availability',{slug:biz.slug,service_id:service.id,day,staff_id:sid});assert.ok(availability.slots.length>=4);
  const starts=availability.slots[0].start,payload={staff_id:sid,service_id:service.id,starts_at:starts,customer_name:'Cliente 1',customer_email:'cliente1@example.com',accept_policy:true};
  const concurrent=await Promise.all([owner.rpc('atry_create_booking',{bid,payload:{...payload,idempotency_key:run+'-concurrent-1'}}),owner.rpc('atry_create_booking',{bid,payload:{...payload,idempotency_key:run+'-concurrent-2'}})]);
  assert.equal(concurrent.filter(x=>!x.error).length,1);assert.equal(concurrent.filter(x=>x.error).length,1);
  const winner=concurrent.find(x=>!x.error).data;manifest.bookings.push(winner.id);save();
  const winningIndex=concurrent.findIndex(x=>!x.error)+1;
  const repeated=await call(owner,'atry_create_booking',{bid,payload:{...payload,idempotency_key:run+'-concurrent-'+winningIndex}});assert.equal(repeated.id,winner.id);check('Reservas simultáneas: una sola confirmación; reintento devuelve el mismo ID');
  const staffBookings=await call(clients[2],'atry_bookings',{bid,start_day:day,days:1});assert.equal(staffBookings.length,0);
  const blocked=await owner.rpc('atry_save_service',{bid,service_id:service.id,payload:{duration_min:60}});assert.equal(blocked.error?.message,'FUTURE_BOOKINGS');check('Empleado no lee agenda ajena y cambios de servicio protegen reservas existentes');
  const publicSlot=availability.slots.find(x=>new Date(x.start)-new Date(starts)>=3600000);assert.ok(publicSlot);
  const guest=await call(admin,'atry_public_book',{slug:biz.slug,payload:{...payload,starts_at:publicSlot.start,idempotency_key:run+'-guest'}});manifest.bookings.push(guest.id);save();
  const management=await call(admin,'atry_manage',{token:guest.manage_token});assert.equal(management.id,guest.id);assert.ok(!('customer_email'in management));
  const cancel1=await call(admin,'atry_manage_change',{token:guest.manage_token,operation:'cancel',payload:{}}),cancel2=await call(admin,'atry_manage_change',{token:guest.manage_token,operation:'cancel',payload:{}});assert.equal(cancel1.status,'cancelled');assert.equal(cancel2.status,'cancelled');
  const moved=availability.slots.find(x=>new Date(x.start)-new Date(publicSlot.start)>=3600000);assert.ok(moved);
  const updated=await call(owner,'atry_update_booking',{bid,booking_id:winner.id,patch:{starts_at:moved.start}});assert.equal(new Date(updated.starts_at).getTime(),new Date(moved.start).getTime());check('Reserva pública con enlace privado, cancelación repetida y reprogramación real');
  for(const name of ['atry_dashboard','atry_insights','atry_entitlements','atry_waitlist','atry_notification_preferences','atry_mail_jobs','atry_notifications','atry_audit'])assert.ok(await call(owner,name,{bid}));
  const page=await call(owner,'atry_export_bookings',{bid,after_start:null,after_id:'',page_size:1});assert.equal(page.rows.length,1);assert.ok(page.next_cursor);check('Panel, Insights, preferencias, notificaciones, auditoría y exportación remotos');
  manifest.result='passed';save();console.log(JSON.stringify({result:'passed',project:manifest.project,manifest:file,fixturesPendingCleanup:manifest.users.length}));
 }catch(error){manifest.result='failed';save();throw error;}
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
