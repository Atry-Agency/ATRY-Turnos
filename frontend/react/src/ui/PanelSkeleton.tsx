/** Internal screen placeholders only. The branded application boot remains independent. */
export function PanelSkeleton({label='Cargando contenido…',variant='list'}:{label?:string;variant?:'list'|'grid'|'form'|'agenda'}){
 return <div className={'panel-loading panel-loading--'+variant} role="status" aria-busy="true" aria-atomic="true"><span className="sr-only">{label}</span><div className="panel-loading-heading" aria-hidden="true"><i className="panel-placeholder"/><i className="panel-placeholder"/></div><div className="panel-loading-body" aria-hidden="true">{Array.from({length:variant==='agenda'?5:3},(_,i)=><div className="panel-loading-item" key={i}><i className="panel-placeholder"/><i className="panel-placeholder"/><i className="panel-placeholder"/></div>)}</div></div>
}
export function BusyMark(){return <span className="panel-busy-mark" aria-hidden="true"><i/><i/></span>}
