import {Theme} from '../domain/theme';
import type {AppPort} from '../app/port';
import {Icon} from '../ui/Icon';
import {initials} from '../domain/format';
export function BusinessAvatar({business,kind,fallback,port}:{business:{plan:string;name:string;logo_url?:string};kind:string;fallback?:string;port:AppPort}){const logo=Theme.effective(business).logo;return <div className={kind+' business-logo-avatar'+(logo?' has-logo':'')}>{logo?<img src={logo} alt={'Logo de '+business.name} decoding="async"/>:fallback?initials(fallback):<Icon name="shop" port={port}/>}</div>}
