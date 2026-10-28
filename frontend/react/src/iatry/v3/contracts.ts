import type {OperationFacts} from '../shared/OperationCard';
import type {Instruction} from './instructions';
import type {VisitOption} from '../../visits/contracts';
import type {AppPort} from '../../app/port';
import type {Scope} from '../../services/contracts';
import type {scopedApi} from '../../infrastructure/scoped-api';
export type Values=Record<string,string|string[]|boolean>;
export type Option={value:string;label:string};
export type Row=Record<string,unknown>&{id:string};
export type FieldType='text'|'email'|'tel'|'number'|'date'|'time'|'datetime-local'|'select'|'multiple'|'checkbox'|'color';
export interface Field {key:string;label:string;type:FieldType;required?:boolean;min?:number;max?:number;maxLength?:number;hint?:string;options?:Option[];value?:string|string[]|boolean}
export interface FieldSpec extends Omit<Field,'options'|'value'>{options?:Option[]|((ctx:ToolContext,values:Values)=>Promise<Option[]>);value?:Field['value']|((ctx:ToolContext,values:Values)=>Promise<Field['value']>)}
export interface Result {preview?:OperationFacts;verified?:boolean;title:string;message:string;rows?:{label:string;value:string}[];items?:{id?:string;title:string;detail:string}[];records?:{tail:string;rows:Row[]};source?:string}
export interface Plan {tail:string;method:'POST'|'PATCH'|'PUT';payload:unknown;summary:{label:string;value:string}[];warning:string;success:string;recheck?:()=>Promise<void>;applyBusiness?:boolean;verify?:(response:unknown)=>Promise<unknown>}
export interface Capability {id:string;area:string;title:string;aliases:string[];kind:'read'|'create'|'update'|'cancel';roles:Scope['role'][];feature?:string;minimumPlan?:'negocio'|'pro';fields:FieldSpec[];warning?:string;read?:(ctx:ToolContext,values:Values)=>Promise<Result>;prepare?:(ctx:ToolContext,values:Values)=>Promise<Plan>}
export interface ToolContext {port:Pick<AppPort,'scope'|'business'|'capability'|'whatsapp'|'bookingIssues'|'exactContacts'|'contactKey'|'publicURL'|'privateEmployeeCatalog'>;scope:Scope;api:Pick<ReturnType<typeof scopedApi>,'read'|'readRoute'|'current'>;cache:Map<string,Promise<unknown>>;environment:'demo'|'local'|'phase-one-local'|'supabase-local'|'service-validation'|'customer-validation'|'supabase-readonly'|'connected'|'operation-validation'|'reservation-validation';operationId:string;visitOptions:(id:string,date:string)=>Promise<VisitOption[]>;alive:()=>boolean;read:<T>(tail:string,decode:(value:unknown)=>T,fresh?:boolean)=>Promise<T>}
export type StepProgress='pending'|'active'|'done'|'error'|'uncertain';
export interface EngineState {advice?:import('./plan-advisor').PlanAdviceResult;social?:import('./social').SocialReply;verifying?:boolean;instruction?:Instruction;progress?:StepProgress[];activeStep?:number;phase:'idle'|'loading'|'question'|'review'|'executing'|'done'|'error'|'uncertain';tool?:Capability;field?:Field;index:number;values:Values;plan?:Plan;token?:string;result?:Result;error?:string}
export const text=(v:Values,key:string)=>typeof v[key]==='string'?v[key] as string:'';
export const ids=(v:Values,key:string)=>Array.isArray(v[key])?v[key] as string[]:[];
export const encoded=(value:string)=>{if(!/^[A-Za-z0-9_-]{1,100}$/.test(value))throw Error('Elegí un registro válido.');return encodeURIComponent(value)};
export function rows(value:unknown):Row[]{if(!Array.isArray(value)||value.some(x=>!x||typeof x.id!=='string'))throw Error('El sistema no devolvió una lista válida.');return value}
export function object(value:unknown):Record<string,unknown>{if(!value||typeof value!=='object'||Array.isArray(value))throw Error('El sistema no devolvió datos válidos.');return value as Record<string,unknown>}
