import {normalizeLanguage} from './language';
import type {Capability} from './contracts';
const verbs:Record<string,string>={colores:'color',precios:'precio',servicios:'servicio',turnos:'turno',reservas:'reserva',clientes:'cliente',horarios:'horario',profesionales:'profesional',cancela:'cancelar',cancelame:'cancelar',reprograma:'reprogramar',reprogramame:'reprogramar',moveme:'mover',move:'mover',cambia:'cambiar',cambiame:'cambiar',cambiale:'cambiar',pone:'cambiar',poneme:'cambiar',crea:'crear',creame:'crear',agendame:'agendar',agendes:'agendar',reservame:'agendar',busca:'buscar',buscame:'buscar',mostrame:'ver',mostra:'ver',muestra:'ver',muestrame:'ver',oculta:'ocultar',publica:'publicar',agrega:'agregar',agregame:'agregar',actualiza:'actualizar',completa:'completar',termina:'terminar',reagendame:'reagendar'};
export const normalize=(value:string)=>normalizeLanguage(value).replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim().split(' ').map(word=>verbs[word]||word).join(' ');
/** Bounded intent matching. It never extracts executable values or starts a command. */
export function recognize(input:string,tools:Capability[]):Capability[]{
 const query=normalize(input);if(query.length<3||/\b(borra|borrar|borrame|borralo|borrala|elimina|eliminar|eliminame|eliminalo|eliminala|destrui|destruir|destruye|drop|truncate)\b/.test(query))return [];
 const exact=tools.filter(t=>[t.title,...t.aliases].some(a=>normalize(a)===query));if(exact.length)return exact;
 const words=query.split(' ').filter(x=>x.length>2&&!['quiero','necesito','para','como','una','los','las','por','favor','puedo','mis'].includes(x));
 return tools.map(tool=>{const vocabulary=normalize([tool.title,...tool.aliases].join(' ')).split(' ');return{tool,score:words.filter(w=>vocabulary.includes(w)).length}}).filter(x=>x.score>0).sort((a,b)=>b.score-a.score||a.tool.title.localeCompare(b.tool.title)).slice(0,6).map(x=>x.tool);
}
