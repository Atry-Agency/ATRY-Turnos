import type {CloseoutDraft} from './closeout-model';
const prefix='atry-closeout-draft:v2:';
export function draftKey(user:string,business:string,session:string){return prefix+[user,business,session].map(encodeURIComponent).join(':')}
const object=(x:unknown):x is Record<string,unknown>=>Boolean(x)&&typeof x==='object'&&!Array.isArray(x);
const text=(x:unknown,max=500)=>typeof x==='string'&&x.length<=max;
export function readDraft(key:string,now=Date.now()):CloseoutDraft|null{
 try{const raw=sessionStorage.getItem(key);if(!raw)return null;const v:unknown=raw.length<=200000?JSON.parse(raw):null;
 const choice=(c:unknown)=>object(c)&&['paid','partial','pending','not_done','outside'].includes(String(c.mode))&&text(c.amount,30)&&text(c.method,100)&&['secondAmount','secondMethod','basePending','baseStatus'].every(k=>c[k]===undefined||text(c[k],100))&&(c.resolve===undefined||typeof c.resolve==='boolean')&&(c.adjustment===undefined||object(c.adjustment)&&['discount','courtesy'].includes(String(c.adjustment.kind))&&['fixed','percent'].includes(String(c.adjustment.mode))&&text(c.adjustment.value,30)&&text(c.adjustment.note));
 const valid=object(v)&&v.version===2&&typeof v.savedAt==='number'&&now-v.savedAt<=86400000&&v.savedAt<=now+60000&&text(v.day,10)&&/^\d{4}-\d{2}-\d{2}$/.test(String(v.day))&&object(v.choices)&&Object.keys(v.choices).length<=500&&Object.values(v.choices).every(choice)&&Array.isArray(v.entries)&&v.entries.length<=40&&v.entries.every(e=>object(e)&&text(e.id,100)&&['income','expense'].includes(String(e.kind))&&text(e.amount,30)&&text(e.note)&&text(e.method,100)&&(e.custom===undefined||typeof e.custom==='boolean')&&(e.services===undefined||Array.isArray(e.services)&&e.services.length<=40&&e.services.every(s=>object(s)&&text(s.id,100)&&text(s.name,500)&&typeof s.unitMinor==='string'&&/^\d{1,18}$/.test(s.unitMinor)&&Number.isInteger(s.quantity)&&Number(s.quantity)>=1&&Number(s.quantity)<=40)))&&['account','initial','recoveryNote','counted','note'].every(k=>text(v[k]))&&['recover','closeCash'].every(k=>typeof v[k]==='boolean')&&['payments','exceptions','extras','cash','review'].includes(String(v.stage))&&['finished','postponed'].includes(String(v.disposition));
 if(!valid){sessionStorage.removeItem(key);return null}return v as unknown as CloseoutDraft;
 }catch{return null}
}
export function saveDraft(key:string,draft:CloseoutDraft){const raw=JSON.stringify({...draft,version:2,savedAt:Date.now()});sessionStorage.setItem(key+':'+draft.day,raw);sessionStorage.setItem(key,raw)}
export function clearDraft(key:string,day?:string){const current=readDraft(key);const selected=day||current?.day;if(selected)sessionStorage.removeItem(key+':'+selected);if(!day||current?.day===day)sessionStorage.removeItem(key)}
export function clearFinancialDrafts(){try{for(const key of Object.keys(sessionStorage))if(key.startsWith(prefix))sessionStorage.removeItem(key)}catch{/* Storage unavailable: there is no draft to read. */}}
