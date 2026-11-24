import type {AgendaPreferences} from '../agenda/model';
export interface IatryDestination {route:string;target?:string;messageRecipient?:string;agenda?:Partial<AgendaPreferences>}
