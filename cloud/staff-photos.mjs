import Core from '../web/staff-photo-core.js';
export function createStaffPhotoAdapter({client,rpc}){
 const bucket=()=>client.storage.from(Core.bucket);
 return async function request(path,method,body,url){
  let m=path.match(/^\/api\/staff-photos\/([A-Za-z0-9_-]+)(?:\/([A-Za-z0-9_-]+)\/([A-Za-z0-9_-]+))?$/);
  if(m&&method==='GET'){
   if(!m[2])return {handled:true,data:await rpc('atry_staff_photos',{bid:m[1],public_view:url.searchParams.get('public')==='1'})};
   const result=await bucket().download(Core.path(m[1],m[2],m[3]));if(result.error)throw Error('La fotografía no está disponible');
   return {handled:true,data:{url:URL.createObjectURL(result.data)}};
  }
  m=path.match(/^\/api\/business\/([A-Za-z0-9_-]+)\/staff\/([A-Za-z0-9_-]+)\/photo$/);
  if(!m||method!=='PUT')return {handled:false};
  const [bid,sid]=m.slice(1),payload={expected_path:body.expected_path,expected_revision:body.expected_revision,show_public:body.show_public};let uploaded;
  if(body.image===null)payload.path=null;
  else if(body.image!==undefined){const bytes=Core.bytes(body.image);uploaded=Core.path(bid,sid,crypto.randomUUID());const result=await bucket().upload(uploaded,bytes,{contentType:'image/webp',cacheControl:'0',upsert:false});if(result.error)throw Error('No se pudo subir la fotografía');payload.path=uploaded;}
  let result;
  try{result=await rpc('atry_staff_photos',{bid,sid,payload});}
  catch(error){if(uploaded){try{const current=await rpc('atry_staff_photos',{bid});if(!current.some(p=>p.path===uploaded))await bucket().remove([uploaded]);}catch{/* Unknown commit outcome: preserve the object for reconciliation. */}}throw error;}
  // Storage and PostgreSQL are not one transaction. Keep the committed pointer if cleanup fails.
  if(result.old_path&&result.old_path!==result.photo?.path){try{const cleanup=await bucket().remove([result.old_path]);if(cleanup.error)return {handled:true,data:{...result.photo,cleanup_pending:true}};}catch{return {handled:true,data:{...result.photo,cleanup_pending:true}};}}
  return {handled:true,data:result.photo};
 };
}
