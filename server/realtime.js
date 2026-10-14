'use strict';
const {hashToken,now}=require('./db');
function register({r,db,authorized}){
 const sockets=new Map();
 r('GET','/api/business/([A-Za-z0-9_-]+)/events',({req,res,params})=>{
  const a=authorized(req,params[0],['owner','manager','staff']);const key=a.user.id;const count=sockets.get(key)||0;if(count>=8){const {fail}=require('./booking');fail(429,'Hay demasiadas agendas abiertas para esta cuenta');}sockets.set(key,count+1);
  const token=(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('atry_session='))?.slice(13)||'';
  res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache, no-transform','Connection':'keep-alive','X-Accel-Buffering':'no'});res.write('retry: 3000\n\n');
  const revision=()=>db.prepare('SELECT coalesce(max(rowid),0) revision FROM audit_log WHERE business_id=?').get(params[0]).revision;
  let last=revision(),ticks=0;res.write(`id: ${last}\nevent: ready\ndata: ${JSON.stringify({revision:last})}\n\n`);
  const timer=setInterval(()=>{
   try{
    const session=db.prepare('SELECT user_id FROM sessions WHERE token_hash=? AND expires_at>?').get(hashToken(token),now());const membership=db.prepare('SELECT role FROM memberships WHERE business_id=? AND user_id=?').get(params[0],a.user.id);
    if(!session||!membership){res.write('event: access_revoked\ndata: {}\n\n');res.end();return;}
    const current=revision();if(current!==last){last=current;res.write(`id: ${last}\nevent: change\ndata: ${JSON.stringify({revision:last})}\n\n`);}else if(++ticks%10===0)res.write(': heartbeat\n\n');
   }catch{res.end();}
  },1000);timer.unref();let closed=false;
  const cleanup=()=>{if(closed)return;closed=true;clearInterval(timer);const n=(sockets.get(key)||1)-1;if(n)sockets.set(key,n);else sockets.delete(key);};req.on('close',cleanup);res.on('close',cleanup);return null;
 });
}
module.exports={register};
