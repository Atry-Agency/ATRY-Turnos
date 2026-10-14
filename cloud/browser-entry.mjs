import {createCloudAuth} from './supabase-auth.mjs';
import {createApiAdapter} from './api-adapter.mjs';
import {subscribeAgenda} from './realtime.mjs';
import {createCaptcha} from './captcha.mjs';
import {createProofClient} from './proof-client.mjs';
import {initializeCloudSession} from './bootstrap.mjs';

const config=window.ATRY_CONFIG;
if(config?.backend==='supabase'){
 const captcha=createCaptcha({siteKey:config.turnstileSiteKey});
 const auth=createCloudAuth(config,{onRecovery:()=>{location.hash='#/restablecer/supabase';},onSignedOut:()=>{window.dispatchEvent(new Event('atry-cloud-signed-out'));}});
 const adapter=createApiAdapter({auth,config,protection:config.turnstileSiteKey?null:createProofClient(config),captcha:request=>captcha.getToken(request)});
 const cloud={auth,request:adapter.request,subscribeAgenda:options=>subscribeAgenda({client:auth.client,...options})};
 cloud.ready=initializeCloudSession(auth,adapter.finishRegistration).then(result=>{cloud.registrationNeedsSetup=result.needsOrganizationSetup===true;});
 window.ATRY_CLOUD=cloud;
}
