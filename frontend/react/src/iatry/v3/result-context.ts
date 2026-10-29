import {resultPositions} from './conversation-context';
import {language} from './intent-catalogue';
import type {Result,Row} from './contracts';
/** Ephemeral, scoped references. Only records returned by an authorized read enter here. */
export function createResultContext(businessId:string,now:()=>number=Date.now){
 let records:NonNullable<Result['records']>|undefined,visible:string[]=[],selected:string|undefined,previous:string|undefined,stamp=0;
 const clear=()=>{records=undefined;visible=[];selected=undefined;previous=undefined;stamp=0};
 const current=()=>{if(now()-stamp>300000)clear();return records};
 function accept(result:Result){if(!result.records){clear();return;}const r=result.records;if(!['/services','/customers'].includes(r.tail)||r.rows.some(x=>typeof x.id!=='string'||!x.id||x.business_id!==undefined&&x.business_id!==businessId))throw Error('Se descartó un contexto no autorizado.');records=structuredClone(r);visible=r.rows.map(x=>x.id);selected=undefined;previous=undefined;stamp=now();}
 function select(id:string){const r=current();if(!r||!visible.includes(id))return false;if(id!==selected){previous=selected;selected=id;}return true;}
 function filter(active:boolean){const r=current();if(!r||r.tail!=='/services')return;visible=r.rows.filter(x=>Boolean(Number(x.active))===active).map(x=>x.id);selected=undefined;previous=undefined;return visible.map(id=>r.rows.find(x=>x.id===id)!);}
 function resolve(source:string):{row?:Row;reference:boolean;ambiguous?:boolean}{
  const r=current(),s=language(source);if(!r)return{reference:resultPositions(source).length>0||/\b(?:ese|esa|segundo|anterior|ultimo|recien)\b/.test(s)};
  const positions=resultPositions(source),deictic=/\b(?:el anterior|la anterior|el ultimo|la ultima|recien|hablabamos|ese|esa|mismo|misma)\b/.test(s);
  const named=r.rows.filter(x=>typeof x.name==='string'&&language(x.name).length>1&&(' '+s+' ').includes(' '+language(x.name)+' '));
  if(named.length>1)return{reference:true,ambiguous:true};
  const candidates=new Set<string>();if(named.length===1)candidates.add(named[0].id);
  let missing=false;for(const position of positions){const id=visible[position];if(id)candidates.add(id);else missing=true;}
  if(deictic){let id:string|undefined;if(/\bultimo\b|\bultima\b/.test(s))id=visible.at(-1);else id=/\banterior\b/.test(s)?previous:selected||(visible.length===1?visible[0]:undefined);if(id)candidates.add(id);else missing=true;}
  const reference=Boolean(positions.length||deictic||named.length),ambiguous=missing||candidates.size>1;
  const row=!ambiguous&&candidates.size===1?r.rows.find(x=>x.id===[...candidates][0]):undefined;
  return{row:row&&structuredClone(row),reference,ambiguous:reference&&!row};
 }
 return{accept,clear,current,select,filter,resolve,visible:()=>[...visible]};
}
