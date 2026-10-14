import {sha256} from '@noble/hashes/sha2.js';
export async function findProof(challenge,bits=16){
 if(typeof challenge!=='string'||challenge.length>1024||bits!==16)throw new Error('Desafío inválido.');
 const encoder=new TextEncoder(),deadline=Date.now()+20000;
 for(let counter=0;counter<4294967295;counter++){
  const hash=sha256(encoder.encode(challenge+':'+counter));if(hash[0]===0&&hash[1]===0)return counter;
  if(counter%4096===0){if(Date.now()>deadline)throw new Error('La verificación tardó demasiado. Reintentá.');await new Promise(resolve=>setTimeout(resolve,0));}
 }
 throw new Error('No se pudo verificar la solicitud.');
}
