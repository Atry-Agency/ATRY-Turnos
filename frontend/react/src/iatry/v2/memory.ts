export interface V2Memory{seen:string[];dismissed:string[];snoozed:string[]}
export function createV2Memory(storage:Pick<Storage,'getItem'|'setItem'>|undefined,key:string){
 const normalize=(x:Partial<V2Memory>|null):V2Memory=>Object.fromEntries(['seen','dismissed','snoozed'].map(k=>[k,Array.isArray(x?.[k as keyof V2Memory])?[...new Set(x![k as keyof V2Memory]!.filter(v=>typeof v==='string'&&v.length<=1200))].slice(-80):[]])) as unknown as V2Memory;
 let state:V2Memory;try{state=normalize(JSON.parse(storage?.getItem(key)||'null'))}catch{state=normalize(null)}
 return {read:()=>structuredClone(state),mark:(kind:keyof V2Memory,value:string)=>{state=normalize({...state,[kind]:[...state[kind],value]});try{storage?.setItem(key,JSON.stringify(state))}catch{}return structuredClone(state)}};
}
