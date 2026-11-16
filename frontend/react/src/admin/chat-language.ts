import {extractEntities} from '../iatry/v3/entities';
import {normalizeLanguage} from '../iatry/v3/language';
import {calendarDay} from '../iatry/v3/temporal';
import type {Data} from './api';
import type {TargetKind} from './chat-catalogue';
export const adminLanguage=(text:string)=>normalizeLanguage(text).replace(/[¿?¡!.,;:]/g,' ').replace(/\s+/g,' ').trim();
export const isAdminAffirmation=(text:string)=>/^(?:si|confirmo|confirmar|dale|ofi|de una|ejecuta|ejecutar|hacelo|adelante|de acuerdo)$/.test(adminLanguage(text));
export const isDraftCancellation=(text:string)=>/^(?:cancelar|cancela|cancelalo|dejalo|no sigas|cancelar operacion|cancelar propuesta|descartar)$/.test(adminLanguage(text));
const quantities:Record<string,number>={un:1,una:1,uno:1,dos:2,tres:3,cuatro:4,cinco:5,seis:6,siete:7,ocho:8,nueve:9,diez:10,once:11,doce:12,trece:13,catorce:14,quince:15,veinte:20,treinta:30,sesenta:60,noventa:90};
export function periodDays(source:string,plain=false){const s=adminLanguage(source),m=s.match(/\b(\d{1,4}|un|una|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|trece|catorce|quince|veinte|treinta|sesenta|noventa)\s*(dias?|semanas?)\b/)||(plain?s.match(/^(\d{1,4}|catorce|quince|treinta)$/):null);if(!m)return;const n=quantities[m[1]]??Number(m[1]);return n*(m[2]?.startsWith('semana')?7:1)}
/** Vocabulary describes operations, never authorization. Ambiguous verbs return multiple choices. */
export function adminIntents(source:string,current?:string):string[]{
 const s=adminLanguage(source),has=(p:RegExp)=>p.test(s),read=has(/\b(ver|consulta\w*|mostra\w*|busca\w*|lista\w*|cuanto\w*|cuales|resumen|revisa\w*)\b/);
 if(has(/\b(elimin\w*|borra\w*)\b/)&&has(/\bnegocio\w*\b/))return['business_delete'];
 if(has(/\b(anonimiz\w*|solicitar baja|solicitud de baja)\b/))return[has(/\bnegocio\b/)?'business_deletion_request':'deletion_request'];
 if(has(/\b(limpi\w*|archiva\w*)\b/)&&has(/\b(correo\w*|contenid\w*|terminal\w*)\b/))return['mail_archive'];
 if(has(/\b(retencion|conservacion|conservar)\b/)&&!read)return['retention_policy'];
 if(has(/\b(reintent\w*|reenvia\w*)\b/))return['mail_retry'];
 if(has(/\b(cancel\w*|omiti\w*)\b/)&&has(/\b(correo\w*|mensaje\w*|envio\w*)\b/))return['mail_cancel'];
 if(has(/\b(revoca\w*|cerrar todas las sesiones|cerra las sesiones)\b/))return['revoke_sessions'];
 if(has(/\b(retira\w*|quita\w*|desvincula\w*)\b/)&&has(/\b(membresia|acceso|equipo)\b/))return['remove_membership'];
 if(has(/\b(registr\w*|crea\w*|nueva|abri\w*)\b/)&&has(/\b(incidencia|reporte|caso)\b/))return['incident_create'];
 if(has(/\b(resolv\w*|resolve\w*|cerr\w*|prioridad|gestiona\w*|actualiza\w*)\b/)&&has(/\b(incidencia|caso)\b/))return['incident'];
 if(has(/\bseguimiento\b/)&&!read)return['followup'];
 if(has(/\b(comprob\w*|verifica\w*)\b/)&&has(/\b(pago|cobro|transferencia)\b/))return['verify_payment'];
 if(has(/\b(cambia\w*|ajusta\w*|modifica\w*|edita\w*)\b/)&&has(/\b(capacidad|whatsapp central|impuestos|reserva de seguridad|configuracion comercial)\b/))return['commercial'];
 if(has(/\b(cambia\w*|ajusta\w*|modifica\w*|edita\w*)\b/)&&has(/\b(plan|precio|limite|capacidad)\b/))return['plan'];
 if(has(/\b(cancela\w*|estado)\b/)&&has(/\bsolicitud\b/))return['request_state'];
 if(has(/\b(pausa\w*|bloquea\w*|restablece\w*|reanuda\w*|habilita\w*)\b/)&&has(/\breserva\w*\b/))return['reservations'];
 if(has(/\b(pausa\w*|desactiva\w*|activa\w*|reanuda\w*)\b/)&&has(/\b(correo\w*|envio\w*|mail)\b/))return has(/\b(global|plataforma|todos los negocios)\b/)?['global_mail']:['business_mail'];
 if(has(/\b(desbloquea\w*|bloquea\w*)\b/))return has(/\b(cuenta|usuario|persona|acceso)\b/)?['block_user']:current==='block_user'?['block_user']:['block_user','reservations','subscription'];
 if(has(/\b(diagnostico|diagnostica\w*)\b/))return has(/\b(negocio|reserva\w*)\b/)?['read.diagnostic']:['read.system'];
 if(!read&&has(/\b(habilita\w*|activa\w*|renov\w*|renuev\w*|prueba|cortesia|suspend\w*|restablece\w*|baja)\b/))return['subscription'];
 if(!read&&has(/\bcancela\w*\b/))return current==='subscription'?['subscription']:['subscription','request_state','mail_cancel'];
 if(read){if(has(/\b(negocio\w*|habilitacion\w*|vencimiento\w*)\b/))return['read.businesses'];if(has(/\b(usuario\w*|cuenta\w*|sesion\w*|membresia\w*)\b/))return['read.users'];if(has(/\b(incidencia\w*|soporte|caso\w*)\b/))return['read.incidents'];if(has(/\b(correo\w*|envio\w*|mail)\b/))return['read.mail'];if(has(/\b(auditoria|historial|seguridad)\b/))return['read.audit'];if(has(/\b(finanza\w*|ingreso\w*|cobro\w*)\b/))return['read.finance'];if(has(/\bsolicitud\w*\b/))return['read.requests'];if(has(/\b(plan\w*|configuracion)\b/))return['read.settings'];if(has(/\b(almacenamiento|datos|respaldo)\b/))return['read.storage'];if(has(/\b(resumen|plataforma|pendiente\w*)\b/))return['read.overview'];}
 return [];
}
export function adminDatePhrases(source:string){const from=source.match(/\bdesde\s+(.+?)(?=\s+hasta|[,;]|$)/i),to=source.match(/\bhasta\s+(.+?)(?=[,;]|$)/i);return {...(from?{starts_day:from[1]}:{}),...(to?{until_day:to[1]}:{})}}
export function subscriptionAction(source:string){const s=adminLanguage(source);if(/\b(prueba|trial)\b/.test(s))return'trial';if(/\bren(?:ov|uev)\w*\b/.test(s))return'renew';if(/\b(suspend\w*|bloqueo inmediato)\b/.test(s))return'suspend';if(/\b(restablece\w*|restaur\w*)\b/.test(s))return'restore';if(/\b(baja|cancel\w*)\b/.test(s))return'cancel';return undefined}
export function adminSlots(source:string,tool:string,baseDay:string):Data{
 const s=adminLanguage(source),out:Data={},days=periodDays(source);if(days!==undefined)out.days=days;
 if(tool==='subscription'){const op=subscriptionAction(source);if(op)out.subscription_action=op;const plan=s.match(/\b(individual|negocio|pro)\b/);if(plan&&/\bplan\b/.test(s))out.plan=plan[1];if(/\b(gratis|gratuita|gratuito|sin cargo|cortesia)\b/.test(s))out.amount_uyu=0;const m=s.match(/(?:importe|monto|pago|por)\s*\$?\s*(\d+)\s*(?:uyu|pesos)?\b/);if(m)out.amount_uyu=Number(m[1]);const from=source.match(/\bdesde\s+(.+?)(?=\s+hasta|[,;]|$)/i),to=source.match(/\bhasta\s+(.+?)(?=[,;]|$)/i);if(from){const d=calendarDay(from[1],baseDay);if(d)out.starts_day=d}if(to){const d=calendarDay(to[1],baseDay);if(d)out.until_day=d}}
 if(tool==='plan'){const e=extractEntities(source);if(e.price_uyu!==undefined)out.price_uyu=Number(e.price_uyu);const staff=s.match(/(?:hasta |limite de )?(\d+) profesionales/),mail=s.match(/(\d+) correos/);if(staff)out.staff_limit=Number(staff[1]);if(mail)out.mail_limit=Number(mail[1]);}
 if(['business_mail','global_mail'].includes(tool)){if(/\b(pausa\w*|desactiva\w*)\b/.test(s))out.paused=true;if(/\b(reanuda\w*|activa\w*)\b/.test(s))out.paused=false;}
 if(tool==='block_user'){if(/\bdesbloquea\w*\b/.test(s))out.blocked=false;else if(/\bbloquea\w*\b/.test(s))out.blocked=true;}
 if(tool==='reservations'){if(/\b(restablece\w*|reanuda\w*|habilita\w*)\b/.test(s))out.scope='none';else if(/\b(publica\w*|online|web)\b/.test(s))out.scope='public';else if(/\b(todas|manuales)\b/.test(s))out.scope='all';}
 if(tool==='incident'){if(/\b(resuelta|resolve\w*|resolv\w*|cerra\w*)\b/.test(s))out.state='resolved';const p=s.match(/\bprioridad (baja|normal|alta|critica)\b/);if(p)out.priority=({baja:'low',normal:'normal',alta:'high',critica:'critical'})[p[1] as 'baja'];}
 if(tool==='request_state'){if(/\bcancel\w*\b/.test(s))out.state='cancelled';if(/esperando pago|pendiente de pago/.test(s))out.state='pending_payment';if(/por verificar|pendiente de verificacion/.test(s))out.state='pending_verification';}
 for(const [key,pattern] of [['reason',/(?:motivo|evidencia)\s*[:=]\s*(.+)$/i],['note',/nota\s*[:=]\s*(.+)$/i],['reference',/referencia\s*[:=]\s*(.+)$/i]] as const){const m=source.match(pattern);if(m)out[key]=m[1].trim()}
 return out;
}
export function targetSearch(source:string,kind:TargetKind){const quoted=source.match(/["“]([^"”]{2,100})["”]/);if(quoted)return quoted[1];const nouns=kind==='user'?'cuenta|usuario|persona':kind==='incident'?'incidencia|caso':kind==='request'?'solicitud':kind==='plan'?'plan':'negocio';const m=source.match(new RegExp('(?:'+nouns+')\\s+(?:llamad[oa]\\s+)?(.+?)(?=\\s+(?:por|durante|hasta|desde|con|una prueba|prueba|gratis)\\b|[,;]|$)','i'));return m&&!/^(?:este|ese|aquel|el|la|que|de|segundo|primero|ultimo|\d+)/i.test(m[1])?m[1].trim().slice(0,100):''}
