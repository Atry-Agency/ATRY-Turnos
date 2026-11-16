import {visitorCountry,timeZoneCountry,resolveVisitorCountry} from '../domain/visitor-country';
import approvedPlans from '../../../../config/commercial-plans.json';
import proposals from '../../../../config/commercial-country-proposals.json';
export type CommercialCountry='UY'|'PA';
export const commercialPreferenceKey='atry.marketing.country.v1';
/** Commercial catalog, never a currency conversion or a business/subscription mutation. */
export const commercialCatalog=Object.freeze({
 UY:{name:'Uruguay',currency:'UYU',status:'approved',prices:{individual:approvedPlans.individual.price_uyu*100,negocio:approvedPlans.negocio.price_uyu*100,pro:approvedPlans.pro.price_uyu*100}},
 PA:{name:'Panamá',currency:'USD',status:'approved',paidContractingEnabled:false,prices:proposals.PA.prices_minor},
} as const);
export function commercialCountry(value:unknown):CommercialCountry|undefined{return visitorCountry(value)}
/** Exact IANA zones only: offsets and browser language do not identify a country. */
export function commercialTimeZoneCountry(timeZone:unknown):CommercialCountry|undefined{return timeZoneCountry(timeZone)}
/** A server hint is optional on static hosting. Only a visitor's explicit choice is persisted. */
export function resolveCommercialCountry(manual:unknown,hint:unknown,timeZone?:unknown):CommercialCountry{return resolveVisitorCountry(manual,hint,timeZone)}
export function localCommercialPreview(hostname:string){return ['127.0.0.1','localhost','[::1]'].includes(hostname)}
export function commercialPrice(country:CommercialCountry,plan:keyof typeof commercialCatalog.UY.prices,localPreview=false){const c=commercialCatalog[country];return (country==='PA'?'US$':'$')+new Intl.NumberFormat('es-UY',{maximumFractionDigits:0}).format(c.prices[plan]/100)}
