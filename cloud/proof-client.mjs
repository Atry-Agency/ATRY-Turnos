export function createProofClient(config,{fetchImpl=fetch,WorkerClass=Worker}={}){
 return async({action,key,slug})=>{
  const url=new URL(config.supabaseUrl+'/functions/v1/atry-public');url.searchParams.set('operation','challenge');if(slug)url.searchParams.set('slug',slug);
  const response=await fetchImpl(url,{method:'POST',headers:{apikey:config.supabaseKey,'content-type':'application/json'},body:JSON.stringify({action,key}),signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw new Error(response.status===429?'Demasiadas solicitudes. Esperá un minuto.':'No se pudo iniciar la protección de la reserva.');
  const proof=await response.json();
  const counter=await new Promise((resolve,reject)=>{
   const worker=new WorkerClass(new URL('./proof-worker.js',document.baseURI));
   const finish=(error,value)=>{clearTimeout(timer);worker.terminate();error?reject(new Error(error)):resolve(value);};
   const timer=setTimeout(()=>finish('La verificación venció. Reintentá.'),25000);
   worker.onmessage=event=>event.data.error?finish('No se pudo verificar la reserva.'):finish(null,event.data.counter);
   worker.onerror=()=>finish('No se pudo verificar la reserva.');worker.postMessage(proof);
  });
  return {proof_challenge:proof.challenge,proof_counter:counter};
 };
}
