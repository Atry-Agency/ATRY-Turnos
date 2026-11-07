'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..'),output=path.join(root,'frontend/react/dist/subscription-review.cjs');
require(path.join(root,'node_modules/esbuild')).buildSync({entryPoints:[path.join(root,'frontend/react/src/app/subscription-review.ts')],outfile:output,bundle:true,platform:'node',format:'cjs'});
const {reviewSubscriptionAccess}=require(output);
function fixture(change=()=>{}){let calls=0;const state={session:{userId:'owner',version:1},scope:{businessId:'test',accessEnabled:false},business:{id:'test',plan:'negocio',is_active:1,subscription_status:'active',paid_until:'2099-01-01T00:00:00Z'}};return {state,port:{session:()=>state.session,scope:()=>state.scope,business:()=>state.business,refreshPermissions:async()=>{calls++;await change(state)}},calls:()=>calls}}
(async()=>{
 for(const plan of ['individual','negocio','pro']){const f=fixture(s=>{s.scope.accessEnabled=true});f.state.business.plan=plan;assert.equal(await reviewSubscriptionAccess(f.port,'test'),'enabled');assert.equal(f.calls(),1)}
 for(const mutate of [s=>{s.scope.accessEnabled=false},s=>{s.scope.accessEnabled=true;s.business.paid_until='2020-01-01T00:00:00Z'},s=>{s.scope.accessEnabled=true;s.business.is_active=0},s=>{s.scope.accessEnabled=true;s.business.subscription_status='suspended'},s=>{s.scope.accessEnabled=true;s.business.subscription_started_at='2098-01-01T00:00:00Z'}]){const f=fixture(mutate);assert.equal(await reviewSubscriptionAccess(f.port,'test'),'restricted')}
 for(const mutate of [s=>{s.scope.businessId='other'},s=>{s.session.userId='other'},s=>{s.session.version=2},s=>{s.session=null},s=>{s.scope=null}]){const f=fixture(mutate);assert.equal(await reviewSubscriptionAccess(f.port,'test'),'stale')}
 const f=fixture(()=>{throw Error('network')});await assert.rejects(()=>reviewSubscriptionAccess(f.port,'test'),/network/);
 const build=path.join(root,'frontend/react/dist'),manifest=JSON.parse(fs.readFileSync(path.join(build,'react-assets.json'),'utf8'));
 const js=fs.readdirSync(path.join(build,'assets')).filter(f=>f.endsWith('.js')).map(f=>fs.readFileSync(path.join(build,'assets',f),'utf8')).join('\n');
 for(const control of ['Ver sin habilitación','Ver habilitado','Volver al aviso','Animaciones · solo vista local'])assert(!js.includes(control),'Production contains local-only control: '+control);
 for(const page of ['/privacidad.html','/terminos.html','/cookies.html'])assert(!JSON.stringify(manifest).includes(page));
 console.log('PASS subscription notice: 3 plans; expired, future, suspended, server denial, changed identity/business/session and failed read never report success; single read refresh; local controls and incomplete legal pages excluded from production');
})().catch(error=>{console.error(error);process.exitCode=1});
