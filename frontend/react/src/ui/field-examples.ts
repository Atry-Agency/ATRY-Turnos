/** Presentation-only hints. Never supply default values, masks, mutations or validation rules. */
export interface FieldExample {name?:string;label?:string;type?:string;min?:string|number;max?:string|number;autoComplete?:string;minLength?:number;country?:string}
const normalize=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const numeric=(example:number,min?:string|number,max?:string|number)=>{const low=min===undefined?0:Number(min),high=max===undefined?Infinity:Number(max);return 'Ej.: '+Math.min(Number.isFinite(high)?high:example,Math.max(Number.isFinite(low)?low:0,example));};
export function phoneExample(country?:string){return country==='PA'?'+507 6000 0000':country==='UY'?'+598 99 123 456':'Código de país y número';}
export function fieldExample({name='',label='',type='text',min,max,autoComplete,minLength,country}:FieldExample):string|undefined{
 if(['hidden','file','checkbox','radio','color','range','date','time','datetime-local','month','week','button','submit'].includes(type))return undefined;
 const text=normalize(label+' '+name);
 if(type==='email'||type!=='number'&&/email|correo/.test(text))return 'nombre@correo.com';
 if(type==='password')return autoComplete==='new-password'?(minLength?'Al menos '+minLength+' caracteres':'Elegí una contraseña segura'):'Tu contraseña actual';
 if(type==='tel'||/telefono|whatsapp|phone/.test(text))return phoneExample(country);
 if(type==='url'||/sitio web|pagina web/.test(text))return 'https://tu-sitio.com';
 if(type==='number'){
  if(/precio|price|importe|amount/.test(text))return /usd/.test(text)?'Ej.: 10.50':numeric(500,min,max);
  if(/duracion|duration/.test(text))return numeric(30,min,max);
  if(/sena|deposit|porcentaje/.test(text))return numeric(20,min,max);
  if(/buffer|preparacion|limpieza/.test(text))return numeric(10,min,max);
  if(/reminder|recordatorio|horas antes/.test(text))return numeric(24,min,max);
  if(/notice|minima|anticipacion/.test(text))return numeric(/horas/.test(text)?12:60,min,max);
  if(/max_days|cuantos dias|dias\)|\bdays\b/.test(text))return numeric(30,min,max);
  if(/staff|profesionales/.test(text))return numeric(4,min,max);
  if(/mail_limit|correos|capacidad diaria|provider_daily/.test(text))return numeric(200,min,max);
  if(/security_reserve|reserva de seguridad/.test(text))return numeric(30,min,max);
  return numeric(1,min,max);
 }
 if(/confirm_slug/.test(name))return 'Escribí el identificador mostrado arriba';
 if(/slug|enlace personalizado/.test(text))return 'Ej.: mi-estudio';
 if(/business_name|nombre.*negocio|nombre comercial/.test(text))return 'Ej.: Estudio Aurora';
 if(/servicio/.test(text)||name==='service_name')return 'Ej.: Corte de pelo';
 if(/sector|rubro|categoria/.test(text))return 'Ej.: Masajes';
 if(/sala|equipo/.test(text))return 'Ej.: Sala principal';
 if(/motivo|reason/.test(text))return 'Contanos el motivo';
 if(/reference|referencia/.test(text))return 'Ej.: Número de comprobante';
 if(/direccion|address/.test(text))return 'Calle y número de puerta';
 if(/city|ciudad/.test(text))return 'Tu ciudad';
 if(/subject|asunto|descripcion breve/.test(text))return 'Resumí tu consulta en una frase';
 if(/nombre|name/.test(text))return 'Nombre y apellido';
 return label&&!label.includes('?')&&!label.includes('¿')?'Ingresá '+label.charAt(0).toLowerCase()+label.slice(1):'Escribí tu respuesta';
}
