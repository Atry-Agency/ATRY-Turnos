'use strict';
// Memory only: never persist private data, credentials, availability or public tokens.
(function(scope){
 function createReadCache({clock=Date.now,limit=60}={}){
  const entries=new Map();let generation=0;
  const ttl=route=>/^\/api\/business\/[A-Za-z0-9_-]+$/.test(route)?15000:/^\/api\/business\/[A-Za-z0-9_-]+\/(services|staff|scheduling|time-off)$/.test(route)?20000:/^\/api\/business\/[A-Za-z0-9_-]+\/(dashboard|customers|bookings|recurring|waitlist|insights)(\?|$)/.test(route)?5000:0;
  const clone=value=>structuredClone(value);
  return {
   clear(){generation++;entries.clear();},
   async read(route,load,{namespace='',fresh=false}={}){
    const duration=ttl(route);if(!duration||!namespace)return load();
    const key=namespace+'|'+route,existing=entries.get(key);
    if(!fresh&&existing&&(existing.pending||existing.expires>clock()))return clone(await existing.promise);
    const version=generation,entry={pending:true,expires:0};
    entry.promise=Promise.resolve().then(load).then(value=>{
     if(generation===version&&entries.get(key)===entry){entry.pending=false;entry.expires=clock()+duration;}
     return value;
    },error=>{if(entries.get(key)===entry)entries.delete(key);throw error;});
    if(entries.size>=limit)entries.delete(entries.keys().next().value);
    entries.set(key,entry);return clone(await entry.promise);
   }
  };
 }
 if(typeof module==='object'&&module.exports)module.exports={createReadCache};else scope.createAtryReadCache=createReadCache;
})(typeof window==='undefined'?{}:window);
