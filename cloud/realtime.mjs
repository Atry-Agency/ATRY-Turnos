// Compatibility wrapper around a real Supabase channel, preserving the UI's event contract.
export function subscribeAgenda({client,bid,role,staffId,onRpcError,intervalMs=30000}){
 const listeners=new Map();let closed=false,channel,signature=JSON.stringify([role,staffId||null]);
 const connection={onerror:null,addEventListener(name,fn){if(!listeners.has(name))listeners.set(name,new Set());listeners.get(name).add(fn);},close(){if(closed)return;closed=true;clearInterval(timer);if(channel)client.removeChannel(channel);}};
 const emit=name=>{if(!closed)for(const fn of listeners.get(name)||[])fn();};
 const connect=async()=>{
  const {data,error}=await client.auth.getSession();if(error||!data?.session){emit('access_revoked');return;}
  // Ensure the websocket uses the user's JWT, not its initial public-key identity.
  await client.realtime.setAuth(data.session.access_token);if(closed)return;
  channel=client.channel('atry-calendar-'+bid).on('postgres_changes',{event:'*',schema:'public',table:'calendar_revisions',filter:'business_id=eq.'+bid},()=>emit('change')).subscribe(status=>{
   if(status==='SUBSCRIBED')emit('ready');else if(['CHANNEL_ERROR','TIMED_OUT','CLOSED'].includes(status))connection.onerror?.();
  });
 };
 const verify=async()=>{
  if(closed)return;
  try{const {data,error}=await client.rpc('atry_access_context',{bid});if(error){onRpcError?.(error);connection.onerror?.();return;}
   if(!data.user_valid||!data.role||JSON.stringify([data.role,data.staff_id||null])!==signature)emit('access_revoked');
  }catch{connection.onerror?.();}
 };
 const timer=setInterval(verify,intervalMs);connect().catch(()=>connection.onerror?.());return connection;
}
