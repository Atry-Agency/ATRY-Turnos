import {defineConfig} from 'vite';
import {createRequire} from 'node:module';
const {finalize}=createRequire(import.meta.url)('../../scripts/react/build-assets.cjs') as {finalize:(directory:string)=>unknown};
import {readFileSync,existsSync,statSync,cpSync,mkdirSync} from 'node:fs';
import {resolve,sep,extname} from 'node:path';
const web=resolve(import.meta.dirname,'../../web');
export default defineConfig({
 base:'./',
 plugins:[{name:'inert-browser-cores',enforce:'pre',transform(code,id){const cores:Record<string,string>={'theme-core.js':'ATRY_THEME_CORE','agenda-core.js':'ATRY_AGENDA','visit-core.js':'ATRY_VISIT_CORE','visit-demo.js':'ATRY_VISIT_DEMO','whatsapp-core.js':'AtryWhatsApp','whatsapp-demo.js':'ATRY_WHATSAPP_DEMO','staff-photo-core.js':'AtryStaffPhoto','read-cache.js':'createAtryReadCache','demo.js':'ATRY_DEMO'};const name=Object.keys(cores).find(name=>id===resolve(web,name));if(!name)return;return {code:code.replace(/\bmodule\b/g,'__atry_browser_module').replace(/\brequire\s*\(/g,'__atry_browser_require(')+'\nexport default globalThis.'+cores[name]+';',map:null};}},{name:'isolated-legacy-demo',configureServer(server){server.middlewares.use((req,res,next)=>{
  const url=new URL(req.url||'/','http://localhost');
  if(url.pathname.startsWith('/pilot-build/')){const dist=resolve(import.meta.dirname,'dist'),file=resolve(dist,'.'+decodeURIComponent(url.pathname.slice('/pilot-build'.length)));if(!file.startsWith(dist+sep)||!file.endsWith('.js')||!existsSync(file)||!statSync(file).isFile()){res.statusCode=404;res.end();return;}res.setHeader('Content-Type','text/javascript');res.setHeader('Cache-Control','no-store');res.end(readFileSync(file));return;}
  if(url.pathname.startsWith('/api/')){res.statusCode=403;res.end('Experimental demo: API disabled');return;}
  if(url.pathname.startsWith('/assets/')){const asset=resolve(web,'.'+decodeURIComponent(url.pathname));if(!asset.startsWith(resolve(web,'assets')+sep)||!existsSync(asset)||!statSync(asset).isFile())return next();const mime:Record<string,string>={'.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.ttf':'font/ttf','.otf':'font/otf'};res.setHeader('Content-Type',mime[extname(asset)]||'application/octet-stream');res.end(readFileSync(asset));return;}
  if(!url.pathname.startsWith('/legacy/'))return next();
  res.setHeader('Cache-Control','no-store');
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self' ws://127.0.0.1:3321; worker-src 'none'; form-action 'none'; frame-src "+(url.pathname.endsWith('/descubrir.html')?"'self'":"'none'"));
  let file=resolve(web,'.'+decodeURIComponent(url.pathname.slice('/legacy'.length)));
  if(!file.startsWith(web+sep)&&file!==web){res.statusCode=403;res.end();return;}
  if(file===web||file===web+sep||url.pathname==='/legacy/')file=resolve(web,'index.html');
  if(!existsSync(file)||!statSync(file).isFile()){res.statusCode=404;res.end();return;}
  if(!['.html','.js','.css','.png','.svg','.jpg','.webp','.webmanifest','.ttf','.otf'].includes(extname(file))){res.statusCode=403;res.end();return;}
  const types:Record<string,string>={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.ttf':'font/ttf','.otf':'font/otf','.jpg':'image/jpeg','.webp':'image/webp','.webmanifest':'application/manifest+json'};
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
 });},closeBundle(){const target=resolve(import.meta.dirname,'dist/assets');mkdirSync(target,{recursive:true});cpSync(resolve(web,'assets'),target,{recursive:true});finalize(resolve(import.meta.dirname,'dist'));}}],
 define:{'process.env.NODE_ENV':JSON.stringify('production')},
 build:{minify:true,rollupOptions:{input:{app:resolve(import.meta.dirname,'index.html'),landing:resolve(import.meta.dirname,'descubrir.html'),...(process.env.ATRY_COMPARISON_BUILD==='1'?{pilot:resolve(import.meta.dirname,'src/pilot.tsx')}:{})},output:{entryFileNames:chunk=>chunk.name==='pilot'?'pilot.js':'assets/[name]-[hash].js',chunkFileNames:'[name]-[hash].js'}},outDir:'dist',emptyOutDir:true},
 server:{host:'127.0.0.1',port:3321,strictPort:true,fs:{strict:true,allow:[resolve(import.meta.dirname),web,resolve(import.meta.dirname,'../../cloud')]}},
});
