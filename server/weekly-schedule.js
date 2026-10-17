'use strict';
const {fail,checkSlot}=require('./booking');
const {id,now,transaction}=require('./db');
function normalizeWindows(input){
 if(!Array.isArray(input)||input.length>42)fail(400,'Ingresá hasta 6 tramos por día.');
 const windows=input.map(w=>{if(!w||!Number.isInteger(w.weekday)||w.weekday<0||w.weekday>6||!Number.isInteger(w.start_min)||!Number.isInteger(w.end_min)||w.start_min<0||w.end_min>1440||w.start_min>=w.end_min)fail(400,'Revisá los días y las horas de cada tramo.');return {weekday:w.weekday,start_min:w.start_min,end_min:w.end_min};}).sort((a,b)=>a.weekday-b.weekday||a.start_min-b.start_min);
 for(let day=0;day<7;day++){const rows=windows.filter(w=>w.weekday===day);if(rows.length>6)fail(400,'Podés guardar hasta 6 tramos por día.');for(let i=1;i<rows.length;i++)if(rows[i].start_min<rows[i-1].end_min)fail(400,'Los tramos de un día no pueden superponerse.');}
 return windows;
}
function saveWeek(db,bid,sid,input,uid){const windows=normalizeWindows(input);return transaction(db,()=>{
 db.prepare('DELETE FROM working_hours WHERE staff_id=?').run(sid);db.prepare('DELETE FROM recurring_breaks WHERE staff_id=? AND business_id=?').run(sid,bid);
 for(let weekday=0;weekday<7;weekday++){const rows=windows.filter(w=>w.weekday===weekday);if(!rows.length)continue;db.prepare('INSERT INTO working_hours VALUES(?,?,?,?)').run(sid,weekday,rows[0].start_min,rows.at(-1).end_min);for(let i=1;i<rows.length;i++)if(rows[i-1].end_min<rows[i].start_min)db.prepare('INSERT INTO recurring_breaks VALUES(?,?,?,?,?,?)').run(id(),bid,sid,weekday,rows[i-1].end_min,rows[i].start_min);}
 for(const booking of db.prepare("SELECT * FROM bookings WHERE business_id=? AND staff_id=? AND ends_at>? AND status IN ('pending','confirmed')").all(bid,sid,now())){try{checkSlot(db,bid,sid,booking.service_id,booking.starts_at,{ignoreBooking:booking.id,enforceNotice:false});}catch{fail(409,'La nueva semana afectaría una reserva existente. Reprogramala antes de guardar.');}}
 db.prepare('INSERT INTO audit_log VALUES(?,?,?,?,?,?,?)').run(id(),bid,uid,'staff.week.updated','staff',sid,now());return {ok:true,windows};
 });}
module.exports={normalizeWindows,saveWeek};
