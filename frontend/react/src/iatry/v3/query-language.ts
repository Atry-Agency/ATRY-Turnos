import {normalizeLanguage} from './language';
const mutation=/\b(?:marca\w*|registra\w*|cancela\w*|cambia\w*|borra\w*|elimina\w*|bloquea\w*)\b/;
/** An aggregate question must never become a proposal to mark a person's attendance. */
export function isNoShowInquiry(source:string){
 const text=normalizeLanguage(source);
 return !mutation.test(text)&&/\b(?:quien|quienes|cuantos|cuantas|cuales|ver|mostra|consulta|lista|listado)\b/.test(text)&&/\b(?:no vinieron|no vino|no asistieron|no asistio|faltaron|clientes ausentes|ausencias de clientes)\b/.test(text);
}
/** Only explicit person searches imply a client search without the word «cliente». */
export function customerSearchTarget(source:string):string|undefined{
 const match=source.trim().match(/^(?:(?:fren|mopri|por favor)[,\s]+)*(?:busc[aá](?:me|r)?|encuentra(?:me)?|busqu[eé](?:me)?)\s+a(?:l| la)?\s+(.+?)[?.!]*$/i);
 if(!match)return;
 const target=match[1].trim();
 if(!target||target.length>80||/\b(?:turno|reserva|cita|horario|servicio|profesional|equipo|negocio|cliente|clientes|todos|todas)\b/.test(normalizeLanguage(target)))return;
 return target;
}
