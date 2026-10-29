'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{buildSync}=require('esbuild');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'iatry-human-')),file=path.join(dir,'test.cjs');
try{
 buildSync({stdin:{contents:"export * from './frontend/react/src/iatry/v3/social';export * from './frontend/react/src/iatry/v3/personality';",loader:'ts',resolveDir:process.cwd()},outfile:file,bundle:true,platform:'node',format:'cjs'});
 const s=require(file),r=s.createSocialResponder(()=>0);let checks=0;
 for(const[intent,bank]of Object.entries(s.socialBanks)){assert.ok(bank.length>=8&&bank.length<=12);const phrase={greeting:'hola',thanks:'gracias',goodbye:'chau',wellbeing:'como estas',open:'que hacemos hoy',fatigue:'que dia largo',uncertainty:'no se por donde empezar',celebration:'genial',resume:'retomemos',frustration:'no me sale',mistake:'me equivoque',finished:'terminamos'}[intent],recent=[];for(let n=0;n<24;n++){const reply=r.reply(phrase,{pending:true});assert.equal(reply.intent,intent);assert.ok(!recent.includes(reply.text));assert.ok(!/ya qued[oó] todo|guard[eé] los cambios|cancel[eé] las reservas/.test(reply.text));recent.push(reply.text);if(recent.length>5)recent.shift();checks++;}}
 for(const text of ['me equivoqué con el precio','hola creá un servicio','Juan está cansado, bloqueale mañana','terminamos de editar el servicio','gracias cancelá la reserva']){assert.equal(s.socialIntent(text),undefined);checks++;}
 const p=s.createSocialResponder(()=>0);assert.match(p.reply('hola',{name:'Rodrigo Brun',introduce:true}).text,/Rodrigo/);assert.ok(!p.reply('hola',{introduce:true}).text.includes('Soy IAtry'));p.clear();assert.match(p.reply('hola',{introduce:true}).text,/Soy IAtry/);checks+=3;
 assert.equal(s.socialIntent('me equivoqué'),'mistake');assert.equal(s.socialIntent('estoy frustrada'),'frustration');checks+=2;
 const question=s.voice({state:'question',tool:{id:'services.create',area:'Servicios',kind:'create'},values:{name:'Barba',price_uyu:'0'},question:'¿Cuánto dura?'});assert.match(question,/minutos/);assert.ok(!question.includes('qué precio'));checks++;
 assert.match(s.voice({state:'verified',verified:false}),/No voy a darlo por completado/);assert.equal(s.conversationEnergy({phase:'done',result:{verified:false},tool:{kind:'create'}}),'interaction');checks+=2;
 console.log('PASS IAtry personalidad humana: '+checks+' comprobaciones; 12 intenciones, variación sin repetición reciente, presentación única, correcciones operativas intactas, cero transporte y éxito condicionado a verificación.');
}finally{fs.rmSync(dir,{recursive:true,force:true})}
