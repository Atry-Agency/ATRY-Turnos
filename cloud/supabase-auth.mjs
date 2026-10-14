import {createClient} from '@supabase/supabase-js';

const messages={invalid_credentials:'Correo o contraseña incorrectos.',email_not_confirmed:'Confirmá tu correo antes de ingresar.',over_email_send_rate_limit:'Se alcanzó el límite de correo. Reintentá más tarde.',over_request_rate_limit:'Demasiadas solicitudes. Reintentá más tarde.',weak_password:'La contraseña no cumple los requisitos de seguridad.',same_password:'Usá una contraseña diferente.',session_not_found:'La sesión venció. Iniciá sesión nuevamente.'};
export function authError(error){return Object.assign(new Error(messages[error?.code]||'No se pudo completar la operación de acceso. Reintentá o solicitá recuperación.'),{status:error?.status||400,code:error?.code||'AUTH_ERROR'});}
export function createCloudAuth(config,{clientFactory=createClient,location=globalThis.location,onRecovery=()=>{},onSignedOut=()=>{}}={}){
 if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(config.supabaseUrl||'')||!/^sb_publishable_/.test(config.supabaseKey||''))throw new Error('La conexión requiere la URL del proyecto y su clave pública.');
 const authOptions={flowType:'pkce',persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storageKey:'atry-auth-'+new URL(config.supabaseUrl).hostname};
 const client=clientFactory(config.supabaseUrl,config.supabaseKey,{auth:authOptions});
 let recovery=false;
 const subscription=client.auth.onAuthStateChange(event=>{
  if(event==='PASSWORD_RECOVERY'){recovery=true;queueMicrotask(onRecovery);}
  if(event==='SIGNED_OUT'){recovery=false;queueMicrotask(onSignedOut);}
 }).data.subscription;
 const unwrap=result=>{if(result.error)throw authError(result.error);return result.data;};
 const redirect=kind=>{const u=new URL(location.href);u.search='';u.hash='';u.searchParams.set('auth_flow',kind);return u.href;};
 return {
  client,
  async ready(){unwrap(await client.auth.getSession());return true;},
  async signUp(payload){
   const name=String(payload.name||'').trim(),email=String(payload.email||'').trim().toLowerCase(),password=String(payload.password||'');
   if(name.length<2||name.length>100||password.length<10||password.length>128)throw new Error('Revisá nombre y contraseña de entre 10 y 128 caracteres.');
   const businessName=String(payload.business_name||'').trim().slice(0,100);
   const businessSlug=businessName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,55);
   if(businessName&&(businessName.length<2||businessSlug.length<3))throw new Error('Elegí un nombre de negocio que genere un enlace de al menos tres caracteres.');
   const data=unwrap(await client.auth.signUp({email,password,options:{emailRedirectTo:redirect('signup'),data:{name,...(businessName?{requested_business_name:businessName,requested_business_slug:businessSlug}:{})}}}));
   return {id:data.user?.id,requiresEmailVerification:!data.session};
  },
  async signIn(email,password){unwrap(await client.auth.signInWithPassword({email:String(email).trim().toLowerCase(),password}));return {ok:true};},
  async signOut(){unwrap(await client.auth.signOut({scope:'local'}));return {ok:true};},
  async user(){return unwrap(await client.auth.getUser()).user;},
  async requestRecovery(email){unwrap(await client.auth.resetPasswordForEmail(String(email).trim().toLowerCase(),{redirectTo:redirect('recovery')}));return {ok:true,message:'Si el correo corresponde a una cuenta, recibirás las instrucciones para recuperar el acceso.'};},
  async resetPassword(password){if(!recovery)throw new Error('Abrí un enlace válido de recuperación.');if(String(password).length<10||String(password).length>128)throw new Error('Usá entre 10 y 128 caracteres.');unwrap(await client.auth.updateUser({password}));unwrap(await client.auth.signOut({scope:'global'}));return {ok:true};},
  async changePassword(currentPassword,password){if(!currentPassword)throw new Error('Ingresá tu contraseña actual.');if(String(password).length<10||String(password).length>128)throw new Error('Usá entre 10 y 128 caracteres.');unwrap(await client.auth.updateUser({password,current_password:currentPassword}));unwrap(await client.auth.signOut({scope:'global'}));return {ok:true};},
  async changeEmail(email,currentPassword){
   const user=await this.user();
   // Reauthentication uses a separate, non-persistent session, leaving the UI's session intact.
   const verification=clientFactory(config.supabaseUrl,config.supabaseKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
   unwrap(await verification.auth.signInWithPassword({email:user.email,password:currentPassword}));
   try{unwrap(await client.auth.updateUser({email:String(email).trim().toLowerCase()}, {emailRedirectTo:redirect('email_change')}));}finally{await verification.auth.signOut({scope:'local'});}
   return {ok:true,requiresEmailVerification:true};
  },
  destroy(){subscription.unsubscribe();}
 };
}
