import {language} from './intent-catalogue';
/** Explicit topics outrank an elliptical reference to the previous result set. */
export function conversationTopics(source:string):string[]{
 const s=language(source),topics:Array<[string,RegExp]>=[['services',/\b(?:servicios?|catalogo)\b/],['customers',/\b(?:clientes?|fichas?|contactos?)\b/],['team',/\b(?:profesional(?:es)?|equipo|empleados?|integrantes?)\b/],['schedule',/\b(?:horarios?|descansos?|pausas?|ausencias?|vacaciones|bloqueos?|dias? libres?|no trabajo|no atiendo)\b/],['bookings',/\b(?:reservas?|turnos?|agenda)\b/],['business',/\b(?:negocio|estadisticas|indicadores)\b/]];
 return topics.filter(([,pattern])=>pattern.test(s)).map(([topic])=>topic);
}
/** Acknowledging a proposal never represents the visual consent or a command. */
export function isConversationalConfirmation(source:string){return /^(?:si[, ]+)?(?:confirmo|confirmar|de acuerdo|confirmado|si,? confirmo)[.! ]*$/.test(language(source));}
const ranks:Record<string,number>={primer:0,primero:0,primera:0,segundo:1,segunda:1,tercer:2,tercero:2,tercera:2,cuarto:3,cuarta:3,quinto:4,quinta:4,sexto:5,sexta:5,septimo:6,septima:6,octavo:7,octava:7,noveno:8,novena:8,decimo:9,decima:9};
/** Position markers only; amounts, durations, dates and unqualified digits are not list indices. */
export function resultPositions(source:string):number[]{
 const s=language(source),positions:number[]=[];
 for(const match of s.matchAll(/\b(?:el|la|al|del|numero|nro)\s+(primer[oa]?|segund[oa]|tercer[oa]?|cuart[oa]|quint[oa]|sext[oa]|septim[oa]|octav[oa]|noven[oa]|decim[oa])\b/g))positions.push(ranks[match[1]]);
 if(Object.hasOwn(ranks,s))positions.push(ranks[s]);
 for(const match of s.matchAll(/(?:\b(?:el|la|al|del|numero|nro)\s+|#\s*)(\d{1,3})(?:[ºª°])?(?![\d.,:])(?!\s*(?:pesos|uyu|minutos?|horas?|%|de\s+(?:enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre))\b)\b/g))positions.push(Number(match[1])-1);
 return [...new Set(positions)];
}
