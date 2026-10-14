const {connect}=require('../server/db');
const {createApp}=require('../server/app');
const {seedDemo}=require('../server/seed');
async function context(){const db=connect(':memory:');seedDemo(db);const app=createApp({db});const server=app.createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;return {db,app,base,async call(url,{data,cookie='',method=data?'POST':'GET',headers={}}={}){const response=await fetch(base+url,{method,headers:{'Content-Type':'application/json',cookie,...headers},body:data?JSON.stringify(data):undefined});return {status:response.status,body:await response.json(),cookie:response.headers.get('set-cookie')};},async close(){server.closeAllConnections();await new Promise(r=>server.close(r));db.close();}};}
module.exports={context};
