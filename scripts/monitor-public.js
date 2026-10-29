'use strict';
// Independent, read-only HTTP probe. Never executes downloaded JavaScript.
const BASE='https://atryturnos.com/';
const PROJECT='https://djoxdtloqwbrhgtgencc.supabase.co';
// Approved release boundary; bundle hashes and the build revision may change.
const APPROVED_TOOLS=['services.list','services.create','services.price','services.duration','services.details','services.publish','services.hide','customers.create','customers.update','customers.search','customers.history','schedule.read','schedule.day','schedule.absence','schedule.blocks','team.list','business.statistics'];
const APPROVED_READS=['services.list','customers.search','customers.history','schedule.read','schedule.blocks','team.list','business.statistics'];
function localAsset(value){
 const url=new URL(value,BASE);
 if(url.origin!==new URL(BASE).origin||url.username||url.password||url.search||url.hash||!url.pathname.endsWith('.js'))throw Error('UNSAFE_ASSET');
 return url;
}
function assignment(text,prefix,suffix=';'){
 const source=text.trim();if(!source.startsWith(prefix)||!source.endsWith(suffix))throw Error('INVALID_METADATA');
 return JSON.parse(source.slice(prefix.length,-suffix.length));
}
async function probe(fetchImpl=fetch){
 const checked_at=new Date().toISOString(),results=[];
 async function check(component,url,validate){
  try{
   const r=await fetchImpl(url,{signal:AbortSignal.timeout(15000),cache:'no-store'});
   if(!r.ok)throw Error('HTTP_'+r.status);
   if(r.url&&new URL(r.url).origin!==new URL(BASE).origin)throw Error('WRONG_DOMAIN');
   const text=await r.text();await validate?.(text);
   results.push({component,status:'http_confirmed',http_status:r.status});return text;
  }catch(e){results.push({component,status:'error',code:String(e.message).slice(0,80)});return null;}
 }
 let entries=[];
 await check('index.html',BASE+'index.html',html=>{
  for(const tag of html.match(/<script\b[^>]*>/gi)||[]){
   const type=tag.match(/\btype\s*=\s*["']([^"']+)["']/i)?.[1];
   const src=tag.match(/\bsrc\s*=\s*["']([^"']+)["']/i)?.[1];
   if(type==='module'&&src)entries.push(localAsset(src));
  }
  if(!entries.length)throw Error('MISSING_REACT_ENTRY');
 });
 await check('runtime-config.js',BASE+'runtime-config.js',text=>{
  const config=assignment(text,'window.ATRY_CONFIG=');
  if(config.supabaseUrl!==PROJECT||config.backend!=='supabase')throw Error('WRONG_PROJECT');
  if(typeof config.supabaseKey!=='string'||!config.supabaseKey.startsWith('sb_publishable_'))throw Error('NON_PUBLIC_KEY');
 });
 let files=[];
 await check('react-assets.json',BASE+'react-assets.json',text=>{
  files=JSON.parse(text);if(!Array.isArray(files)||!files.length||files.some(x=>typeof x!=='string'||!x.startsWith('/')||x.includes('..')))throw Error('INVALID_MANIFEST');
  for(const entry of entries)if(!files.includes(entry.pathname))throw Error('ENTRY_NOT_IN_MANIFEST');
 });
 for(const entry of [...new Map(entries.map(x=>[x.href,x])).values()])await check('react-entry:'+entry.pathname,entry.href,text=>{if(!text.trim()||/^\s*</.test(text))throw Error('INVALID_JAVASCRIPT');});
 await check('iatry-operational-audit.js',BASE+'iatry-operational-audit.js',text=>{
  const audit=assignment(text,'globalThis.ATRY_IATRY_BUILD=Object.freeze(',');');
  if(audit.project!==PROJECT)throw Error('WRONG_PROJECT');
  if(audit.understanding?.automaticExecution!==false)throw Error('UNSAFE_AUTOMATIC_EXECUTION');
  if(audit.scope?.role!=='owner'||audit.scope?.plan!=='negocio')throw Error('UNEXPECTED_SCOPE');
  if(!Array.isArray(audit.reads)||!Array.isArray(audit.writes))throw Error('UNEXPECTED_TOOL_SCOPE');
  const enabled=[...audit.reads,...audit.writes];
  if(enabled.length!==APPROVED_TOOLS.length||new Set(enabled).size!==enabled.length||enabled.some(id=>!APPROVED_TOOLS.includes(id)))throw Error('UNEXPECTED_TOOL_SCOPE');
  if(audit.reads.length!==APPROVED_READS.length||audit.reads.some(id=>!APPROVED_READS.includes(id))||audit.writes.some(id=>APPROVED_READS.includes(id)))throw Error('UNEXPECTED_TOOL_ACCESS');
  if(JSON.stringify(audit.fieldRestrictions?.['customers.update'])!==JSON.stringify(['notes']))throw Error('UNSAFE_CUSTOMER_FIELDS');
  if(!Array.isArray(audit.publicDemo?.writes)||audit.publicDemo.writes.length)throw Error('UNSAFE_DEMO_WRITES');
 });
 return {checked_at,source:'Comprobación externa HTTP',results,auth:'unknown',database:'unknown',brevo:'unknown',note:'Una respuesta HTTP y la declaración del artefacto no certifican permisos del servidor, reservas, Auth o entrega de correo.'};
}
if(require.main===module)probe().then(r=>{console.log(JSON.stringify(r,null,2));if(r.results.some(x=>x.status==='error'))process.exitCode=1;});
module.exports={probe};
