/** Country is business-owned. No browser-global selected country or mutable locale singleton. */
export const regions={UY:{country:'UY',name:'Uruguay',timezone:'America/Montevideo',currency:'UYU',locale:'es-UY',phonePrefix:'598'},PA:{country:'PA',name:'Panamá',timezone:'America/Panama',currency:'USD',locale:'es-PA',phonePrefix:'507'}} as const;
export type Country=keyof typeof regions;
export interface RegionalBusiness{country?:string;timezone?:string;currency?:string}
export function region(value:RegionalBusiness={}){
 const country=value.country??'UY';
 if(country!=='UY'&&country!=='PA')throw Error('País no admitido.');
 const r=regions[country];
 if(value.timezone&&value.timezone!==r.timezone||value.currency&&value.currency!==r.currency)throw Error('La configuración regional del negocio no coincide con su país.');
 return r;
}
export function regionalDay(instant:Date|string|number=new Date(),business:RegionalBusiness={}){const p=new Intl.DateTimeFormat('en-CA',{timeZone:region(business).timezone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(instant));const get=(key:string)=>p.find(x=>x.type===key)!.value;return `${get('year')}-${get('month')}-${get('day')}`;}
export function regionalDateTime(instant:Date|string|number,business:RegionalBusiness={}){const date=new Date(instant),time=new Intl.DateTimeFormat('en-GB',{timeZone:region(business).timezone,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(date);return regionalDay(date,business)+'T'+time;}
/** Convert a wall clock to UTC using IANA rules; reject invalid or ambiguous local times. */
export function localInstant(value:string,business:RegionalBusiness={}){
 if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))throw Error('Ingresá una fecha y hora válida.');
 const wall=Date.parse(value+':00Z');if(!Number.isFinite(wall)||new Date(wall).toISOString().slice(0,16)!==value)throw Error('Fecha u hora inválida.');
 region(business);const candidates=new Set<number>();
 for(const shift of [-36,0,36]){const probe=wall+shift*3600000,display=Date.parse(regionalDateTime(probe,business)+':00Z'),offset=display-probe,candidate=wall-offset;if(regionalDateTime(candidate,business)===value)candidates.add(candidate);}
 if(candidates.size!==1)throw Error('La hora local no existe o es ambigua. Elegí otro horario.');
 return new Date([...candidates][0]).toISOString();
}
/** Decimal text -> exact cents. No multiplication of a binary floating-point price. */
export function amountMinor(value:string){const s=value.trim();if(!/^(?:0|[1-9]\d*)(?:[.,]\d{1,2})?$/.test(s))throw Error('Ingresá un importe positivo con hasta dos decimales.');const [whole,fraction='']=s.replace(',','.').split('.'),n=BigInt(whole)*100n+BigInt(fraction.padEnd(2,'0'));if(n>BigInt(Number.MAX_SAFE_INTEGER))throw Error('Importe demasiado grande.');return Number(n);}
export function decimalAmount(minor:number){if(!Number.isSafeInteger(minor)||minor<0)throw Error('Importe inválido.');const n=BigInt(minor);return `${n/100n}.${String(n%100n).padStart(2,'0')}`;}
export function regionalMoney(minor:number,business:RegionalBusiness={}){const r=region(business);const exact=decimalAmount(minor),[whole,cents]=exact.split('.'),fraction=r.currency==='USD'||cents!=='00'?2:0;return new Intl.NumberFormat(r.locale,{style:'currency',currency:r.currency,currencyDisplay:'code',minimumFractionDigits:fraction,maximumFractionDigits:fraction}).formatToParts(Number(whole)).map(part=>part.type==='fraction'?cents:part.value).join('');}
export function legacyUyuMinor(value:number){if(!Number.isSafeInteger(value)||value<0||!Number.isSafeInteger(value*100))throw Error('Importe histórico inválido.');return value*100;}
