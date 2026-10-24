import type {Service} from './contracts';
import {Button,Card,Badge} from './ui/primitives';
export interface ServiceCardProps {service:Service;icon:React.ReactNode;editIcon:React.ReactNode;onEdit?:()=>void;onToggle?:()=>void;disabled?:boolean}
export function ServiceCard({service:s,icon,editIcon,onEdit,onToggle,disabled}:ServiceCardProps){
 return <Card className="stack"><div className="row between"><div className="icon-circle">{icon}</div><Badge active={s.active}/></div>
  <div><h3 style={{margin:'0 0 6px'}}>{s.name}</h3><p className="small muted" style={{margin:0}}>{s.description||'Servicio disponible en agenda'}</p></div>
  <div className="row between"><strong style={{fontSize:22,letterSpacing:'-.03em'}}>{'$'+Number(s.price_uyu||0).toLocaleString('es-UY')}</strong><span className="small muted">{`${s.duration_min} minutos`}</span></div>
  <div className="small muted">{`${s.deposit_percent?`Seña prevista: ${s.deposit_percent}% · `:''}Preparación: ${s.buffer_before_min}m · Limpieza: ${s.buffer_after_min}m`}</div>
  <div className="actions"><Button variant="secondary" small data-react-action="edit-service" data-id={s.id} onClick={onEdit} disabled={disabled}>{editIcon} Editar</Button><Button variant={s.active?'danger':'secondary'} small data-react-action="toggle-service" data-id={s.id} data-active={s.active?0:1} onClick={onToggle} disabled={disabled}>{s.active?'Ocultar':'Publicar'}</Button></div>
 </Card>;
}
