import type {Capability} from './contracts';
const priorities:Record<string,readonly string[]>={
 inicio:['bookings.create','services.create','business.summary','business.statistics','customers.search','services.list'],
 servicios:['services.create','services.price','services.list','team.list','business.statistics'],
 clientes:['customers.search','customers.create','customers.history','business.statistics','services.list'],
 agenda:['bookings.create','bookings.list','bookings.reschedule','customers.search','business.statistics','services.list'],
 equipo:['team.list','team.create','team.update','services.list','business.statistics'],
 disponibilidad:['schedule.read','schedule.day','schedule.absence','team.list','services.list','business.statistics'],
 configuracion:['business.identity','business.rules','schedule.read','business.statistics','services.list','team.list'],
 'configuracion-inicial':['services.create','schedule.read','business.identity','services.list','team.list','customers.search'],
 estadisticas:['business.statistics','business.insights','business.opportunities','services.list','customers.search']
};
/** Input must be engine.available(): ranking cannot grant a capability or fetch data. */
export function contextualSuggestions(tools:readonly Capability[],view:string):Capability[]{
 const byId=new Map(tools.map(tool=>[tool.id,tool])),rank=[...(priorities[view]||priorities.inicio),'business.statistics','services.list','customers.search','team.list','customers.history',...tools.map(tool=>tool.id)];
 return [...new Set(rank)].flatMap(id=>byId.has(id)?[byId.get(id)!]:[]).slice(0,3);
}
