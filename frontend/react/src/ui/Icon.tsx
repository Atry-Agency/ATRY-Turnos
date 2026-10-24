import type {LegacyPort} from '../services/contracts';
export function Icon({name,port,className=''}:{name:string;port:LegacyPort;className?:string}){return <svg className={`i i-${name} ${className}`} viewBox="0 0 24 24" aria-hidden="true" dangerouslySetInnerHTML={{__html:port.icon(name)}}/>}
