/* Shared, inert theme schema. No CSS, HTML or executable values are accepted. */
(function(root){'use strict';
const ranks={individual:0,negocio:1,pro:2},names={individual:'ATRY Esencial',negocio:'ATRY Negocio',pro:'ATRY Profesional'};
const palettes={atry:{name:'ATRY original',primary:'#4754E6',secondary:'#00A5E2'},ocean:{name:'Océano',primary:'#2056A0',secondary:'#00A5E2'},forest:{name:'Botánica',primary:'#187459',secondary:'#337A8C'},rose:{name:'Atelier',primary:'#B33A75',secondary:'#4754E6'},carbon:{name:'Carbón',primary:'#252525',secondary:'#00A5E2'},clay:{name:'Terracota',primary:'#9C493A',secondary:'#C49B66'}};
const essential=['#4754E6','#2056A0','#187459'];
const enums={mode:['light','dark'],radius:['soft','round','straight'],font:['atry','system'],cards:['elevated','outlined','flat'],density:['comfortable','compact'],buttons:['solid','outline'],agenda:['soft','contrast'],public_mode:['inherit','light','dark'],public_layout:['calm','editorial']};
const hex=v=>/^#[0-9a-f]{6}$/i.test(String(v||''))?v.toUpperCase():null;
const rgb=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16));
const luminance=h=>rgb(h).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;}).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);
const contrast=(a,b)=>{const x=luminance(a),y=luminance(b);return(Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
const mix=(a,b,w)=>'#'+rgb(a).map((v,i)=>Math.round(v*(1-w)+rgb(b)[i]*w).toString(16).padStart(2,'0')).join('').toUpperCase();
function readable(a,b,min=4.5){if(contrast(a,b)>=min)return a;const dest=contrast('#000000',b)>contrast('#FFFFFF',b)?'#000000':'#FFFFFF';for(let i=1;i<=20;i++){const c=mix(a,dest,i/20);if(contrast(c,b)>=min)return c;}return dest;}
function defaults(plan='individual'){return {version:1,primary:'#4754E6',secondary:'#00A5E2',mode:'light',radius:plan==='individual'?'soft':'round',font:'atry',cards:'elevated',density:'comfortable',buttons:'solid',agenda:'soft',public_mode:'inherit',public_layout:'calm'};}
function parse(raw){if(typeof raw==='string'){try{return JSON.parse(raw);}catch{return {};}}return raw&&typeof raw==='object'&&!Array.isArray(raw)?raw:{};}
function validate(raw,plan,{stored=false}={}){
 if(!stored&&(!raw||typeof raw!=='object'||Array.isArray(raw)))throw Error('Configuración visual no válida.');
 const obj=parse(raw),rank=ranks[plan]??0,allowed=['version','primary','secondary',...Object.keys(enums),'background','surface','sidebar','presets'];
 if(Object.keys(obj).some(k=>!allowed.includes(k)))throw Error('Configuración visual no válida.');
 const out={version:1};for(const[k,v]of Object.entries(obj)){
 if(k==='version'){if(v!==1)throw Error('Versión visual no compatible.');continue;}
 if(['primary','secondary','background','surface','sidebar'].includes(k)){if(!hex(v))throw Error('Usá colores HEX de seis dígitos.');out[k]=hex(v);}
 else if(k==='presets'){
 if(!Array.isArray(v)||v.length>6)throw Error('Podés guardar hasta seis estilos.');
 out.presets=v.map(p=>{if(!p||typeof p.name!=='string'||p.name.trim().length<2||p.name.length>40||Object.keys(p).some(k=>!['name','config'].includes(k))||p.config?.presets)throw Error('Estilo guardado no válido.');return {name:p.name.trim(),config:validate(p.config,'pro',{stored:true})};});
 }else{if(!enums[k]?.includes(v))throw Error('Opción visual no válida.');out[k]=v;}
 }
 if(!stored){
 if(rank===0){if(out.primary&&!essential.includes(out.primary))throw Error('Elegí uno de los colores esenciales.');if(out.secondary&&out.secondary!=='#00A5E2')throw Error('El color secundario se personaliza desde Negocio.');}
 const premium=['background','surface','sidebar','font','cards','density','buttons','agenda','presets'];
 for(const k of premium)if(k in out&&rank<2){const def=defaults(plan);if(k==='presets'?out[k].length>0:out[k]!==def[k])throw Error('Esta opción requiere el plan Pro.');}
 if(rank===0&&((out.radius&&out.radius!==defaults(plan).radius)||(out.public_mode&&out.public_mode!=='inherit')||(out.public_layout&&out.public_layout!=='calm')))throw Error('Esta opción requiere Negocio.');
 }
 return out;
}
// Large reading surfaces stay quiet; hue is retained as a subtle tint.
function calmSurface(color,dark,background=false){const target=dark?(background?'#111218':'#1B1C24'):'#FFFFFF';const valid=c=>{const values=rgb(c),chroma=Math.max(...values)-Math.min(...values),lum=luminance(c);return chroma<=(background?14:24)&&(dark?lum<=(background?.025:.05):lum>=(background?.94:.88));};if(valid(color))return color;for(let n=1;n<=100;n++){const c=mix(color,target,n/100);if(valid(c))return c;}return target;}
function effective(b,publicView=false){
 const plan=ranks[b?.plan]===undefined?'individual':b.plan,rank=ranks[plan],base=defaults(plan),saved=parse(b?.theme_config);let config;
 try{config=validate(saved,plan,{stored:true});}catch{config={};}
 if(!Object.keys(saved).length){if(b?.appearance_mode==='dark')config.mode='dark';if(rank>0&&hex(b?.primary_color)&&!['#4754E6','#1D806E'].includes(hex(b.primary_color))){config.primary=hex(b.primary_color);config.secondary=hex(b.secondary_color)||base.secondary;config.mode=b.appearance_mode==='dark'?'dark':'light';}}
 const v={...base,...config};if(rank===0){v.primary=essential.includes(v.primary)?v.primary:base.primary;v.secondary=base.secondary;v.radius=base.radius;v.public_mode='inherit';v.public_layout='calm';}
 if(rank<2)for(const k of ['background','surface','sidebar','font','cards','density','buttons','agenda','presets']){if(k in base)v[k]=base[k];else delete v[k];}
 if(publicView&&v.public_mode!=='inherit')v.mode=v.public_mode;
 const dark=v.mode==='dark',surface=calmSurface(v.surface||(dark?'#1B1C24':'#FFFFFF'),dark);let background=calmSurface(v.background||(dark?'#111218':rank===1?'#F4F5FC':'#F7F8FC'),dark,true);const ink=readable(dark?'#F5F5FC':'#172031',surface);if(contrast(ink,background)<4.5){const original=background;for(let i=1;i<=20;i++){background=mix(original,surface,i/20);if(contrast(ink,background)>=4.5)break;}}let muted=readable(dark?'#B7B9CA':'#626C80',surface);if(contrast(muted,background)<4.5)muted=ink;const actionSource=v.sidebar&&v.primary===base.primary?v.sidebar:v.primary;const action=readable(actionSource,surface),onAction=contrast('#FFFFFF',action)>=4.5?'#FFFFFF':'#000000',sidebar=v.sidebar||v.primary;
 return {...v,plan,name:names[plan],rank,surface,background,ink,muted,action,onAction,sidebar,onSidebar:contrast('#FFFFFF',sidebar)>=4.5?'#FFFFFF':'#000000',secondaryInk:readable(v.secondary===base.secondary&&actionSource!==base.primary?actionSource:v.secondary,surface),soft:mix(actionSource,surface,dark?.86:.94),line:mix(ink,surface,.86),surface2:mix(ink,surface,.95),logo:rank>0?b?.logo_url||'':''};
}
function colorDistance(a,b){return Math.sqrt(rgb(a).reduce((s,v,i)=>s+(v-rgb(b)[i])**2,0));}
const api={ranks,names,palettes,essential,enums,hex,contrast,mix,readable,calmSurface,defaults,parse,validate,effective,colorDistance};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.ATRY_THEME_CORE=api;
})(typeof globalThis!=='undefined'?globalThis:this);
