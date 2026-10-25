// IAtry V1.2: original inert body; only ESM packaging adapted.
const cleanList=v=>Array.isArray(v)?[...new Set(v.filter(x=>typeof x==='string'&&x.length<80))].slice(-30):[];
function normalize(v={}){return {version:'1.2',seen:cleanList(v.seen),dismissed:cleanList(v.dismissed),skipped:cleanList(v.skipped),tours:cleanList(v.tours),disabled:v.disabled===true,motionOff:v.motionOff===true,introduced:v.introduced===true||cleanList(v.seen).includes('welcome'),...(typeof v.hadServices==='boolean'?{hadServices:v.hadServices}:{})};}
function createMemory(storage,key){
 let current=normalize();
 // Read once per scoped session, avoiding synchronous storage work on every render.
 try{const raw=JSON.parse(storage?.getItem(key)||'null');if(raw&&typeof raw==='object')current=normalize(raw);}catch{}
 const read=()=>({...current,seen:[...current.seen],dismissed:[...current.dismissed],skipped:[...current.skipped],tours:[...current.tours]});
 function write(patch){current=normalize({...current,...patch});try{storage?.setItem(key,JSON.stringify(current));}catch{}return read();}
 function mark(id,kind='seen'){
  if(!['seen','dismissed','skipped','tours'].includes(kind))return read();
  const patch={[kind]:[...new Set([...current[kind],id])]};
  if(kind!=='tours')patch.seen=[...new Set([...current.seen,id])];
  if(id==='welcome')patch.introduced=true;
  return write(patch);
 }
 return {read,write,mark};
}
const api={createMemory,normalize};
export default api;
