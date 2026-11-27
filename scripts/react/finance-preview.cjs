'use strict';
// Local fixture, existing cloud adapter and actual finance RPC. No hosted services or delivery workers.
const {createPreview}=require('../international/preview.cjs');
if(require.main===module)createPreview(Number(process.env.ATRY_FINANCE_PORT)||3386,{adminChat:true,finance:true}).then(s=>{console.log('FINANZAS · LOCAL ONLY: '+s.base+'/#/app/finanzas');console.log('Reservas ficticias de Uruguay y Panamá. Finanzas se activa manualmente; no hay cobros reales.');for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>void s.close().finally(()=>process.exit()))}).catch(e=>{console.error(e);process.exitCode=1});
