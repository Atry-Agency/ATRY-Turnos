'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),http=require('node:http'),vm=require('node:vm'),{buildSync}=require('esbuild');
const root=path.resolve(__dirname,'../..'),dist=path.join(root,'frontend/react/dist');
async function start(){
 const configPath='/private/tmp/iatry-visual-public-config.json';let raw=fs.readFileSync(configPath,'utf8');let config;
 try{config=JSON.parse(raw)}catch{const sandbox={window:{}};vm.runInNewContext(raw,sandbox,{timeout:1000});config=sandbox.window.ATRY_CONFIG}
 if(config.supabaseUrl!=='https://djoxdtloqwbrhgtgencc.supabase.co'||!String(config.supabaseKey).startsWith('sb_publishable_'))throw Error('Falta la configuración pública del proyecto autorizado.');
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'iatry-readonly-validation-'));fs.chmodSync(temp,0o700);
 buildSync({entryPoints:[path.join(__dirname,'iatry-readonly-validation.tsx')],outfile:path.join(temp,'trial.js'),bundle:true,platform:'browser',format:'esm',target:'es2022',jsx:'automatic',nodePaths:[path.join(root,'frontend/react/node_modules')],define:{'process.env.NODE_ENV':'"production"'},logLevel:'silent'});
 const styles=fs.readdirSync(path.join(dist,'assets')).find(file=>/^app-.*\.css$/.test(file));if(!styles)throw Error('Primero compilar React.');
 const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.otf':'font/otf','.ttf':'font/ttf','.woff2':'font/woff2'};
 const server=http.createServer((req,res)=>{if(!/^127\.0\.0\.1:3325$/.test(req.headers.host||'')){res.writeHead(403);res.end();return}if(req.method!=='GET'){res.writeHead(405);res.end();return}const url=new URL(req.url,'http://localhost');res.setHeader('Cache-Control','no-store');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' https://djoxdtloqwbrhgtgencc.supabase.co; font-src 'self'; frame-src 'none'; base-uri 'none'; form-action 'self'");
 if(url.pathname==='/'){res.setHeader('Content-Type','text/html');res.end(`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>IAtry · Lecturas controladas Pelu</title><link rel="stylesheet" href="/assets/${styles}"><link rel="stylesheet" href="/trial.css"><script src="/config.js"></script><script src="/theme-core.js"></script></head><body><div id="root"></div><script type="module" src="/trial.js"></script></body></html>`);return}
 if(url.pathname==='/config.js'){res.setHeader('Content-Type','text/javascript');res.end('window.ATRY_CONFIG='+JSON.stringify({backend:'supabase',supabaseUrl:config.supabaseUrl,supabaseKey:config.supabaseKey})+';');return}
 let file;if(url.pathname==='/theme-core.js')file=path.join(root,'web/theme-core.js');else if(['/trial.js','/trial.css'].includes(url.pathname))file=path.join(temp,path.basename(url.pathname));else if(url.pathname.startsWith('/assets/')&&!url.pathname.includes('..'))file=path.join(dist,url.pathname.slice(1));
 if(!file||!fs.existsSync(file)){res.writeHead(404);res.end();return}res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');fs.createReadStream(file).pipe(res);
 });await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(3325,'127.0.0.1',resolve)});console.log('Ensayo limitado: http://127.0.0.1:3325/ · sesión normal · solo lecturas auditadas · sin otras operaciones');
 for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>server.close(()=>{fs.rmSync(temp,{recursive:true,force:true});process.exit()}));
}
start().catch(()=>{console.error('No se pudo preparar la vista de validación. No se ejecutaron operaciones.');process.exitCode=1});
