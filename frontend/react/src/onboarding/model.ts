import {subscriptionLive} from '../subscription/model';
import {weeklyWindows,type Window} from '../scheduling/model';
export type OnboardingStepId='identity'|'services'|'team'|'hours'|'public'|'review';
export interface OnboardingStep{id:OnboardingStepId;complete:boolean;detail:string}
export interface OnboardingBusiness{id?:string;name?:string;slug?:string;role?:string;plan?:string;sector?:string;city?:string;email?:string;phone?:string;access_enabled?:boolean;is_active?:number|boolean;subscription_status?:string;subscription_started_at?:string|null;paid_until?:string|null;trial_until?:string|null;onboarding_completed?:number|boolean}
export interface OnboardingInput{business:OnboardingBusiness;services:unknown;staff:unknown;scheduling:unknown;reviewedPublic:boolean}
const record=(value:unknown):Record<string,unknown>=>value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};
const rows=(value:unknown)=>Array.isArray(value)?value.map(record):[];
const enabled=(value:unknown)=>value===true||value===1;
const text=(value:unknown)=>typeof value==='string'&&value.trim().length>0;
export const planStaffLimit=(plan:unknown):number=>({individual:1,negocio:4,pro:10})[String(plan) as 'individual']||0;
const validWindow=(value:Record<string,unknown>):value is Record<string,unknown>&Window=>Number.isInteger(value.weekday)&&Number(value.weekday)>=0&&Number(value.weekday)<=6&&Number.isInteger(value.start_min)&&Number.isInteger(value.end_min)&&Number(value.start_min)>=0&&Number(value.end_min)<=1440&&Number(value.start_min)<Number(value.end_min)&&typeof value.staff_id==='string';
/** Progress is evidence, not permission: server entitlements remain authoritative. */
export function buildOnboarding({business:b,services,staff,scheduling,reviewedPublic}:OnboardingInput){
 const plan=String(b.plan||''),staffLimit=planStaffLimit(plan),eligible=b.role==='owner'&&text(b.id);
 const activeServices=rows(services).filter(s=>text(s.id)&&text(s.name)&&enabled(s.active)&&Number.isFinite(s.price_uyu)&&Number(s.price_uyu)>=0&&Number.isInteger(s.duration_min)&&Number(s.duration_min)>0);
 const activeStaff=rows(staff).filter(s=>text(s.id)&&text(s.name)&&enabled(s.active));
 const activeStaffCount=activeStaff.length,withinLimit=staffLimit>0&&activeStaffCount>0&&activeStaffCount<=staffLimit;
 const rules=record(scheduling),hours=rows(rules.hours).filter(validWindow),breaks=rows(rules.breaks).filter(validWindow);
 const hasHours=(id:unknown)=>typeof id==='string'&&weeklyWindows(hours,breaks,id).some(h=>h.end_min>h.start_min);
 const scheduled=activeStaff.filter(s=>hasHours(s.id));
 const identity=text(b.name)&&text(b.sector)&&text(b.city)&&(text(b.email)||text(b.phone));
 const team=withinLimit,configuredHours=team&&scheduled.length===activeStaffCount;
 const subscriptionEnabled=typeof b.access_enabled==='boolean'?b.access_enabled:subscriptionLive({...b,plan});
 const assigned=scheduled.some(p=>Array.isArray(p.service_ids)&&activeServices.some(s=>(p.service_ids as unknown[]).includes(s.id)));
 const bookable=eligible&&subscriptionEnabled&&withinLimit&&assigned;
 const publicReady=text(b.slug)&&identity&&bookable;
 const prerequisites=identity&&activeServices.length>0&&team&&configuredHours&&publicReady&&reviewedPublic===true;
 const steps:OnboardingStep[]=[
  {id:'identity',complete:identity,detail:identity?'Identidad y contacto preparados':'Completá nombre, rubro, ciudad y un contacto'},
  {id:'services',complete:activeServices.length>0,detail:activeServices.length?`${activeServices.length} servicios activos con precio y duración`:'Prepará tu primer servicio'},
  {id:'team',complete:team,detail:staffLimit?`${activeStaffCount} de ${staffLimit} profesionales activos`:'Plan pendiente de confirmar'},
  {id:'hours',complete:configuredHours,detail:configuredHours?'Horarios habituales preparados':'Revisá los horarios de cada profesional activo'},
  {id:'public',complete:publicReady&&reviewedPublic===true,detail:!subscriptionEnabled?'La disponibilidad pública requiere habilitación':!assigned?'Asigná servicios y horarios a un profesional':reviewedPublic?'Página pública revisada':'Revisá tu página pública'},
  {id:'review',complete:prerequisites&&enabled(b.onboarding_completed),detail:'Confirmá la revisión final de tu espacio'}
 ];
 const completed=eligible?steps.filter(s=>s.complete).length:0;
 return {eligible,plan,staffLimit,activeStaffCount,subscriptionEnabled,bookable,steps,completed,total:steps.length,percent:Math.round(completed/steps.length*100),readyToFinish:eligible&&prerequisites,nextStep:steps.find(s=>!s.complete)?.id||null};
}
