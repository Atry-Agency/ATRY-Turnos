'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
test('Caché: recursos bajo /ATRY-Turnos/, sin interceptar Auth, datos privados ni cachés ajenas',async()=>{
 const handlers={},added=[],deleted=[],scope='https://atry-agency.github.io/ATRY-Turnos/',prefix='atry-turnos-shell-'+encodeURIComponent(scope)+'-';
 const context={URL,self:{registration:{scope},addEventListener:(name,fn)=>handlers[name]=fn,skipWaiting:async()=>{},clients:{claim:async()=>{}}},caches:{open:async()=>({addAll:async urls=>added.push(...urls)}),keys:async()=>['other-app-cache',prefix+'v6',prefix+'v7','atry-turnos-shell-other-path-v6'],delete:async key=>deleted.push(key)}};
 vm.runInNewContext(fs.readFileSync('web/sw.js','utf8'),context);let pending;handlers.install({waitUntil:promise=>pending=promise});await pending;assert.ok(added.every(url=>url.startsWith(scope)));
 handlers.activate({waitUntil:promise=>pending=promise});await pending;assert.deepEqual(deleted,[prefix+'v6']);
 for(const url of [scope+'api/customers',scope+'?code=private-code','https://project.supabase.co/rest/v1/businesses'])handlers.fetch({request:{method:'GET',url},respondWith:()=>assert.fail('Interceptó datos privados')});
});
