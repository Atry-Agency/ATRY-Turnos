'use strict';const test=require('node:test'),assert=require('node:assert/strict');
test('Inicio cloud: sesión revocada permite volver a ingresar; un corte de red no borra una sesión válida',async()=>{
 const {initializeCloudSession}=await import('../cloud/bootstrap.mjs');let signedOut=0;
 const auth={ready:async()=>true,client:{auth:{getSession:async()=>({data:{session:{}}})}},signOut:async()=>{signedOut++;}};
 assert.deepEqual(await initializeCloudSession(auth,async()=>{throw Object.assign(new Error('FORBIDDEN'),{status:403});}),{signedOut:true});assert.equal(signedOut,1);
 assert.deepEqual(await initializeCloudSession(auth,async()=>{throw new Error('NETWORK_ERROR');}),{initializationFailed:true});assert.equal(signedOut,1);
 assert.deepEqual(await initializeCloudSession(auth,async()=>({needsOrganizationSetup:true})),{needsOrganizationSetup:true});
});
