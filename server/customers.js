'use strict';
const {id,now,transaction,audit}=require('./db');
const {fail}=require('./booking');
const digits=value=>String(value||'').replace(/\D/g,'');
function contact(payload,previous={}){
 const c={name:String(payload.name??previous.name??'').trim(),email:String(payload.email??previous.email??'').trim().toLowerCase(),phone:String(payload.phone??previous.phone??'').trim(),notes:String(payload.notes??previous.notes??'').trim(),marketing_consent:payload.marketing_consent===undefined?(previous.marketing_consent||0):Number(!!payload.marketing_consent)};
 if(c.name.length<2||c.name.length>100||c.email.length>150||c.phone.length>35||c.notes.length>700||(!c.email&&!digits(c.phone))||(c.email&&!/^\S+@\S+\.\S+$/.test(c.email)))fail(400,'Revisá el nombre y completá un teléfono o correo válido');return c;
}
function matching(db,bid,email,phone){return db.prepare('SELECT * FROM customers WHERE business_id=?').all(bid).filter(c=>(email&&c.email.toLowerCase()===email)||(digits(phone)&&digits(c.phone)===digits(phone)));}
function resolve(db,bid,data){
 const c=contact({name:data.customer_name,email:data.customer_email,phone:data.customer_phone,marketing_consent:data.marketing_consent});
 if(data.customer_id){const selected=db.prepare('SELECT * FROM customers WHERE business_id=? AND id=?').get(bid,data.customer_id);if(!selected)fail(404,'Cliente no encontrado');if(c.email!==selected.email.toLowerCase()||digits(c.phone)!==digits(selected.phone))fail(409,'El contacto cambió. Abrí nuevamente la ficha del cliente');return selected;}
 const matches=matching(db,bid,c.email,c.phone);if(matches.length>1)fail(409,'El correo y el teléfono corresponden a fichas diferentes. Revisá Clientes');if(matches.length)return matches[0];
 const created={...c,id:id()};db.prepare('INSERT INTO customers(id,business_id,name,email,phone,marketing_consent,created_at) VALUES(?,?,?,?,?,?,?)').run(created.id,bid,c.name,c.email,c.phone,c.marketing_consent,now());return created;
}
function save(db,bid,cid,payload,actor){return transaction(db,()=>{
 const previous=cid?db.prepare('SELECT * FROM customers WHERE business_id=? AND id=?').get(bid,cid):null;if(cid&&!previous)fail(404,'Cliente no encontrado');const c=contact(payload,previous||{});
 if(matching(db,bid,c.email,c.phone).some(other=>other.id!==cid))fail(409,'Ya existe una ficha con ese correo o teléfono. Buscala antes de crear otra');
 const key=cid||id();if(cid)db.prepare('UPDATE customers SET name=?,email=?,phone=?,notes=?,marketing_consent=? WHERE business_id=? AND id=?').run(c.name,c.email,c.phone,c.notes,c.marketing_consent,bid,key);else db.prepare('INSERT INTO customers(id,business_id,name,email,phone,notes,marketing_consent,created_at) VALUES(?,?,?,?,?,?,?,?)').run(key,bid,c.name,c.email,c.phone,c.notes,c.marketing_consent,now());
 // Keep recurring contact snapshots current for occurrences not generated yet.
 if(previous&&require('./commercial').has(db,bid,'recurring'))db.prepare('UPDATE recurring_appointments SET customer_name=?,customer_email=?,customer_phone=? WHERE business_id=? AND customer_email=? AND customer_phone=?').run(c.name,c.email,c.phone,bid,previous.email,previous.phone);
 audit(db,bid,actor,cid?'customer.updated':'customer.created','customer',key);return {...c,id:key};
 });}
module.exports={digits,contact,matching,resolve,save};
