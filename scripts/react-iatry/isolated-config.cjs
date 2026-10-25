'use strict';
const PROTECTED_PROJECTS=new Set(['lmdranjpocslqubqhrvb']);
function isolatedConfig(env){
 const url=env.TEST_SUPABASE_URL;if(!url)return {blocked:true,reason:'No hay entorno Supabase aislado configurado; el proyecto indicado por el usuario es productivo y queda excluido.'};
 let parsed;try{parsed=new URL(url)}catch{throw Error('TEST_SUPABASE_URL inválida')}
 const match=parsed.hostname.match(/^([a-z0-9-]+)\.supabase\.co$/),local=parsed.protocol==='http:'&&['127.0.0.1','localhost'].includes(parsed.hostname);
 if(PROTECTED_PROJECTS.has(match?.[1]))throw Error('Proyecto productivo protegido: no se permite ejecutar el harness de pruebas.');
 if(!local&&(!match||parsed.protocol!=='https:'))throw Error('Destino de pruebas no permitido.');
 if(parsed.username||parsed.password||parsed.pathname!=='/'||parsed.search||parsed.hash)throw Error('La URL de pruebas debe contener únicamente el origen.');
 for(const name of ['PUBLIC_SUPABASE_URL','SUPABASE_URL'])if(env[name]&&new URL(env[name]).origin===parsed.origin)throw Error('El destino coincide con una configuración habitual; debe declararse un proyecto de pruebas separado.');
 if(env.ATRY_ISOLATED_SUPABASE_ACK!=='I_CONFIRM_THIS_PROJECT_IS_DISPOSABLE'||env.ATRY_ALLOW_FIXTURE_WRITES!=='1'||env.ATRY_TEST_WORKERS_DISABLED!=='1')throw Error('Falta confirmar entorno desechable, escrituras ficticias y workers de envío apagados.');
 const project=local?'local':match[1];if(env.TEST_SUPABASE_PROJECT_REF!==project)throw Error('La referencia explícita no coincide con el destino aislado.');
 if(!env.TEST_SUPABASE_PUBLISHABLE_KEY?.startsWith('sb_publishable_')||!env.TEST_SUPABASE_ADMIN_KEY)throw Error('Faltan claves específicas del entorno aislado.');
 return {blocked:false,url:parsed.origin,project,publishableKey:env.TEST_SUPABASE_PUBLISHABLE_KEY,adminKey:env.TEST_SUPABASE_ADMIN_KEY};
}
module.exports={isolatedConfig};
