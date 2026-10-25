'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const publicFile=file=>/^\/[a-zA-Z0-9_./-]+\.(html|js|css|png|jpg|webp|svg|woff2|ttf|otf|webmanifest)$/.test(file)&&!file.includes('..')&&!['/pilot.js','/sw.js'].includes(file);
function list(directory){return fs.readdirSync(directory,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?list(path.join(directory,entry.name)):[path.join(directory,entry.name)]);}
function finalize(directory){const root=path.resolve(directory),files=list(root).map(file=>'/'+path.relative(root,file).split(path.sep).join('/')).filter(publicFile).sort(),digest=crypto.createHash('sha256');for(const file of files)digest.update(file).update(fs.readFileSync(path.join(root,file)));const version=digest.digest('hex').slice(0,16),precache=files.filter(file=>/\.(html|js|css|webmanifest)$/.test(file)||/^\/assets\/[^/]+-[\w-]+\.(otf|ttf|woff2)$/.test(file)||['/assets/brand/atry.png','/assets/brand/favicon.png'].includes(file));
 const source=`'use strict';
// Static public build files only. API, session responses and private tokens never enter this cache.
const SCOPE=new URL(self.registration.scope),PREFIX='atry-turnos-react-shell-'+encodeURIComponent(SCOPE.href)+'-',OLD='atry-turnos-shell-'+encodeURIComponent(SCOPE.href)+'-',CACHE=PREFIX+${JSON.stringify(version)},FILES=${JSON.stringify(files)},PRECACHE=${JSON.stringify(precache)};
const allowed=new Set(FILES.map(file=>new URL('.'+file,SCOPE).pathname));
const key=url=>new URL(url.pathname===SCOPE.pathname?'./index.html':url.pathname,SCOPE).href;
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(PRECACHE.map(file=>new URL('.'+file,SCOPE).href))).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(name=>(name.startsWith(PREFIX)&&name!==CACHE)||name.startsWith(OLD)).map(name=>caches.delete(name)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{const url=new URL(event.request.url);if(event.request.method!=='GET'||url.origin!==SCOPE.origin||(!allowed.has(url.pathname)&&url.pathname!==SCOPE.pathname))return;
 const queries=[...url.searchParams.keys()];if(queries.some(name=>!['v','source','demo','plan','capture','showcase','demo_name','demo_theme'].includes(name)))return;
 const cacheKey=key(url),store=queries.every(name=>['v','source'].includes(name));
 event.respondWith(fetch(event.request,{cache:'no-store'}).then(response=>{if(response.ok&&store)caches.open(CACHE).then(cache=>cache.put(cacheKey,response.clone())).catch(()=>{});return response;}).catch(async()=>{const cached=await caches.match(cacheKey);if(cached)return cached;throw Error('No hay conexión para cargar este recurso.');}));
});
`;
 fs.writeFileSync(path.join(root,'sw.js'),source);const all=[...files,'/sw.js'].sort();fs.writeFileSync(path.join(root,'react-assets.json'),JSON.stringify(all));return {files:all,version};}
module.exports={finalize,publicFile};
