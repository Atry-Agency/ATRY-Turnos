'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{buildSync}=require('esbuild');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'atry-first-use-'));
try{
 const file=path.join(dir,'module.cjs');
 buildSync({stdin:{contents:"export * from './frontend/react/src/iatry/v3/orientation';export * from './frontend/react/src/onboarding/review-progress';export * from './frontend/react/src/iatry/v3/dialogue';export * from './frontend/react/src/iatry/v3/instructions';export {capabilities} from './frontend/react/src/iatry/v3/catalogue';",loader:'ts',resolveDir:process.cwd()},outfile:file,bundle:true,platform:'node',format:'cjs'});
 globalThis.ATRY_THEME_CORE=require('../../web/theme-core');const m=require(file);let checks=0;
 for(const text of ['Acabo de contratar, ¿qué me falta para empezar a recibir reservas?','Fren, recién empiezo con mi negocio','¿Cómo empiezo a configurar mi negocio?','Quiero empezar a recibir citas']){assert.equal(m.orientationGoal(text),'setup',text);checks++}
 for(const text of ['Quiero pasarle a una clienta el enlace para reservar','¿Cómo comparto mi link de reservas?','Mandarle mi página para reservar a un cliente']){assert.equal(m.orientationGoal(text),'share',text);checks++}
 for(const text of ['Hola IAtry','Cancelame esa cita','Agendame una cita mañana','Creá un turno y compartí el enlace','No quiero compartir mi enlace','No envíes el enlace','Enviar link de pago','cita bibliográfica','¿Qué citas tengo hoy?']){assert.equal(m.orientationGoal(text),undefined,text);checks++}
 const uy=m.reviewKey('owner','uy'),pa=m.reviewKey('owner','pa');assert.notEqual(uy,pa);assert.notEqual(uy,m.reviewKey('other-owner','uy'));checks+=2;
 for(const value of ['null','{}','["configuracion","bad","configuracion"]','broken']){const rows=m.readReviews({getItem:()=>value},uy);assert.deepEqual(rows,value.includes('configuracion')?['configuracion']:[]);checks++}
 assert.deepEqual(m.readReviews({getItem(){throw Error('storage blocked')}},uy),[]);checks++;
 const absent=m.interpretInstruction('Esta semana no trabajo el viernes',m.capabilities,[],'2026-11-23').steps[0],tool=m.capabilities.find(t=>t.id===absent.id);
 assert.equal(absent.id,'schedule.absence');assert.equal(m.missingField(tool,absent.seed)?.key,'staff');assert.match(m.localPrompt(tool,absent.seed),/Para qué profesional/);assert.doesNotMatch(m.localPrompt(tool,absent.seed),/Ya tengo los datos/);checks+=4;
 console.log('PASS first-use guidance:',checks,'checks; bounded goal recognition, negatives, explicit scoped review marks, unresolved professional asks for clarification; no transport');
}finally{fs.rmSync(dir,{recursive:true,force:true})}
