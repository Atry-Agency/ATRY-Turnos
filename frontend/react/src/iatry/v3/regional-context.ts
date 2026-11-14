import {region,type RegionalBusiness} from '../../domain/region';
import type {Capability} from './contracts';
/** Adapt presentation and exact decimal validation, never capability IDs, roles or permissions. */
export function regionalCapabilities(tools:readonly Capability[],business:RegionalBusiness={}):Capability[]{
 if(region(business).currency!=='USD')return [...tools];
 return tools.map(tool=>({...tool,fields:tool.fields.map(field=>field.key==='price_uyu'?{...field,label:'Precio (USD)',decimalPlaces:2 as const}:field)}));
}
