/* Local-only capture fixture. Product HTML/CSS/JS stay unchanged; seed values
   are substituted only in the disposable in-memory demo served at /__capture__/. */
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../web');
function captureDemo(){let source=fs.readFileSync(path.join(root,'demo.js'),'utf8');
 const names=['Sofía Pereira','Lucía Fernández','Valentina Costa','Martina Silva','Camila Méndez'];
 source=source.replace("name:'Propietario Demo '+n","name:'Sofía Pereira'").replace("name:'NegocioPlan'+n","name:'Estudio Aurora'")
 .replace("description:'Demostración ficticia. No se toman reservas reales ni se envían mensajes.'","description:'Peluquería y cuidado personal. Un momento para vos. Datos ficticios.'")
 .replace("name:i?'Profesional '+(i+1):user.name","name:"+JSON.stringify(names)+"[i]")
 .replace("name:'Cliente Ejemplo '+(i+1)","name:"+JSON.stringify(['Ana Costa','Paula Suárez','Florencia Díaz','Julieta Pérez','Carolina Ríos','Natalia Santos','Victoria Lima','Emilia Torres'])+"[i]")
 .replace('price_uyu:0,deposit_percent:0','price_uyu:[650,950,800][i],deposit_percent:0')
 .replace('duration_min:duration,price_uyu:0','duration_min:duration,price_uyu:[400,550,750][i]')
 .replace("status:i<0?j%4===0?'cancelled':'completed':'confirmed',price_uyu:0","status:i<0?j%4===0?'cancelled':'completed':'confirmed',price_uyu:v.price_uyu");
 return source;
}
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg','.otf':'font/otf','.ttf':'font/ttf','.svg':'image/svg+xml'};
function start(){return http.createServer((req,res)=>{const url=new URL(req.url,'http://localhost');let body,filename;
 if(url.pathname==='/__capture__/quality.js'){body=fs.readFileSync(path.join(__dirname,'commercial-quality.js'));filename='quality.js';}
 else if(url.pathname==='/__capture__/demo.js'){body=captureDemo();filename='demo.js';}
 else if(url.pathname==='/__capture__/'){filename='index.html';body=fs.readFileSync(path.join(root,filename),'utf8').replace('./demo.js?v=12','/__capture__/demo.js').replace('</body>','<script src="/__capture__/quality.js" defer></script></body>');}
 else{filename=decodeURIComponent(url.pathname)==='/'?'index.html':decodeURIComponent(url.pathname).replace(/^\/__capture__\//,'/').slice(1);const full=path.resolve(root,filename);if(!full.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}try{body=fs.readFileSync(full);}catch{res.writeHead(404);res.end();return;}}
 res.writeHead(200,{'Content-Type':(mime[path.extname(filename)]||'application/octet-stream')+'; charset=utf-8','Cache-Control':'no-store'});res.end(body);
}).listen(3473,'127.0.0.1',()=>console.log('Commercial review: http://127.0.0.1:3473/descubrir.html (never deployed)'));}
module.exports={captureDemo,start};if(require.main===module)start();
