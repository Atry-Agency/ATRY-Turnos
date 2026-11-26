import type {FeaturePort} from '../services/contracts';
import {LibraryIcon} from './LibraryIcon';
export function Icon({name,port,className='',motion}:{name:string;port:FeaturePort;className?:string;motion?:'confirm'|'spin'}){return <LibraryIcon name={name} markup={port.icon(name)} className={`i i-${name} ${className}`} motion={motion}/>}
