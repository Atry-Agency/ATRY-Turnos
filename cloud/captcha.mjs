let scriptReady;
export function createCaptcha({siteKey,window=globalThis.window,document=globalThis.document}){
 const load=()=>scriptReady ||= new Promise((resolve,reject)=>{
  if(window.turnstile){resolve();return;}
  const script=document.createElement('script');script.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';script.async=true;script.onload=resolve;script.onerror=()=>{scriptReady=null;reject(new Error('No se pudo cargar la protección de reservas. Reintentá.'));};document.head.append(script);
 });
 return {async getToken({action,key}){
  if(!siteKey)throw new Error('Falta configurar la protección de reservas públicas.');
  await load();
  return new Promise((resolve,reject)=>{
   const dialog=document.createElement('dialog'),box=document.createElement('div'),title=document.createElement('p'),cancel=document.createElement('button');let id,timer,finished=false;
   title.textContent='Verificando tu solicitud';cancel.textContent='Cancelar';cancel.className='btn secondary';dialog.append(title,box,cancel);document.body.append(dialog);dialog.showModal();
   const finish=(error,token)=>{if(finished)return;finished=true;clearTimeout(timer);if(id!==undefined)window.turnstile.remove(id);dialog.close();dialog.remove();error?reject(new Error(error)):resolve(token);};
   cancel.onclick=()=>finish('Verificación cancelada. Tus datos se conservan.');dialog.oncancel=e=>{e.preventDefault();cancel.onclick();};
   timer=setTimeout(()=>finish('La verificación venció. Reintentá.'),120000);
   try{id=window.turnstile.render(box,{sitekey:siteKey,action,cData:key,callback:token=>finish(null,token),'error-callback':()=>finish('No se pudo verificar la solicitud. Reintentá.'),'expired-callback':()=>finish('La verificación venció. Reintentá.')});}catch{finish('No se pudo iniciar la verificación.');}
  });
 }};
}
