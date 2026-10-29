import type {Capability,Values,EngineState} from './contracts';
/** IAtry's voice is a pure presentation layer. It cannot query, grant access or execute. */
export type VoiceState='question'|'ready'|'correction-pending'|'correction-accepted'|'correction-rejected'|'ambiguity'|'consulting'|'executing'|'verifying'|'review'|'verified'|'error'|'uncertain';
export interface VoiceContext {state:VoiceState;tool?:Pick<Capability,'id'|'area'|'kind'>;values?:Values;question?:string;turn?:number;changes?:{label:string;after:string}[];verified?:boolean;message?:string;conflict?:boolean}
const pick=(options:string[],context:VoiceContext)=>{const key=(context.tool?.id||'')+JSON.stringify(context.values||{})+(context.question||'')+(context.turn||0);let hash=0;for(const char of key)hash=(hash*31+char.charCodeAt(0))>>>0;return options[hash%options.length];};
export function voice(c:VoiceContext):string{
 const v=c.values||{},q=(c.question||'').replace(/^¡(?:Dale|Perfecto|Listo)! /,''),family=c.tool?.id.split('.')[0],name=typeof v.name==='string'?v.name:'';
 switch(c.state){
 case 'question':
  if(family==='services'&&c.tool?.kind==='create'){
   if(!v.name)return pick(['Vamos con ese servicio nuevo. ','Le damos un lugar en tu catálogo. '],c)+q;
   if((v.duration_min===undefined||v.duration_min==='')&&(v.price_uyu===undefined||v.price_uyu===''))return 'Vamos con '+name+'. ¿Cuánto dura y qué precio le ponemos?';
   if(v.duration_min===undefined||v.duration_min==='')return 'Ya tengo el precio'+(name?' de '+name:'')+'. ¿Cuántos minutos dura?';
   if(v.price_uyu===undefined||v.price_uyu==='')return 'La duración ya está. ¿Qué precio le ponemos, en pesos?';
  }
  if(family==='customers'&&c.tool?.kind==='create')return (name?'Seguimos con la ficha de '+name+'. ':'Armemos la ficha del cliente. ')+q;
  if(family==='schedule')return pick(['Vamos a ordenar ese tiempo en tu agenda. ','Dejemos ese período bien definido. '],c)+q;
  return q;
 case 'ready':if(name&&c.tool?.kind!=='read')return pick(['Te dejo '+(family==='customers'?'la ficha':'la propuesta')+' de '+name+' para revisar. Todavía no guardé cambios.','La propuesta para '+name+' está preparada. Revisá los datos antes de seguir.'],c);return c.tool?.kind==='read'?pick(['Ya tengo lo necesario para consultar. ¿Lo vemos?','Podemos consultar esos datos. ¿Seguimos?'],c):pick(['La propuesta está preparada. Mirá los datos antes de seguir.','Así lo podemos dejar. Revisá la propuesta; todavía no guardé cambios.','Ya tengo los datos. Te dejo la propuesta para revisar.'],c);
 case 'correction-pending':return pick(['Antes de seguir, confirmame este ajuste en la propuesta.','Tengo tu corrección. ¿Usamos estos datos en la propuesta?'],c);
 case 'correction-accepted':{const changes=c.changes||[],detail=changes.map(x=>(/duraci[oó]n/i.test(x.label)?'la duración':/precio/i.test(x.label)?'el precio':/nombre/i.test(x.label)?'el nombre':/profesional/i.test(x.label)?'el profesional':x.label.toLowerCase())+' a '+x.after).join(' y ');return (detail?'En la propuesta, ajusté '+detail+'. El resto queda igual.':'Actualicé la propuesta con tu corrección. ')+(q?' '+q:' Todavía no guardé cambios.');}
 case 'correction-rejected':return 'Conservamos los datos anteriores de la propuesta.'+(q?' '+q:'');
 case 'ambiguity':return pick(['Prefiero asegurarme antes de seguir. ','Para preparar lo que necesitás, aclaremos esto. '],c)+q;
 case 'consulting':return pick(['Busco la información que necesitamos…','Voy a consultar los datos disponibles para tu sesión…'],c);
 case 'executing':return 'Estoy enviando el cambio que confirmaste…';
 case 'verifying':return 'Ahora compruebo cómo quedó guardado…';
 case 'review':return pick(['Esta es la propuesta. Revisá los datos y las consecuencias antes de confirmar.','Lo tenemos preparado. Vos decidís si ejecutamos este cambio.'],c);
 case 'verified':return c.verified?pick(['Quedó guardado y comprobado. ','El cambio ya está verificado. '],c)+(c.message||''):'Todavía no pude verificar el resultado. No voy a darlo por completado.';
 case 'uncertain':return 'No pude comprobar cómo quedó. Revisemos el registro antes de volver a intentarlo.';
 case 'error':return c.conflict?pick(['Hay un conflicto que conviene revisar antes de seguir. Te dejo el detalle para resolverlo.','Antes de continuar, revisemos este conflicto. El detalle nos ayuda a decidir cómo seguir.','Este paso encontró un conflicto. Podemos revisar el detalle antes de volver a intentarlo.'],c):pick(['No pude completar este paso. Veamos qué hay que revisar antes de continuar.','Este paso no se pudo completar. Revisemos el detalle antes de seguir.','No pude seguir con la solicitud. Te muestro el detalle para que podamos revisarlo.'],c);
 }
}
/** A celebration belongs only to a verified write or a successful read, never a proposal. */
export function conversationEnergy(state?:EngineState|null){if(!state)return undefined;if(state.social&&state.phase==='idle'&&!state.instruction)return state.social.intent==='goodbye'?'farewell' as const:'interaction' as const;if(state.error||state.phase==='error'||state.phase==='uncertain')return 'error' as const;if(state.phase==='loading'||state.phase==='executing')return 'preparation' as const;if(state.phase==='review')return 'confirmation' as const;if(state.phase==='done')return state.result&&(state.result.verified||state.tool?.kind==='read')?'success' as const:'interaction' as const;return state.phase==='question'||state.instruction?'interaction' as const:undefined;}
