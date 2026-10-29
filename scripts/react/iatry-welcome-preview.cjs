'use strict';
// Disposable development fixture. Never shipped by the Pages build.
const {createLocalPreview}=require('./iatry-v3-preview.cjs');
createLocalPreview(Number(process.env.ATRY_WELCOME_PORT)||3346,{phaseOne:true}).then(preview=>{
 const uid=preview.db.prepare("SELECT id FROM users WHERE email='usuario1@example.com'").get().id;
 const row=preview.db.prepare("SELECT business_id FROM memberships WHERE user_id=? AND role='owner' LIMIT 1").get(uid);
 preview.db.prepare('UPDATE businesses SET onboarding_completed=0 WHERE id=?').run(row.business_id);
 if(process.env.ATRY_WELCOME_SCENARIO!=='partial'&&process.env.ATRY_WELCOME_SCENARIO!=='complete')preview.db.prepare('UPDATE services SET active=0 WHERE business_id=?').run(row.business_id);
 if(process.env.ATRY_WELCOME_SCENARIO==='complete')preview.db.prepare('UPDATE businesses SET onboarding_completed=1 WHERE id=?').run(row.business_id);
 console.log('Bienvenida local: '+preview.base+'/local-assistant');
 console.log('Datos ficticios en memoria, sin Supabase ni envíos. Abrí Primeros pasos.');
 for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>void preview.close().finally(()=>process.exit()));
}).catch(e=>{console.error(e.message);process.exitCode=1});
