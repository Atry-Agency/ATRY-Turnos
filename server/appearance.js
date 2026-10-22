'use strict';
const T=require('../web/theme-core');
const {fail}=require('./booking');
function prepare(b,body){
 if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(k=>!['primary_color','secondary_color','appearance_mode','logo_url','theme_config','reset_theme','expected_revision'].includes(k)))fail(400,'Revisá los datos de apariencia');
 if(body.expected_revision!==undefined&&body.expected_revision!==Number(b.theme_revision||0))fail(409,'La apariencia cambió en otra ventana. Actualizá antes de publicar.');
 if(body.logo_url!==undefined&&(typeof body.logo_url!=='string'||body.logo_url.length>140000||(body.logo_url!==''&&!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(body.logo_url))))fail(400,'Elegí PNG, JPEG o WebP de hasta 90 KB');
 if((T.ranks[b.plan]??0)===0&&body.logo_url)fail(403,'La identidad con logotipo está disponible desde Negocio.');
 if('theme_config'in body&&(!body.theme_config||typeof body.theme_config!=='object'||Array.isArray(body.theme_config)))fail(400,'Configuración visual no válida');
 let incoming=body.theme_config||{};
 if('primary_color'in body)incoming={...incoming,primary:body.primary_color};if('secondary_color'in body)incoming={...incoming,secondary:body.secondary_color};if('appearance_mode'in body)incoming={...incoming,mode:body.appearance_mode};
 let config;try{config=T.validate(incoming,b.plan||'individual');}catch(e){fail(/requiere|colores esenciales|desde Negocio|personaliza desde/.test(e.message)?403:400,e.message);}
 const stored=body.reset_theme===true?{...T.defaults(b.plan),...config}:{...T.parse(b.theme_config),...config};
 const effective=T.effective({...b,theme_config:stored});

 return {theme_config:JSON.stringify(stored),theme_revision:Number(b.theme_revision||0)+1,primary_color:effective.primary,secondary_color:effective.secondary,appearance_mode:effective.mode,...('logo_url'in body?{logo_url:body.logo_url}:{})};
}
function publicConfig(b){const e=T.effective(b,true),out={version:1};for(const k of ['primary','secondary','mode','radius','font','cards','density','buttons','agenda','public_mode','public_layout','background','surface','sidebar'])if(e[k])out[k]=e[k];return out;}
module.exports={prepare,publicConfig};
