'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const config={supabaseUrl:'https://project.supabase.co',supabaseKey:'sb_publishable_test'};
test('Supabase Auth: registro espera verificación y recuperación requiere enlace de Auth',async()=>{
 const {createCloudAuth}=await import('../cloud/supabase-auth.mjs');let callback,registered,updated,logout;
 const auth={onAuthStateChange(fn){callback=fn;return {data:{subscription:{unsubscribe(){}}}};},getSession:async()=>({data:{session:null}}),signUp:async value=>{registered=value;return {data:{user:{id:'auth-id'},session:null}};},updateUser:async value=>{updated=value;return {data:{user:{id:'auth-id'}}};},signOut:async value=>{logout=value;return {data:{}};}};
 const client=createCloudAuth(config,{clientFactory:()=>({auth}),location:{href:'https://turnos.pages.dev/?old=1#/registro'}});
 assert.deepEqual(await client.signUp({name:'Usuario Prueba 1',email:'usuario1@example.com',password:'TestAuthPassword2026!'}),{id:'auth-id',requiresEmailVerification:true});
 await client.signUp({name:'Usuario Prueba 1',email:'usuario1@example.com',password:'TestAuthPassword2026!',business_name:'Negocio Prueba',sector:'Taller de cerámica',platform_admin:true});assert.equal(registered.options.data.requested_business_sector,'Taller de cerámica');assert.ok(!('platform_admin' in registered.options.data));
 assert.equal(registered.options.emailRedirectTo,'https://turnos.pages.dev/?auth_flow=signup');assert.ok(!('role' in registered.options.data));
 await assert.rejects(client.resetPassword('NewAuthPassword2026!'),/enlace válido/);
 callback('PASSWORD_RECOVERY');await client.resetPassword('NewAuthPassword2026!');assert.deepEqual(updated,{password:'NewAuthPassword2026!'});assert.deepEqual(logout,{scope:'global'});
});
test('Supabase Auth: cambios de contraseña requieren contraseña actual y cierran todas las sesiones',async()=>{
 const {createCloudAuth}=await import('../cloud/supabase-auth.mjs');const calls=[];
 const client=createCloudAuth(config,{clientFactory:()=>({auth:{onAuthStateChange(){return {data:{subscription:{unsubscribe(){}}}};},updateUser:async payload=>{calls.push(payload);return {data:{}};},signOut:async payload=>{calls.push(payload);return {data:{}};}}}),location:{href:'https://turnos.pages.dev/'}});
 await client.changePassword('CurrentAuth2026!','NewAuthPassword2026!');assert.deepEqual(calls,[{password:'NewAuthPassword2026!',current_password:'CurrentAuth2026!'},{scope:'global'}]);
 assert.throws(()=>createCloudAuth({...config,supabaseKey:'sb_secret_invalid'}),/clave pública/);
});
