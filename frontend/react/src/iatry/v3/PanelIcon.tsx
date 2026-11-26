import type {CSSProperties} from 'react';
import {lucideGlyphs} from '../../domain/icon-library/glyphs';
import {LibraryIcon} from '../../ui/LibraryIcon';
const names:Record<string,string>={chart:'chart-column',service:'tag',motion:'pause',suggestions:'sparkles',arrow:'arrow-right',chevron:'chevron-right',calendar:'calendar-days',grid:'layout-grid',users:'users-round',close:'x','service-create':'clipboard-plus'};
export function PanelIcon({name,className='',style}:{name:string;className?:string;style?:CSSProperties}){return <LibraryIcon name={name} markup={lucideGlyphs[names[name]||name]} className={'iatry-panel-icon '+className} style={style}/>}
