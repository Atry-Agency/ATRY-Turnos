import {createCloudAuth as authFactory} from '../../../../cloud/supabase-auth.mjs';
import {createApiAdapter as adapterFactory} from '../../../../cloud/api-adapter.mjs';
import {subscribeAgenda as subscribeFactory} from '../../../../cloud/realtime.mjs';
import {createProofClient as proofFactory} from '../../../../cloud/proof-client.mjs';
import {initializeCloudSession as initializeFactory} from '../../../../cloud/bootstrap.mjs';
import type {CloudRuntime,Connection} from '../app/model';
import type {RequestOptions,RuntimeConfig} from './pure-runtime';
import {challenges} from './challenge';
type Auth=CloudRuntime['auth']&{client:unknown;ready():Promise<unknown>;signOut():Promise<unknown>};
export function createCloudRuntime(config:RuntimeConfig):CloudRuntime{
 const createAuth=authFactory as (config:RuntimeConfig,options:{onRecovery:()=>void;onSignedOut:()=>void})=>Auth,createAdapter=adapterFactory as (options:{auth:Auth;config:RuntimeConfig;protection:unknown;captcha:(request:{action:string;key:string})=>Promise<string>})=>{request:(route:string,options?:RequestOptions)=>Promise<unknown>;finishRegistration:()=>Promise<unknown>},subscribe=subscribeFactory as (options:{client:unknown;bid:string;role:string;staffId?:string})=>Connection,createProof=proofFactory as (config:RuntimeConfig,options:{WorkerClass:typeof Worker})=>unknown,initialize=initializeFactory as (auth:Auth,finish:()=>Promise<unknown>)=>Promise<{needsOrganizationSetup?:boolean}>;
 const auth=createAuth(config,{onRecovery:()=>{location.hash='#/restablecer/supabase'},onSignedOut:()=>window.dispatchEvent(new Event('atry-cloud-signed-out'))});
 const WorkerClass=function(_url:URL){return new Worker(new URL('../../../../cloud/proof-worker.mjs',import.meta.url),{type:'module'})} as unknown as typeof Worker;
 const adapter=createAdapter({auth,config,protection:config.turnstileSiteKey?null:createProof(config,{WorkerClass}),captcha:request=>challenges.request(config.turnstileSiteKey||'',request)});
 const cloud:CloudRuntime={auth,request:adapter.request,subscribeAgenda:options=>subscribe({client:auth.client,...options}),ready:Promise.resolve()};
 cloud.ready=initialize(auth,adapter.finishRegistration).then(result=>{cloud.registrationNeedsSetup=result.needsOrganizationSetup===true});return cloud;
}
