import approvedPlans from '../../../../config/commercial-plans.json';
import proposals from '../../../../config/commercial-country-proposals.json';
export type CommercialCountry='UY'|'PA';
export const commercialPreferenceKey='atry.marketing.country.v1';
/** Commercial catalog, never a currency conversion or a business/subscription mutation. */
export const commercialCatalog=Object.freeze({
 UY:{name:'Uruguay',currency:'UYU',status:'approved',prices:{individual:approvedPlans.individual.price_uyu*100,negocio:approvedPlans.negocio.price_uyu*100,pro:approvedPlans.pro.price_uyu*100}},
 PA:{name:'Panamá',currency:'USD',status:'proposal',prices:proposals.PA.prices_minor},
} as const);
export function commercialCountry(value:unknown):CommercialCountry|undefined{return value==='UY'||value==='PA'?value:undefined}
export function resolveCommercialCountry(manual:unknown,hint:unknown):CommercialCountry{return commercialCountry(manual)||commercialCountry(hint)||'UY'}
export function localCommercialPreview(hostname:string){return ['127.0.0.1','localhost','[::1]'].includes(hostname)}
export function commercialPrice(country:CommercialCountry,plan:keyof typeof commercialCatalog.UY.prices,localPreview=false){const c=commercialCatalog[country];if(c.status==='proposal'&&!localPreview)return null;return (country==='PA'?'US$':'$')+new Intl.NumberFormat('es-UY',{maximumFractionDigits:0}).format(c.prices[plan]/100)}
