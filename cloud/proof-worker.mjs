import {findProof} from './proof-work.mjs';
self.onmessage=async event=>{try{self.postMessage({counter:await findProof(event.data.challenge,event.data.bits)});}catch{self.postMessage({error:true});}};
