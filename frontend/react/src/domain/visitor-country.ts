/** A suggestion for a visitor, never an authorization or an existing business profile. */
export type VisitorCountry='UY'|'PA';
export function visitorCountry(value:unknown):VisitorCountry|undefined{return value==='UY'||value==='PA'?value:undefined}
export function timeZoneCountry(timeZone:unknown):VisitorCountry|undefined{return timeZone==='America/Panama'?'PA':timeZone==='America/Montevideo'?'UY':undefined}
export function resolveVisitorCountry(manual:unknown,hint:unknown,timeZone?:unknown):VisitorCountry{return visitorCountry(manual)||visitorCountry(hint)||timeZoneCountry(timeZone)||'UY'}
export const registrationCountryKey='atry.registration.country.v1';
export function registrationSuggestion(){let manual:unknown,timeZone:unknown;try{manual=localStorage.getItem(registrationCountryKey)}catch{/* Selection still works for this visit. */}try{timeZone=Intl.DateTimeFormat().resolvedOptions().timeZone}catch{/* Unknown zones use Uruguay. */}const hint=document.querySelector<HTMLMetaElement>('meta[name="atry-visitor-country"]')?.content;return resolveVisitorCountry(manual,hint,timeZone)}
