'use strict';
const {connect,id,now,passwordHash}=require('./db');
const {localISO,createBooking}=require('./booking');
function seedDemo(db){
  let user=db.prepare('SELECT id FROM users WHERE email=?').get('demo@atryturnos.test');
  if(user)return;
  const userId=id(),bizId=id(),today=new Date(Date.now()-3*3600000).toISOString().slice(0,10);
  db.prepare('INSERT INTO users(id,name,email,password_hash,created_at) VALUES(?,?,?,?,?)').run(userId,'Sofía Martínez','demo@atryturnos.test',passwordHash('AtryDemo2026!'),now());
  const adminId=id();db.prepare('INSERT INTO users(id,name,email,password_hash,platform_admin,created_at) VALUES(?,?,?,?,?,?)').run(adminId,'Administración Atry','admin@atryturnos.test',passwordHash('AtryAdmin2026!'),1,now());
  db.prepare("INSERT INTO businesses(id,slug,name,sector,description,phone,email,address,city,primary_color,plan,subscription_status,trial_until,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
    .run(bizId,'estudio-sofia','Estudio Sofía','Belleza y bienestar','Un espacio donde cada detalle cuenta. Reservá tu momento.', '099 123 456','hola@estudiosofia.test','Av. 18 de Julio 1200','Montevideo','#1b826e','negocio','active',new Date(Date.now()+360*86400000).toISOString(),now());
  db.prepare("INSERT INTO memberships(user_id,business_id,role) VALUES(?,?,'owner')").run(userId,bizId);
  const st=[];for(const [name,email,color] of [['Sofía Martínez','sofia@example.test','#237d75'],['Camila Torres','camila@example.test','#9673d8'],['Martín Pereira','martin@example.test','#bd8248']]){
    const sid=id();db.prepare('INSERT INTO staff(id,business_id,name,email,color,created_at) VALUES(?,?,?,?,?,?)').run(sid,bizId,name,email,color,now());st.push(sid);
    for(let day=1;day<=6;day++)db.prepare('INSERT INTO working_hours(staff_id,weekday,start_min,end_min) VALUES(?,?,?,?)').run(sid,day,540,1140);
  }
  const services=[];for(const [name,dur,price,desc] of [['Corte de pelo',30,550,'Corte personalizado y terminación'],['Corte + brushing',60,980,'Lavado, corte y peinado'],['Color y tratamiento',120,2200,'Coloración y tratamiento nutritivo'],['Barba y perfilado',30,420,'Perfilado profesional']]){
    const sid=id();db.prepare('INSERT INTO services(id,business_id,name,description,duration_min,price_uyu,created_at) VALUES(?,?,?,?,?,?,?)').run(sid,bizId,name,desc,dur,price,now());services.push(sid);
    for(const staf of st)db.prepare('INSERT INTO staff_services(staff_id,service_id) VALUES(?,?)').run(staf,sid);
  }
  // Mostrar ejemplos reales en los próximos días laborales.
  let count=0;for(let offset=1;offset<=6 && count<9;offset++){
    const day=new Date(Date.parse(today+'T12:00:00Z')+offset*86400000).toISOString().slice(0,10);
    if(new Date(day+'T12:00:00Z').getUTCDay()===0)continue;
    for(const hour of [600,690]){
      if(count>=9)break;
      try{createBooking(db,{business_id:bizId,staff_id:st[count%3],service_id:services[count%4],starts_at:localISO(day,hour),customer_name:['Valentina Rodríguez','Lucía Fernández','Matías López','Carolina Silva','Agustina Díaz'][count%5],customer_email:`cliente${count+1}@ejemplo.test`,customer_phone:'099000'+String(count).padStart(3,'0')},{source:'manual',enforceNotice:false});count++;}catch(e){console.warn('Reserva demo omitida',e.message);}
    }
  }
  console.log('Demo creada: demo@atryturnos.test / AtryDemo2026! | admin@atryturnos.test / AtryAdmin2026!');
}
if(require.main===module){const db=connect();seedDemo(db);db.close();}
module.exports={seedDemo};
