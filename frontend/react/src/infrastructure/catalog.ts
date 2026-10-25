import type {AppPort} from '../app/port';
import type {Scope} from '../services/contracts';
import {parseCatalog} from '../services/repository';
import type {scopedApi} from './scoped-api';
/** Cloud staff uses the protected catalog RPC; the local backend exposes the staff-safe public catalog. */
export function readCatalog(api:ReturnType<typeof scopedApi>,port:AppPort,scope:Scope){if(scope.role==='staff'&&!port.privateEmployeeCatalog())return api.readRoute('/api/public/'+encodeURIComponent(port.business().slug),v=>{const x=v as {services:unknown;staff:unknown};if(!Array.isArray(x.services)||!Array.isArray(x.staff))throw Error('No se recibió el catálogo público.');return parseCatalog(x.services.map(s=>({...s,active:1,buffer_before_min:s.buffer_before_min??0,buffer_after_min:s.buffer_after_min??0})),x.staff.map(s=>({...s,active:1})))});return Promise.all([api.read('/services',v=>v),api.read('/staff',v=>v)]).then(([services,staff])=>parseCatalog(services,staff))}
