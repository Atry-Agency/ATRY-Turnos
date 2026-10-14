const {test}=require('node:test');const assert=require('node:assert/strict');const {context}=require('./helpers');
const credentials={email:'demo@atryturnos.test',password:'AtryDemo2026!'};
test('A: cuenta sin organización y creación de negocios adicionales aislados',async()=>{const t=await context();try{
 const account={name:'Empleado Nuevo',email:'cuenta@test.uy',password:'CuentaSegura2026!'};assert.equal((await t.call('/api/auth/account',{data:account})).status,200);const login=await t.call('/api/auth/login',{data:account});assert.equal((await t.call('/api/auth/me',{cookie:login.cookie})).body.businesses.length,0);
 const owner=await t.call('/api/auth/login',{data:credentials});const added=await t.call('/api/organizations',{cookie:owner.cookie,data:{name:'Segundo negocio'}});assert.equal(added.status,200);assert.equal((await t.call('/api/auth/me',{cookie:owner.cookie})).body.businesses.length,2);assert.equal((await t.call('/api/business/'+added.body.id,{cookie:login.cookie})).status,403);
 assert.equal((await t.call('/api/organizations',{cookie:owner.cookie,data:{name:'Segundo negocio'}})).status,409);
}finally{await t.close();}});
test('A: invitación a empleado sin negocio, uso único, roles y revocación inmediata',async()=>{const t=await context();try{
 const owner=await t.call('/api/auth/login',{data:credentials}),cookie=owner.cookie;const bid=t.db.prepare('SELECT id FROM businesses').get().id,staff=t.db.prepare('SELECT id FROM staff WHERE business_id=? AND user_id IS NULL LIMIT 1').get(bid).id,p='/api/business/'+bid;
 const invite=await t.call(p+'/invitations',{cookie,data:{email:'invitado@test.uy',role:'staff',staff_id:staff}});assert.equal(invite.status,200);const token=t.db.prepare("SELECT content FROM system_outbox WHERE kind='invitation'").get().content.match(/invitacion\/([A-Za-z0-9_-]+)/)[1];
 assert.equal((await t.call('/api/invitations/'+token)).status,200);assert.equal((await t.call('/api/invitations/'+token+'/accept',{data:{name:'Invitado',password:'InvitadoSegura!'}})).status,200);assert.equal((await t.call('/api/invitations/'+token+'/accept',{data:{}})).status,404);
 const employee=await t.call('/api/auth/login',{data:{email:'invitado@test.uy',password:'InvitadoSegura!'}});const me=(await t.call('/api/auth/me',{cookie:employee.cookie})).body;assert.equal(me.businesses.length,1);assert.equal(me.businesses[0].role,'staff');assert.equal((await t.call(p+'/invitations',{cookie:employee.cookie,data:{email:'otro@test.uy',role:'manager'}})).status,403);
 assert.equal((await t.call(p+'/members/'+me.user.id,{cookie,data:{role:'manager'},method:'PATCH'})).status,200);assert.equal((await t.call(p+'/customers',{cookie:employee.cookie})).status,200);
 assert.equal((await t.call(p+'/members/'+me.user.id,{cookie,method:'DELETE'})).status,200);assert.equal((await t.call(p+'/bookings',{cookie:employee.cookie})).status,403);assert.equal(t.db.prepare('SELECT user_id FROM staff WHERE id=?').get(staff).user_id,null);
 const own=(await t.call('/api/auth/me',{cookie})).body.user.id;assert.equal((await t.call(p+'/members/'+own,{cookie,method:'DELETE'})).status,409);assert.equal((await t.call(p+'/members/'+own,{cookie,data:{role:'manager'},method:'PATCH'})).status,409);
}finally{await t.close();}});
test('A: invitación revocada/vencida, cuenta equivocada y cambios de perfil protegidos',async()=>{const t=await context();try{
 const owner=await t.call('/api/auth/login',{data:credentials}),cookie=owner.cookie;const bid=t.db.prepare('SELECT id FROM businesses').get().id,p='/api/business/'+bid;
 const invite=await t.call(p+'/invitations',{cookie,data:{email:'demo@atryturnos.test',role:'manager'}});assert.equal(invite.status,409);
 await t.call('/api/auth/account',{data:{name:'Otra cuenta',email:'other@test.uy',password:'OtraCuentaSegura!'}});
 const created=await t.call(p+'/invitations',{cookie,data:{email:'other@test.uy',role:'manager'}});const token=t.db.prepare("SELECT content FROM system_outbox WHERE kind='invitation'").get().content.match(/invitacion\/([A-Za-z0-9_-]+)/)[1];assert.equal((await t.call('/api/invitations/'+token+'/accept',{cookie,data:{}})).status,401);
 await t.call(p+'/invitations/'+created.body.id,{cookie,method:'DELETE'});assert.equal((await t.call('/api/invitations/'+token)).status,404);
 await t.call(p+'/invitations',{cookie,data:{email:'other@test.uy',role:'manager'}});const expiredToken=t.db.prepare("SELECT content FROM system_outbox WHERE kind='invitation' ORDER BY created_at DESC LIMIT 1").get().content.match(/invitacion\/([A-Za-z0-9_-]+)/)[1];t.db.exec("UPDATE invitations SET expires_at='2000-01-01T00:00:00.000Z' WHERE revoked_at IS NULL");assert.equal((await t.call('/api/invitations/'+expiredToken)).status,404);
 assert.equal((await t.call('/api/account/profile',{cookie,data:{email:'new@test.uy'},method:'PATCH'})).status,403);assert.equal((await t.call('/api/account/profile',{cookie,data:{name:'Nuevo nombre'},method:'PATCH'})).body.name,'Nuevo nombre');
}finally{await t.close();}});
