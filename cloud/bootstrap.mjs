export async function initializeCloudSession(auth,finishRegistration){
 try{
  await auth.ready();const {data,error}=await auth.client.auth.getSession();if(error)throw error;
  if(!data?.session)return {};
  return {needsOrganizationSetup:(await finishRegistration())?.needsOrganizationSetup===true};
 }catch(error){
  // A revoked JWT must not leave the login route waiting on a permanently rejected promise.
  if(error.status===401||error.status===403){try{await auth.signOut();return {signedOut:true};}catch{return {initializationFailed:true};}}
  // Individual requests can retry after a transient outage, including login and recovery.
  return {initializationFailed:true};
 }
}
