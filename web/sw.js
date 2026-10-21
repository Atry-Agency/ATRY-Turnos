// Public static assets only. Cache ownership is scoped to this application path.
const PREFIX='atry-turnos-shell-'+encodeURIComponent(self.registration.scope)+'-';
const CACHE=PREFIX+'v55';
const assets=['./agenda.css?v=3','./agenda-core.js?v=1','./agenda.js?v=3','./demo.js?v=3','./business-polish.css?v=10','./logo-editor.js?v=4','./typography.css?v=1','./assets/brand/atry-eurostile-extended.ttf','./assets/brand/atry-eurostile-demi-italic.otf','./assets/brand/atry-eurostile-demi.otf','./assets/brand/atry-eurostile-extended-bold.otf','./assets/brand/atry-eurostile-medium.otf','./workspace.js?v=4','./workspace.css?v=5','./control-center.js?v=12','./control-center.css?v=2','./appearance.js?v=5','./appearance.css?v=22','./commercial.js?v=6','./read-cache.js?v=1','./','./index.html','./styles.css?v=7','./product.css?v=12','./app.js?v=31','./features.js?v=13','./management.js?v=8','./recurring.js?v=1','./onboarding.js?v=12','./subscriptions.js?v=6','./assets/brand/atry.png','./assets/brand/favicon.png'];
const allowed=new Set([...assets,'./cloud-backend.js','./runtime-config.js','./proof-worker.js'].map(file=>new URL(file,self.registration.scope).pathname));
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(assets.map(file=>new URL(file,self.registration.scope).href))).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith(PREFIX)&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url),scope=new URL(self.registration.scope);
 if(event.request.method!=='GET'||url.origin!==scope.origin||!allowed.has(url.pathname)||[...url.searchParams.keys()].some(key=>key!=='v'))return;
 event.respondWith(fetch(event.request,{cache:'no-store'}).then(response=>{
  if(response.ok)caches.open(CACHE).then(cache=>cache.put(event.request,response.clone())).catch(()=>{});
  return response;
 }).catch(()=>caches.match(event.request)));
});
