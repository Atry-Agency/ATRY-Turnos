import type {AppPort} from '../app/port';
import {Icon} from '../ui/Icon';
import {link,type Section} from './model';

type Shortcut={label:string;icon:string;section:string;query?:Record<string,string|number>};
const shortcuts:Partial<Record<Section,Shortcut[]>>={
 negocios:[{label:'Por habilitar',icon:'lock',section:'negocios',query:{status:'pending'}},{label:'Vencen en 7 días',icon:'calendar',section:'negocios',query:{days:7}}],
 usuarios:[{label:'Historial administrativo',icon:'shield',section:'auditoria'}],
 comercial:[{label:'Pagos por verificar',icon:'wallet',section:'comercial',query:{state:'pending_verification'}},{label:'Próximos vencimientos',icon:'calendar',section:'negocios',query:{days:7}}],
 correos:[{label:'Fallidos',icon:'mail',section:'correos',query:{state:'failed'}},{label:'Entrega sin confirmar',icon:'info',section:'correos',query:{state:'delivery_unknown'}},{label:'Diagnóstico',icon:'chart',section:'sistema'}],
 soporte:[{label:'Incidencias abiertas',icon:'help',section:'soporte',query:{state:'open'}},{label:'En investigación',icon:'search',section:'soporte',query:{state:'investigating'}}],
};
export function ContextLinks({section,port,entity}:{section:Section;port:AppPort;entity:string|null}){
 const links=entity?[{label:'Correos del negocio',icon:'mail',section:'correos',query:{business_id:entity}},{label:'Historial del negocio',icon:'shield',section:'auditoria',query:{business_id:entity}}]:shortcuts[section];
 if(!links?.length)return null;
 return <nav className="cc-context-links" aria-label="Accesos rápidos de esta sección">{links.map(item=><a key={item.label} href={link(item.section,item.query)}><Icon name={item.icon} port={port}/>{item.label}</a>)}</nav>;
}
