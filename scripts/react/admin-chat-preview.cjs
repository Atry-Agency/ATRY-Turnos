'use strict';
// Isolated PostgreSQL + real cloud adapter and existing RPC, all local. No Supabase connection or delivery worker.
const {createPreview}=require('../international/preview.cjs');
async function createAdminChatPreview(port=3362){return createPreview(port,{adminChat:true})}
module.exports={createAdminChatPreview};
if(require.main===module)createAdminChatPreview(Number(process.env.ATRY_ADMIN_CHAT_PORT)||3362).then(s=>{console.log('LOCAL ONLY · PostgreSQL ficticio: '+s.base+'/#/admin/inicio');for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>void s.close().finally(()=>process.exit()))}).catch(e=>{console.error(e);process.exitCode=1});
