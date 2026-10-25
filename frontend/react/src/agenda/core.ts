import '../../../../web/agenda-core.js';
import type {Booking,Rules} from './model';
export interface Segment<T={starts_at:string;ends_at:string}>{booking:T;start:number;end:number}
export interface LayoutItem extends Segment<Booking>{column:number;columns:number}
interface AgendaCore{parts(value:string|Date,zone?:string):{day:string;minute:number};clock(minute:number):string;segment<T extends {starts_at:string;ends_at:string}>(booking:T,day:string,zone?:string):Segment<T>|null;layout(bookings:Booking[],day:string,zone?:string):LayoutItem[];windows(rules:Rules|null,staffId:string,day:string,zone?:string):{start:number;end:number}[]|null;bounds(bookings:Booking[],rules:Rules|null,staffIds:string[],days:string[],zone?:string):{start:number;end:number};serviceTone(id:string):string}
declare global{var ATRY_AGENDA:AgendaCore}
export const Calendar=globalThis.ATRY_AGENDA;
