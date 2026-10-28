/** Bounded lexical repair: only intent vocabulary, never arbitrary record names or numbers. */
const plain=(s:string)=>s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[¿?¡!]/g,'').replace(/\s+/g,' ').trim();
const equivalents:Record<string,string>={agrgame:'agrega',agregame:'agrega',agregar:'agrega',anadi:'agrega',incorpora:'agrega',servisio:'servicio',serviso:'servicio',mñana:'manana',mnana:'manana',maniana:'manana',aier:'ayer',ayre:'ayer',ayerr:'ayer',hoi:'hoy',hoyy:'hoy',laburo:'trabajo',laburar:'trabajar',minutos:'minutos',mins:'minutos',min:'minutos',hs:'horas',hrs:'horas',mostrame:'mostra',muestrame:'mostra',crear:'crea',creame:'crea',cerrame:'bloqueame',reagendame:'reprograma',reagendar:'reprograma',actualizar:'actualiza',modificar:'modifica',cancelar:'cancela'};
const vocabulary=['servicio','cliente','profesional','vacaciones','descanso','horario','reserva','reprograma','agrega','modifica','consulta','estadisticas','duracion','precio','ausencia','bloqueame'];
function distance(a:string,b:string){if(Math.abs(a.length-b.length)>1)return 2;const row=Array.from({length:b.length+1},(_,i)=>i);for(let i=1;i<=a.length;i++){let prev=row[0];row[0]=i;for(let j=1;j<=b.length;j++){const old=row[j];row[j]=Math.min(row[j]+1,row[j-1]+1,prev+(a[i-1]===b[j-1]?0:1));prev=old;}}return row[b.length];}
// Temporal repairs accept only a unique insertion/deletion or adjacent transposition.
// Substitutions are deliberately excluded: manada, mana, hora, olla and names are not dates.
const temporalWords=['manana','pasado','horas','minutos','jueves','viernes','sabado','domingo','miercoles'];
function temporalRepair(word:string){
 if(word.length<5||temporalWords.includes(word))return word;
 const matches=temporalWords.filter(target=>{if(target[0]!==word[0])return false;if(Math.abs(target.length-word.length)===1)return distance(target,word)===1;if(target.length!==word.length)return false;for(let i=0;i<word.length-1;i++)if(word.slice(0,i)+word[i+1]+word[i]+word.slice(i+2)===target)return true;return false;});
 return matches.length===1?matches[0]:word;
}
export function normalizeLanguage(source:string){let s=plain(source).replace(/[a-zñ]+/g,word=>{if(equivalents[word])return equivalents[word];const temporal=temporalRepair(word);if(temporal!==word)return temporal;if(word.length<6||vocabulary.includes(word)||word.endsWith('s')&&vocabulary.includes(word.slice(0,-1)))return word;const matches=vocabulary.filter(v=>v[0]===word[0]&&distance(v,word)===1);return matches.length===1?matches[0]:word;});
 return s.replace(/\b(a las?|desde|hasta) (\d{1,2})\s*(?:hs?|horas)\b/g,'$1 $2:00').replace(/\b(?:meter|sumar|anadir) (?:otro|un nuevo|un|otra) (servicio|cliente|reserva)\b/g,'agrega un $1').replace(/\bme tomo (?:unos|algunos|varios) dias\b/g,'vacaciones').replace(/\bmedia hora\b/g,'30 minutos').replace(/\b(?:un )?cuarto de hora\b/g,'15 minutos').replace(/\buna hora\b/g,'60 minutos').replace(/\b(?:hace|haceme) (?:uno|una) nuev[oa]\b/g,'uno nuevo');
}
export function ordinalChoice(source:string,count:number){const s=normalizeLanguage(source).replace(/^(?:el|la) /,'');const n=['primero','segundo','tercero','cuarto','quinto'].indexOf(s);return n>=0&&n<count?n:undefined;}
