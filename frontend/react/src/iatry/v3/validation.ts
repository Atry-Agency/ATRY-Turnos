import type {Field,Values} from './contracts';
export function validate(field:Field,value:Values[string]):void{
 if(!['multiple','checkbox'].includes(field.type)&&typeof value!=='string')throw Error('Respuesta inválida.');
 const s=typeof value==='string'?value.trim():'';
 if(field.required&&(!s&&(!Array.isArray(value)||!value.length))&&value!==true)throw Error('Completá '+field.label.toLowerCase()+'.');
 if(field.type==='multiple'&&!Array.isArray(value)||field.type==='checkbox'&&typeof value!=='boolean')throw Error('Respuesta inválida.');
 if(field.options){const choices=new Set(field.options.map(x=>x.value));if((Array.isArray(value)?value:typeof value==='string'&&value?[value]:[]).some(x=>!choices.has(x)))throw Error('La selección no está disponible para este negocio.');}
 if(!s)return;
 if(field.type==='number'){const n=Number(s);if(!Number.isInteger(n)||(field.min!==undefined&&n<field.min)||(field.max!==undefined&&n>field.max))throw Error('Revisá el valor de '+field.label.toLowerCase()+'.');}
 else if(field.type==='email'&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s))throw Error('Ingresá un correo válido.');
 else if(field.type==='date'&&(!/^\d{4}-\d\d-\d\d$/.test(s)||!Number.isFinite(Date.parse(s))||new Date(s).toISOString().slice(0,10)!==s))throw Error('Ingresá una fecha válida.');
 else if(field.type==='time'&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(s))throw Error('Ingresá una hora válida.');
 else if(field.type==='color'&&!/^#[0-9a-f]{6}$/i.test(s))throw Error('Elegí un color válido.');
 if(s.length>(field.maxLength??2000))throw Error('La respuesta es demasiado larga.');
}
