const test=require('node:test'),assert=require('node:assert/strict');
const {createDemo,plans}=require('../web/demo');
const date=()=>{let t=new Date(Date.now()+86400000*2);while(t.getUTCDay()===0)t=new Date(+t+86400000);return t.toISOString().slice(0,10);};
test('Demo: jornada, pausas, ausencias, especialidad y guardado usan disponibilidad consistente',async()=>{
 const d=createDemo(2,plans),base='/api/business/'+d.business.id,day=date(),person=d.data.staff[0],service=d.data.services[0],weekday=new Date(day+'T12:00Z').getUTCDay();
 person.windows=[{weekday,start_min:720,end_min:900}];d.data.breaks.push({staff_id:person.id,weekday,start_min:780,end_min:810});
 const route=base+'/availability?'+new URLSearchParams({date:day,service_id:service.id,staff_id:person.id});let slots=(await d.request(route)).slots;
 assert.ok(slots.length);assert.ok(slots.every(s=>s.time>='12:00'&&s.time<='14:30'&&!(s.time>'12:30'&&s.time<'13:30')));
 const post=body=>d.request(base+'/bookings',{method:'POST',body});
 await assert.rejects(post({service_id:service.id,staff_id:person.id,starts_at:day+'T09:00:00-03:00',customer_name:'No guardar'}),e=>e.status===409);
 const slot=slots[0];await post({service_id:service.id,staff_id:person.id,starts_at:slot.start,customer_name:'Cliente prueba',customer_phone:'099123456'});
 const saved=(await d.request(base+'/bookings?date='+day)).find(b=>b.customer_name==='Cliente prueba');assert.equal(saved.customer_phone,'099123456');
 assert.ok(!(await d.request(route)).slots.some(s=>s.start===slot.start));
 d.data.time_off.push({staff_id:person.id,starts_at:day+'T00:00:00.000Z',ends_at:day+'T23:59:59.000Z'});assert.equal((await d.request(route)).slots.length,0);
 d.data.time_off=[];d.data.exceptions.push({staff_id:person.id,day,closed:1});assert.equal((await d.request(route)).slots.length,0);
 const wrong=base+'/availability?'+new URLSearchParams({date:day,service_id:'demo-special-1',staff_id:person.id});assert.equal((await d.request(wrong)).slots.length,0);
});
test('Demo: contador de hoy cambia con los turnos y excluye cancelados',async()=>{
 const d=createDemo(1,plans),base='/api/business/'+d.business.id,today=new Date(Date.now()-10800000).toISOString().slice(0,10),before=(await d.request(base+'/dashboard')).today_count;
 d.data.bookings.push({...d.data.bookings[0],id:'extra',starts_at:today+'T12:00:00-03:00',status:'confirmed'});assert.equal((await d.request(base+'/dashboard')).today_count,before+1);
 d.data.bookings.at(-1).status='cancelled';assert.equal((await d.request(base+'/dashboard')).today_count,before);
});
