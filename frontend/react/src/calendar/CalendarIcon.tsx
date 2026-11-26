import {LibraryIcon} from '../ui/LibraryIcon';
const names={calendar:'calendar-days',clock:'clock',pin:'map-pin',navigation:'navigation',user:'user-round'};
export function CalendarIcon({name,className=''}:{name:keyof typeof names;className?:string}){return <LibraryIcon name={names[name]} className={className}/>}
