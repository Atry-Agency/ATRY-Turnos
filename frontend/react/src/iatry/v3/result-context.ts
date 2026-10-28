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
  const r=current(),s=language(source);if(!r)return{reference:/\b(?:ese|esa|segundo|anterior|ultimo|recien)\b/.test(s)};
  const ordinal=s.match(/\b(?:el |la )?(primero?|segundo|tercero?|cuarto|quinto|sexto|septimo|octavo|noveno|decimo)\b/),ranks:Record<string,number>={primer:0,primero:0,segundo:1,tercer:2,tercero:2,cuarto:3,quinto:4,sexto:5,septimo:6,octavo:7,noveno:8,decimo:9};
  let id=ordinal?visible[ranks[ordinal[1]]]:undefined;
  const deictic=/\b(?:el anterior|el ultimo|la ultima|recien|hablabamos|ese|esa|mismo)\b/.test(s);
  if(!ordinal&&deictic){if(/\bultimo\b|\bultima\b/.test(s))id=visible.at(-1);else id=/\banterior\b/.test(s)?previous:selected||(visible.length===1?visible[0]:undefined);}
  if(!ordinal&&!deictic){const matches=r.rows.filter(x=>typeof x.name==='string'&&language(x.name).length>1&&(' '+s+' ').includes(' '+language(x.name)+' '));if(matches.length===1)id=matches[0].id;else if(matches.length>1)return{reference:true,ambiguous:true};}
  const row=r.rows.find(x=>x.id===id);return{row:row&&structuredClone(row),reference:Boolean(ordinal||deictic||id),ambiguous:Boolean((ordinal||deictic)&&!row)};
 }
 return{accept,clear,current,select,filter,resolve,visible:()=>[...visible]};
}
