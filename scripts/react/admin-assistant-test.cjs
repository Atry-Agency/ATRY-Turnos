'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'atry-admin-model-')),file=path.join(dir,'model.cjs');
require('esbuild').buildSync({entryPoints:['frontend/react/src/admin/assistant-model.ts'],outfile:file,bundle:true,platform:'node',format:'cjs'});
const {adminReply:reply,proposalCurrent,adminFollowUp}=require(file);
let checks=0;const ok=(value,message)=>{assert.ok(value,message);checks++};
const ctx=(section,data={})=>({administrator:true,section,data:{checked_at:'2026-11-15T12:00:00Z',...data}}),list=ctx('negocios',{rows:[{id:'b1',name:'Salón Norte'},{id:'b2',name:'Salón Sur'}]}),detail=ctx('negocios',{data:{id:'b2',name:'Salón Sur',status:'active'}});
const p=reply('Renová el segundo',list).proposal;ok(p.route==='/admin/negocios/b2');ok(!p.action,'A list cannot execute a subscription operation');
const review=reply('Gestionar suscripción',detail).proposal;ok(review.action.kind==='subscription');ok(review.action.id==='b2');ok(proposalCurrent(review,detail));ok(!proposalCurrent(review,{...detail,administrator:false}));ok(!proposalCurrent(review,ctx('negocios',{data:{id:'b1',name:'Otro'}})));ok(!proposalCurrent(review,{...detail,data:{...detail.data,data:{...detail.data.data,status:'suspended'}}}));
for(const text of ['Renovar ese','Renovar el número 99','Renovar el último inexistente 99','Renovar dentro de 30 días']){const r=reply(text,list);if(text.includes('último'))continue;ok(!r.proposal?.action&&!r.proposal?.route,'Unresolved identity '+text)}
ok(!reply('renovar',{...detail,administrator:false}).proposal);
for(const text of ['confirmo','dale','ofi','de una','sí','ejecutar']){const r=reply(text,detail);ok(!r.proposal?.action&&r.preservePending,'Text never confirms '+text)}
for(const text of ['borrá Salón Sur','eliminá el negocio','reenviá el correo','enviar correos','limpiá los archivos'])ok(!reply(text,detail).proposal?.action,text);
ok(reply('diagnóstico',detail).proposal.action.kind==='diagnostic');
const duplicate=ctx('negocios',{rows:[{id:'b1',name:'Salón'},{id:'b2',name:'Salón'}]});ok(reply('renovar Salón',duplicate).choices.length===2);ok(!reply('renovar Salón',duplicate).proposal);ok(reply('renovar Salón ese',duplicate,'b2').proposal.route==='/admin/negocios/b2');
const users=ctx('usuarios',{rows:[{id:'u1',name:'Ana',blocked:false},{id:'u2',name:'María',blocked:true}]});ok(reply('bloquear Ana',users).proposal.action.extra.blocked===true);ok(!reply('desbloquear Ana',users).proposal);ok(reply('desbloquear María',users).proposal.action.extra.blocked===false);ok(reply('revocar sesiones de Ana',users).proposal.action.kind==='revoke_sessions');
ok(reply('gestionar incidencia',ctx('soporte',{rows:[{id:'i1',subject:'Error agenda'}]})).choices.length===1);ok(reply('gestionar la primera incidencia',ctx('soporte',{rows:[{id:'i1',subject:'Error agenda'}]})).proposal.action.id==='i1');
ok(reply('ver cobros',list).proposal.route==='/admin/comercial');ok(reply('ver almacenamiento',list).proposal.route==='/admin/datos');
ok(reply('resumen',ctx('inicio',{businesses:{active:3,pending:1},mail:{failed:0},requests:2,incidents:4})).text.includes('Negocios habilitados: 3'));ok(!reply('resumen',ctx('inicio')).text.includes('habilitados: 0'));
ok(reply(adminFollowUp('el segundo','renovar ese'),list).proposal.route==='/admin/negocios/b2');ok(reply(adminFollowUp('mejor el primero','renovar el segundo'),list).proposal.route==='/admin/negocios/b1');ok(adminFollowUp('ver usuarios','renovar el segundo')==='ver usuarios');ok(!reply('renovar mañana',ctx('usuarios',{rows:[{id:'u1',name:'Ana'}]})).proposal?.action);
const component=fs.readFileSync('frontend/react/src/admin/AdminAssistant.tsx','utf8');ok(!/api\.write|fetch\(|\.request\(/.test(component),'No secondary execution channel');ok(component.includes('!accepted')&&component.includes('proposalCurrent'),'Visual handoff gate');
fs.rmSync(dir,{recursive:true,force:true});console.log('PASS admin assistant:',checks,'identity, ambiguity, current source, permissions and confirmation checks; zero transport calls.');
