import type {LegacyPort} from '../services/contracts';
export function Icon({name,port}:{name:string;port:LegacyPort}){return <svg className={`i i-${name} `} viewBox="0 0 24 24" aria-hidden="true" dangerouslySetInnerHTML={{__html:port.icon(name)}}/>}
