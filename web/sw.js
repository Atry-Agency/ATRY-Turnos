// Sólo recursos públicos estáticos. Nunca guardar en caché información de clientes ni respuestas privadas.
const CACHE='atry-turnos-shell-v6';
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(['/','/styles.css?v=6','/product.css?v=6','/app.js?v=6','/features.js?v=6','/management.js?v=6','/assets/brand/atry.png','/assets/brand/favicon.png'])).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{if(e.request.method!=='GET'||new URL(e.request.url).pathname.startsWith('/api/'))return;
 e.respondWith(fetch(e.request,{cache:'no-store'}).catch(()=>caches.match(e.request)));});
