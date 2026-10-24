import {defineConfig} from 'vite';
import {readFileSync,existsSync,statSync} from 'node:fs';
import {resolve,sep,extname} from 'node:path';
const web=resolve(import.meta.dirname,'../../web');
export default defineConfig({
 plugins:[{name:'isolated-legacy-demo',configureServer(server){server.middlewares.use((req,res,next)=>{
  const url=new URL(req.url||'/','http://localhost');
  if(url.pathname.startsWith('/pilot-build/')){const dist=resolve(import.meta.dirname,'dist'),file=resolve(dist,'.'+decodeURIComponent(url.pathname.slice('/pilot-build'.length)));if(!file.startsWith(dist+sep)||!file.endsWith('.js')||!existsSync(file)||!statSync(file).isFile()){res.statusCode=404;res.end();return;}res.setHeader('Content-Type','text/javascript');res.setHeader('Cache-Control','no-store');res.end(readFileSync(file));return;}
  if(url.pathname.startsWith('/api/')){res.statusCode=403;res.end('Experimental demo: API disabled');return;}
  if(!url.pathname.startsWith('/legacy/'))return next();
  res.setHeader('Cache-Control','no-store');
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self' ws://127.0.0.1:3321; worker-src 'none'; form-action 'none'; frame-src 'none'");
  let file=resolve(web,'.'+decodeURIComponent(url.pathname.slice('/legacy'.length)));
  if(!file.startsWith(web+sep)&&file!==web){res.statusCode=403;res.end();return;}
  if(file===web||file===web+sep||url.pathname==='/legacy/')file=resolve(web,'index.html');
  if(!existsSync(file)||!statSync(file).isFile()){res.statusCode=404;res.end();return;}
  if(!['.html','.js','.css','.png','.svg','.jpg','.webmanifest','.ttf','.otf'].includes(extname(file))){res.statusCode=403;res.end();return;}
  const types:Record<string,string>={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.ttf':'font/ttf','.otf':'font/otf','.jpg':'image/jpeg','.webmanifest':'application/manifest+json'};
  res.setHeader('Content-Type',types[extname(file)]||'application/octet-stream');
  if(file.endsWith('index.html')){
   if(url.searchParams.get('demo')!=='1'){res.statusCode=403;res.end('Abrí /legacy/?demo=1&react=1#/app/servicios');return;}
   let html=readFileSync(file,'utf8');
   // No cloud entry/config is loaded. CSP blocks external connections, workers and form posts.
   if(url.searchParams.get('react')==='1')html=html.replace('</body>','<script src="./react-services-bridge.js?v=2" defer></script></body>');
   if(url.searchParams.get('react')==='1')html=html.replace('</body>',`<script type="module" src="${url.searchParams.get('built')==='1'?'/pilot-build/pilot.js':'/src/pilot.tsx'}"></script></body>`);
   res.end(html);return;
  }
  if(file.endsWith('sw.js')){res.statusCode=403;res.end();return;}
  res.end(readFileSync(file));
 });}}],
 define:{'process.env.NODE_ENV':JSON.stringify('production')},
 build:{minify:true,lib:{entry:resolve(import.meta.dirname,'src/pilot.tsx'),formats:['es'],fileName:'pilot'},outDir:'dist',emptyOutDir:true},
 server:{host:'127.0.0.1',port:3321,strictPort:true,fs:{strict:true}},
});
