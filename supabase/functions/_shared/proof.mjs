const bytes=value=>new TextEncoder().encode(value);
const encode=value=>btoa(String.fromCharCode(...bytes(value))).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
const decode=value=>new TextDecoder().decode(Uint8Array.from(atob(value.replaceAll('-','+').replaceAll('_','/')),c=>c.charCodeAt(0)));
export function createProof({secret,now=Date.now}){
 const key=crypto.subtle.importKey('raw',bytes(secret),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);
 const hex=data=>[...new Uint8Array(data)].map(x=>x.toString(16).padStart(2,'0')).join('');
 return {
  async issue(binding){const body=encode(JSON.stringify({...binding,expires:now()+180000,nonce:crypto.randomUUID()}));const signature=hex(await crypto.subtle.sign('HMAC',await key,bytes(body)));return {challenge:body+'.'+signature,bits:16};},
  async verify(ticket,counter,binding){
   if(typeof ticket!=='string'||ticket.length>1024||!Number.isSafeInteger(counter)||counter<0||counter>4294967295)return false;
   const [body,signature,...rest]=ticket.split('.');if(rest.length||!body||!/^[a-f0-9]{64}$/.test(signature||''))return false;
   const signed=Uint8Array.from(signature.match(/../g),v=>parseInt(v,16));if(!await crypto.subtle.verify('HMAC',await key,signed,bytes(body)))return false;
   let decoded;try{decoded=JSON.parse(decode(body));}catch{return false;}
   if(!Number.isFinite(decoded.expires)||decoded.expires<=now()||decoded.expires>now()+180000||Object.entries(binding).some(([k,v])=>decoded[k]!==v))return false;
   const hash=new Uint8Array(await crypto.subtle.digest('SHA-256',bytes(ticket+':'+counter)));return hash[0]===0&&hash[1]===0;
  }
 };
}
