import {inputMinor,decodeFinance,type FinanceData} from './model';
export interface CloseoutRow{id:string;starts_at:string;status:string;customer_name:string;service_name:string;staff_name:string;staff_id?:string;visit_id?:string|null;currency:string;price_minor:string;pending_minor:string}
export interface CloseoutPage{finance?:FinanceData;revision:string;date:string;currency:string;rows:CloseoutRow[];next_cursor:{cursor_at:string;cursor_id:string}|null;day_meta?:{last_end_at:string|null;last_review:{recorded_at:string;disposition:string}|null}}
export interface CloseoutAdjustment{kind:'discount'|'courtesy';mode:'fixed'|'percent';value:string;note:string}
export interface CloseoutChoice{mode:'paid'|'partial'|'pending'|'not_done'|'outside';amount:string;method:string;secondAmount?:string;secondMethod?:string;adjustment?:CloseoutAdjustment;resolve?:boolean;basePending?:string;baseStatus?:string}
export interface ExtraService{id:string;name:string;unitMinor:string;quantity:number}
export interface CloseoutEntry{id:string;kind:'income'|'expense';note:string;amount:string;method:string;custom?:boolean;services?:ExtraService[]}
export type CloseoutStage='payments'|'exceptions'|'extras'|'cash'|'review';
export interface CloseoutDraft{version:2;savedAt:number;day:string;choices:Record<string,CloseoutChoice>;entries:CloseoutEntry[];account:string;initial:string;recover:boolean;recoveryNote:string;closeCash:boolean;counted:string;note:string;stage:CloseoutStage;disposition:'finished'|'postponed'}
export function decodeCloseout(v:unknown):CloseoutPage{const x=v as CloseoutPage;if(!x||!/^\d+$/.test(x.revision)||!['UYU','USD'].includes(x.currency)||!Array.isArray(x.rows)||!x.rows.every(r=>typeof r.id==='string'&&typeof r.customer_name==='string'&&typeof r.starts_at==='string'&&/^\d+$/.test(r.pending_minor)&&r.currency===x.currency))throw Error('No pudimos leer las reservas para el cierre.');if(x.finance)x.finance=decodeFinance(x.finance);return x}
export function eligibleCloseout(r:CloseoutRow){return !['cancelled','no_show'].includes(r.status)&&BigInt(r.pending_minor)>0n}
export function adjustmentMinor(row:CloseoutRow,choice?:CloseoutChoice){const a=choice?.adjustment;if(!a)return 0n;const pending=BigInt(row.pending_minor);if(a.kind==='courtesy')return pending;const value=BigInt(inputMinor(a.value));if(a.mode==='percent'){if(value<=0n||value>10000n)throw Error('Ingresá un porcentaje entre 0,01 y 100.');return(pending*value+5000n)/10000n}return value}
export function payableMinor(row:CloseoutRow,choice?:CloseoutChoice){return BigInt(row.pending_minor)-adjustmentMinor(row,choice)}
export function isPayment(c?:CloseoutChoice){return c&&['paid','partial'].includes(c.mode)}
export function choiceErrors(row:CloseoutRow,c:CloseoutChoice|undefined,data:FinanceData,account:string):Record<string,string>{
 const errors:Record<string,string>={};if(!c)return errors;
 if(c.basePending!==undefined&&(c.basePending!==row.pending_minor||c.baseStatus!==row.status))errors.conflict='Cambió esta reserva. Revisá el saldo actualizado antes de confirmar.';
 let allowed=BigInt(row.pending_minor);
 if(c.adjustment){try{const n=adjustmentMinor(row,c);if(n<=0n||n>allowed)errors.discount='El descuento debe ser mayor que cero y no superar lo pendiente.';else allowed-=n}catch(e){errors.discount=(e as Error).message}if(c.adjustment.note.trim().length<4)errors.reason='Contanos el motivo con al menos cuatro caracteres.';if(!data.permissions.includes('refund'))errors.discount='Necesitás permiso para descuentos y cortesías.';}
 if(isPayment(c)&&c.adjustment?.kind!=='courtesy'){
  let total=0n;try{total=BigInt(inputMinor(c.amount));if(total<=0n)errors.amount='Ingresá lo que recibiste, mayor que cero.'}catch(e){errors.amount=(e as Error).message}
  const method=data.methods.find(m=>m.id===c.method);if(!method)errors.method='Elegí un método disponible.';else if(method.cash&&method.account_id!==account)errors.method='Elegí la caja que corresponde a este efectivo.';
  if(c.secondMethod){try{const n=BigInt(inputMinor(c.secondAmount||''));if(n<=0n)errors.secondAmount='Ingresá el segundo importe.';total+=n}catch(e){errors.secondAmount=(e as Error).message}const second=data.methods.find(m=>m.id===c.secondMethod);if(!second||second.id===c.method||second.cash&&second.account_id!==account)errors.secondMethod='Elegí otro método válido para esta caja.';}
  if(total>allowed)errors.amount='Lo recibido supera el saldo después del descuento.';
 }
 return errors;
}
export function closeoutTotals(rows:CloseoutRow[],choices:Record<string,CloseoutChoice>,entries:CloseoutEntry[],data:FinanceData,account:string,initial:string){
 let received=0n,income=0n,expense=0n,cash=0n,discount=0n,remaining=0n;const byMethod:Record<string,bigint>={};let invalid=false;
 const add=(value:string,method:string,sign=1n)=>{let n=0n;try{n=BigInt(inputMinor(value));if(n<=0n)invalid=true}catch{invalid=true}const m=data.methods.find(m=>m.id===method);if(!m)invalid=true;byMethod[method]=(byMethod[method]||0n)+sign*n;if(m?.cash){if(m.account_id!==account)invalid=true;cash+=sign*n}return n};
 for(const r of rows){if(!eligibleCloseout(r))continue;const c=choices[r.id];let adjustment=0n,n=0n;try{adjustment=adjustmentMinor(r,c);discount+=adjustment}catch{invalid=true}if(Object.keys(choiceErrors(r,c,data,account)).length)invalid=true;if(isPayment(c)&&c?.adjustment?.kind!=='courtesy'){n=add(c!.amount,c!.method)+(c!.secondMethod?add(c!.secondAmount||'',c!.secondMethod):0n);received+=n}remaining+=BigInt(r.pending_minor)-adjustment-n;}
 for(const e of entries){const n=add(e.amount,e.method,e.kind==='income'?1n:-1n);if(e.kind==='income')income+=n;else expense+=n;if(e.note.trim().length<3)invalid=true}
 const session=data.sessions.find(s=>s.account_id===account&&!s.closed_at);let base=0n;try{base=session?BigInt(session.expected_minor):BigInt(inputMinor(initial))}catch{/* Requested in the cash step. */}
 return{received,income,expense,cash,discount,remaining,expected:base+cash,net:received+income-expense,byMethod,invalid};
}
