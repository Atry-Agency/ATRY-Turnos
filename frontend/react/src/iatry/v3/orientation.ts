import {normalizeLanguage} from './language';
export type OrientationGoal='setup'|'share';
/** Frontend guidance only. This recognizer cannot prepare or execute an operation. */
export function orientationGoal(source:string):OrientationGoal|undefined{
 const text=normalizeLanguage(source);
 if(!text.trim()||text.length>500||/\b(?:no quiero|no necesito|no compart|no muestres|no envies|no mandes|pago|pagos|cobro|suscripcion|cancel|borra|elimina)\w*\b/.test(text))return;
 const link=/\b(?:enlace|link|pagina)\b/.test(text),share=/\b(?:compart\w*|pasar\w*|enviar\w*|mandar\w*|darle|reserv\w*)\b/.test(text);
 if(link&&share&&!/\b(?:crea\w*|agend\w*|reprogram\w*)\s+(?:una?\s+)?(?:reserva|cita|turno)\b/.test(text))return 'share';
 const beginning=/\b(?:emp(?:ez|iez)\w*|comenz\w*|primeros pasos|reci[eé]n|acabo de contratar|list[oa] para|falta\w*)\b/.test(text);
 if(beginning&&/\b(?:negocio|configur\w*|recibir|reserv\w*|contrat\w*|emp(?:ez|iez)\w*|primeros pasos)\b/.test(text)&&!/\b(?:crea\w*|agend\w*|reprogram\w*)\s+(?:una?\s+)?(?:reserva|cita|turno)\b/.test(text))return 'setup';
}
