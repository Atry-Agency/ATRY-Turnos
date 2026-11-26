import {LibraryIcon} from '../ui/LibraryIcon';
const names={expand:'maximize',down:'chevron-down',calendar:'calendar-days',route:'route',palette:'palette'};
export function MarketingIcon({kind}:{kind:keyof typeof names}){return <LibraryIcon name={names[kind]} className="marketing-icon"/>}
