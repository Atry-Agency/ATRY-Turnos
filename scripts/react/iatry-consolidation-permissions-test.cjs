'use strict';
// Focused release guards only: no HTTP, database, fixtures or dist output.
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{buildSync}=require('esbuild');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'iatry-consolidation-permissions-'));
(async()=>{try{
 const outfile=path.join(dir,'policy.cjs');
 buildSync({stdin:{contents:"export * from './frontend/react/src/iatry/v3/access';export * from './frontend/react/src/iatry/v3/production-policy';export {capabilities} from './frontend/react/src/iatry/v3/catalogue';export {createConversation} from './frontend/react/src/iatry/v3/engine';",resolveDir:process.cwd(),loader:'ts'},outfile,bundle:true,platform:'node',format:'cjs'});
 globalThis.ATRY_THEME_CORE=require('../../web/theme-core');const s=require(outfile);let calls=0,checks=0;
 const base={userId:'authenticated-owner',businessId:'business-authorized',role:'owner',sessionVersion:1,accessEnabled:true,sector:'General'};
 const expected=['services.list','services.create','services.price','services.duration','services.details','services.publish','services.hide','customers.create','customers.update','customers.search','customers.history','schedule.read','schedule.day','schedule.absence','schedule.blocks','team.list','business.statistics'].sort();
 let active=base,plan='negocio',feature=true;
 const port={scope:()=>active,business:()=>({id:base.businessId,plan}),capability:()=>feature,request:()=>{calls++;throw Error('Transport forbidden in permissions test');}};
 const ctx={port,scope:base,alive:()=>true,environment:'connected'};
 const ids=c=>s.capabilities.filter(t=>s.available(t,c)).map(t=>t.id).sort();
 assert.deepEqual(ids(ctx),expected);checks++;
 for(const role of ['owner','manager','staff'])for(const level of ['individual','negocio','pro']){plan=level;assert.equal(ids({...ctx,scope:{...base,role}}).length,role==='owner'?(level==='individual'?16:17):0);checks++;}
 plan='negocio';
 assert.deepEqual(ids({...ctx,scope:{...base,accessEnabled:false}}),s.capabilities.filter(t=>expected.includes(t.id)&&t.kind==='read').map(t=>t.id).sort());checks++;
 assert.equal(ids({...ctx,alive:()=>false}).length,0);checks++;
 feature=false;assert.equal(ids(ctx).includes('business.statistics'),false);assert.equal(ids(ctx).length,16);checks++;feature=true;
 for(const changed of [null,{...base,userId:'other-user'},{...base,businessId:'other-business'},{...base,role:'manager'},{...base,sessionVersion:2},{...base,accessEnabled:false}]){active=changed;for(const id of ['services.create','customers.update','schedule.day','schedule.absence'])assert.throws(()=>s.assertAccess(s.capabilities.find(t=>t.id===id),ctx,true));checks++;}active=base;
 const engine=s.createConversation(port,base,s.capabilities,'connected');active=null;await assert.rejects(()=>engine.begin('services.create'));engine.dispose();checks++;active=base;
 global.window={ATRY_CONFIG:{supabaseUrl:'https://wrong-project.supabase.co'}};assert.equal(ids(ctx).length,0);checks++;window.ATRY_CONFIG.supabaseUrl=s.productionProject;assert.deepEqual(ids(ctx),expected);checks++;
 delete global.window;
 for(const route of ['/bookings','/dashboard','/recurring','/notification-preferences','/services/../../bookings']){assert.throws(()=>s.assertProductionRead(route,ctx));checks++;}
 for(const id of ['bookings.create','bookings.cancelled','team.create','schedule.exception','waitlist.booked','notifications.preferences']){assert.equal(ids(ctx).includes(id),false);checks++;}
 assert.equal(calls,0);console.log(`PASS consolidation permissions: ${checks} focused cases; exact17, nine role/plan profiles, expired/stale sessions, suspended writes, feature/project guards, materializing routes and out-of-stage tools; zero transport.`);
}finally{delete global.window;fs.rmSync(dir,{recursive:true,force:true});}})().catch(e=>{console.error(e);process.exitCode=1;});
