// IAtry V1.2: original inert body; only ESM packaging adapted.
import K from './knowledge.js';
import M from './memory.js';
function analyze(services){return {hasServices:Array.isArray(services)?services.some(s=>s.active===true||s.active===1):null};}
function available(c){return !!(c.userId&&c.businessId&&['owner','manager'].includes(c.role)&&!c.dialog&&K.tips[c.view]);}
function eligible(c){return available(c)&&!c.completed;}
function presence(m){return m.tours?.includes('setup')||m.seen.length>=5?'experienced':m.introduced?'familiar':'new';}
function select(c,m,f={}){
 if(!eligible(c)||m.disabled)return null;
 const suppressed=id=>m.seen.includes(id)||m.dismissed?.includes(id);
 if(c.view==='servicios'&&m.hadServices===false&&f.hasServices===true&&!suppressed('service-ready'))return K.celebration;
 if(presence(m)==='experienced')return null;
 const tip=K.tips[c.view];return suppressed(tip.id)?null:tip;
}
const api={knowledge:K.tips,steps:K.steps,version:K.version,analyze,available,eligible,presence,select,createMemory:M.createMemory};
export default api;
