'use strict';
// Independent, read-only probe. No privileged key, customer data or test bookings.
async function probe(fetchImpl=fetch){
 const base='https://atry-agency.github.io/ATRY-Turnos/',checked_at=new Date().toISOString(),results=[];
 for(const asset of ['index.html','runtime-config.js','control-center.js']){
  try{const r=await fetchImpl(base+asset,{signal:AbortSignal.timeout(15000),cache:'no-store'});const text=await r.text();if(!r.ok)throw new Error('HTTP_'+r.status);
   if(asset==='runtime-config.js'){const config=JSON.parse(text.slice(text.indexOf('=')+1).trim().replace(/;$/,''));if(config.supabaseUrl!=='https://djoxdtloqwbrhgtgencc.supabase.co')throw new Error('WRONG_PROJECT');}
   results.push({component:asset,status:'http_confirmed',http_status:r.status});
  }catch(e){results.push({component:asset,status:'error',code:String(e.message).slice(0,80)});}
 }
 return {checked_at,source:'Comprobación externa HTTP',results,auth:'unknown',database:'unknown',brevo:'unknown',note:'Una respuesta HTTP no certifica reservas, Auth o entrega de correo.'};
}
if(require.main===module)probe().then(r=>{console.log(JSON.stringify(r,null,2));if(r.results.some(x=>x.status==='error'))process.exitCode=1;});
module.exports={probe};
