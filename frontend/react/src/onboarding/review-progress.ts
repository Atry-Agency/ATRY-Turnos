export const setupRoutes=['configuracion','servicios','disponibilidad'] as const;
export type SetupRoute=typeof setupRoutes[number];
/** Explicit review marks only; never evidence of server readiness or completed onboarding. */
export function reviewKey(user:string,business:string){return 'atry:setup-review:'+encodeURIComponent(user)+':'+encodeURIComponent(business)}
export function readReviews(storage:Pick<Storage,'getItem'>,key:string):SetupRoute[]{
 try{const value:unknown=JSON.parse(storage.getItem(key)||'[]');return Array.isArray(value)?setupRoutes.filter(route=>value.includes(route)):[]}catch{return []}
}
