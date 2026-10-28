/** Execution scope for the isolated local candidate, never a production grant. */
export const phaseOneTools:readonly string[]=Object.freeze(['services.list','services.create','services.price','services.duration','services.details','services.publish','services.hide','customers.create','customers.update','customers.search','customers.history','schedule.read','schedule.day','schedule.absence','schedule.blocks','team.list','business.statistics']);
export const controlledRealEvidence:readonly string[]=Object.freeze(['services.create','services.price','services.duration','services.details','services.publish','services.hide','customers.create','customers.update','schedule.absence']);
export const phaseOneRollback='5a5aaa4868366eb51afcb181c6b0cc49d7c0e1ce';
