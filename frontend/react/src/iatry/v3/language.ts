/** Bounded lexical repair: only intent vocabulary, never arbitrary record names or numbers. */
export const literalLanguage=(s:string)=>s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[¿?¡!]/g,'').replace(/\s+/g,' ').trim();
const equivalents:Record<string,string>={agrgame:'agrega',agregame:'agrega',agregar:'agrega',anadi:'agrega',incorpora:'agrega',servisio:'servicio',serviso:'servicio',mñana:'manana',mnana:'manana',maniana:'manana',aier:'ayer',ayre:'ayer',ayerr:'ayer',hoi:'hoy',hoyy:'hoy',laburo:'trabajo',laburar:'trabajar',minutos:'minutos',mins:'minutos',min:'minutos',hs:'horas',hrs:'horas',mostrame:'mostra',muestrame:'mostra',crear:'crea',creame:'crea',cerrame:'bloqueame',reagendame:'reprograma',reagendar:'reprograma',actualizar:'actualiza',modificar:'modifica',cancelar:'cancela',cancelame:'cancela',cancelarme:'cancela',cuadrame:'agendame',cuadrar:'agenda',agendar:'agenda',agendame:'agendame',mueveme:'moveme',moverme:'moveme',ponme:'poneme'};
const vocabulary=['servicio','cliente','profesional','vacaciones','descanso','horario','reserva','reprograma','agrega','modifica','consulta','estadisticas','duracion','precio','ausencia','bloqueame','agendame','cita','citas','cupo'];
function legacyDistance(a:string,b:string){if(Math.abs(a.length-b.length)>1)return 2;const row=Array.from({length:b.length+1},(_,i)=>i);for(let i=1;i<=a.length;i++){let prev=row[0];row[0]=i;for(let j=1;j<=b.length;j++){const old=row[j];row[j]=Math.min(row[j]+1,row[j-1]+1,prev+(a[i-1]===b[j-1]?0:1));prev=old;}}return row[b.length];}
// Temporal repairs accept only a unique insertion/deletion or adjacent transposition.
// Substitutions are deliberately excluded: manada, mana, hora, olla and names are not dates.
const temporalWords=['manana','pasado','horas','minutos','jueves','viernes','sabado','domingo','miercoles'];
function temporalRepair(word:string){
 if(word.length<5||temporalWords.includes(word))return word;
 const matches=temporalWords.filter(target=>{if(target[0]!==word[0])return false;if(Math.abs(target.length-word.length)===1)return legacyDistance(target,word)===1;if(target.length!==word.length)return false;for(let i=0;i<word.length-1;i++)if(word.slice(0,i)+word[i+1]+word[i]+word.slice(i+2)===target)return true;return false;});
 return matches.length===1?matches[0]:word;
}
export interface LanguageToken {raw:string;start:number;end:number;key:string;word:string;repair:'none'|'alias'|'fuzzy';protected:boolean}
export interface LanguageAnalysis {text:string;tokens:LanguageToken[];repairs:LanguageToken[]}
/** OSA Damerau-Levenshtein, bounded to short operational words; candidates require one edit. */
export function lexicalDistance(a:string,b:string):number {
 if(Math.abs(a.length-b.length)>2||a.length>32||b.length>32)return 3;
 const rows=Array.from({length:a.length+1},(_,i)=>Array.from({length:b.length+1},(_,j)=>i===0?j:j===0?i:0));
 for(let i=1;i<=a.length;i++)for(let j=1;j<=b.length;j++){
  rows[i][j]=Math.min(rows[i-1][j]+1,rows[i][j-1]+1,rows[i-1][j-1]+(a[i-1]===b[j-1]?0:1));
  if(i>1&&j>1&&a[i-1]===b[j-2]&&a[i-2]===b[j-1])rows[i][j]=Math.min(rows[i][j],rows[i-2][j-2]+1);
 }
 return rows[a.length][b.length];
}
const operationalAliases:Record<string,string>={...equivalents,noo:'no',nunka:'nunca',nunk:'nunca',svc:'servicio',svcs:'servicios',cli:'cliente',prof:'profesional',profs:'profesionales',anadir:'agrega',anadime:'agrega',poner:'poneme',ponle:'poneme',ponerme:'poneme',sumale:'suma',agregues:'agrega',agreguen:'agrega',agreguenme:'agrega',agreganos:'agrega',agreguenos:'agrega',añade:'agrega',anade:'agrega',anadele:'agrega',anademe:'agrega',sumame:'suma',sumar:'suma',meteme:'mete',meter:'mete',crear:'crea',crealo:'crea',crees:'crea',creanos:'crea',creame:'crea',poneme:'poneme',ponme:'poneme',buscame:'busca',buscar:'busca',busques:'busca',busquen:'busca',mostrame:'mostra',mostrar:'mostra',muestra:'mostra',muestrame:'mostra',consultar:'consulta',consultame:'consulta',ver:'ver',cambiame:'cambia',cambiale:'cambia',cambiar:'cambia',cambies:'cambia',editar:'edita',editame:'edita',modificar:'modifica',modificame:'modifica',actualizar:'actualiza',actualizame:'actualiza',ocultar:'oculta',ocultame:'oculta',ocultes:'oculta',publicar:'publica',publicame:'publica',activa:'activa',activar:'activa',bloquea:'bloqueame',bloquear:'bloqueame',bloquees:'bloqueame',canceles:'cancela',servisios:'servicios',servisos:'servicios',cliete:'cliente',profecional:'profesional',durasion:'duracion',presio:'precio',nomre:'nombre'};
const cliticVerbs=new Set(['agrega','anade','crea','suma','mete','incorpora','pone','pon','busca','muestra','mostra','consulta','cambia','modifica','edita','actualiza','ajusta','organiza','configura','renombra','publica','activa','oculta','despublica','asigna','subi','baja','cobra','reserva','agenda','reprograma','bloquea','cancela','confirma']);
const cliticEndings=['nos','los','las','les','me','te','se','lo','la','le'];
function cliticVerb(word:string):string|undefined {
 for(const ending of cliticEndings)if(word.endsWith(ending)){const stem=word.slice(0,-ending.length);if(cliticVerbs.has(stem))return operationalAliases[stem]||stem;}
 return undefined;
}
/** Repair the verb stem before an enclitic, without increasing whole-word edit tolerance. */
function approximateCliticVerbs(word:string):string[] {
 const candidates=new Set<string>();
 for(const ending of cliticEndings){
  if(!word.endsWith(ending))continue;
  const stem=word.slice(0,-ending.length);if(stem.length<5)continue;
  for(const verb of cliticVerbs)if(verb[0]===stem[0]&&lexicalDistance(stem,verb)===1)candidates.add(operationalAliases[verb]||verb);
 }
 return [...candidates];
}
const lexicalVocabulary=[...new Set([...vocabulary,...Object.keys(operationalAliases),...Object.values(operationalAliases),'servicios','clientes','horarios','profesionales','bloqueos','equipo','ficha','historial','nombre','descripcion','activa','publica','oculta','edita','cambia','crea','busca','mostra','consulta','mete','suma','nuevo','nueva','poneme','anadir','anade','cancelar','cancelame','cancela','elimina','borrar','borra','eliminar','agregue','cree','anadi','semana','semanas','puedo','puede','puedes','pueden','puedan','quiero','quieres','quiere','necesito','necesita','ahora','luego','antes','mejor','nuevo','nueva','gracias','no','nunca','tampoco','vino','vinieron','asistio','asistieron','falto','faltaron','cuando','cuanto','cuanta','cuantos','cuantas','cual','cuales','donde','desde','hasta','todos','todas','mismo','misma','trabajo','trabajar','atiendo','nombre','telefono','correo','contacto','camina','comida','primero','primera','segundo','segunda','tercero','tercera'])];
/** Only boundary fillers are discarded. Raw source and literal values remain available by offset. */
export function stripFillers(source:string):string {
 const stripped=source.replace(/^(?:(?:pa(?:h)? vo[s]?|che|fren|mopri|oye|oiga|ey|hey|bueno|hola|por favor|porfa|porfis|a ver|este|eh|em|iatry)[,!.\s]+)+/i,'').replace(/(?:[,!\s]+(?:pa(?:h)? vo[s]?|che|fren|mopri|por favor|porfa|porfis|iatry))+[.!\s]*$/i,'').trim();
 return stripped;
}
export function analyzeLanguage(source:string,extraVocabulary:readonly string[]=[]):LanguageAnalysis {
 const spans=[...source.matchAll(/["“«]([^"”»]*)["”»]|(?:https?:\/\/|www\.)\S+|[\w.+%-]+@[\w.-]+\.[a-z]{2,}|[a-z0-9]+(?:[-_][a-z0-9]+)+|\+?\d[\d:.,/+-]*/gi)].map(m=>[m.index!,m.index!+m[0].length,1]);
 // A literal name after an explicit naming delimiter is never spelling-corrected.
 for(const m of source.matchAll(/(?:se llama|llamad[oa]|nombre es|nombre:|servici[oó] de|cliente(?: nuevo)?|ficha de|profesional)\s+(.+?)(?=\s+(?:(?:de|a|por)\s+\d|con correo|con telefono|dura|cuesta|precio|duracion|manana|hoy)|[,;]|$)/gi)){
  const start=m.index!+m[0].length-m[1].length;spans.push([start,start+m[1].length,0]);
 }
 for(const m of source.matchAll(/(?:se llama|llamad[oa]|nombre es|nombre:)\s+(.+?)(?=\s+(?:dura|cuesta|precio|duracion|hoy|manana)|[,;]|$)/gi)){const start=m.index!+m[0].length-m[1].length;spans.push([start,start+m[1].length,1]);}
 for(const m of source.matchAll(/(?:busc[aá](?:me|r)?|encontr[aá](?:me)?|encuentra(?:me)?)\s+a(?:l| la)?\s+(.+?)[?.!]*$/gi)){const start=m.index!+m[0].lastIndexOf(m[1]);spans.push([start,start+m[1].length,1]);}
 const lexicon=[...new Set([...lexicalVocabulary,...extraVocabulary.flatMap(s=>literalLanguage(s).split(' '))])];
 const tokens:LanguageToken[]=[];let cursor=0,text='';
 for(const match of source.matchAll(/[\p{L}\p{M}]+|\+?\d[\p{L}\d:.,/+-]*|[^\s]+/gu)){
  const raw=match[0],start=match.index!,end=start+raw.length,key=literalLanguage(raw),properName=start>0&&/^[A-ZÁÉÍÓÚÑ][a-záéíóúñ]/.test(raw)&&!lexicon.includes(key)&&!cliticVerb(key),protectedValue=properName||spans.some(([a,b,strict])=>start<b&&end>a&&(strict===1||!lexicon.includes(key)))||! /^[a-zñ]+$/.test(key);
  let word=key,repair:LanguageToken['repair']='none';
  if(!protectedValue){
   const canonical=operationalAliases[key]||cliticVerb(key);
   if(canonical){word=canonical;if(word!==key)repair='alias';}
   else if(!lexicon.includes(key)&&!(key.endsWith('s')&&lexicon.includes(key.slice(0,-1)))&&key.length>=5&&key.length<=24){
    const compact=key.replace(/([a-z])\1{2,}/g,'$1');
    if(compact!==key&&(operationalAliases[compact]||lexicon.includes(compact))){word=operationalAliases[compact]||compact;repair='fuzzy';}
    else{const matches=lexicon.filter(v=>!temporalWords.includes(operationalAliases[v]||v)&&!['hoy','ayer','manana'].includes(operationalAliases[v]||v)&&v[0]===key[0]&&Math.abs(v.length-key.length)<=1&&lexicalDistance(v,key)===1);const concepts=[...new Set([...matches.map(v=>operationalAliases[v]||v),...approximateCliticVerbs(key)])];if(concepts.length===1){word=concepts[0];repair='fuzzy';}}
   }
   word=temporalRepair(word);
  }
  const token={raw,start,end,key,word,repair,protected:protectedValue};tokens.push(token);text+=source.slice(cursor,start).toLowerCase()+word;cursor=end;
 }
 text+=source.slice(cursor).toLowerCase();return{text:(stripFillers(text)||literalLanguage(text)).replace(/\s+/g,' ').trim(),tokens,repairs:tokens.filter(t=>t.repair!=='none')};
}
export function normalizeLanguage(source:string){const s=analyzeLanguage(source).text;
 return s.replace(/^q\s+(?=citas|turnos|reservas|servicios)/,'que ').replace(/\bpa['’]l\b/g,'para el').replace(/\bpa(?:ra)? la\b/g,'para la').replace(/^(?:fren|mopri)[, ]+/,'').replace(/\b(a las?|desde|hasta) (\d{1,2})\s*(?:hs?|horas)\b/g,'$1 $2:00').replace(/\b(?:meter|sumar|anadir) (?:otro|un nuevo|un|otra) (servicio|cliente|reserva)\b/g,'agrega un $1').replace(/\bme tomo (?:unos|algunos|varios) dias\b/g,'vacaciones').replace(/\bmedia hora\b/g,'30 minutos').replace(/\b(?:un )?cuarto de hora\b/g,'15 minutos').replace(/\buna hora\b/g,'60 minutos').replace(/\b(?:hace|haceme) (?:uno|una) nuev[oa]\b/g,'uno nuevo');
}

export function ordinalChoice(source:string,count:number){const s=normalizeLanguage(source).replace(/^(?:el|la) /,'');const n=['primero','segundo','tercero','cuarto','quinto'].indexOf(s);return n>=0&&n<count?n:undefined;}
