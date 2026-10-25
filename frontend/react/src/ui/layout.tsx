import type {ReactNode} from 'react';
import type {FeaturePort} from '../services/contracts';
import {Icon} from './Icon';
import {statusLabels} from '../domain/format';
export function PageHeader({title,subtitle,children}:{title:string;subtitle:string;children?:ReactNode}){return <div className="page-header"><div><span className="eyebrow">ATRY TURNOS / PANEL</span><h1>{title}</h1><p>{subtitle}</p></div>{children}</div>}
export function Empty({children,port,icon='calendar'}:{children:ReactNode;port:FeaturePort;icon?:string}){return <div className="empty"><Icon name={icon} port={port} className="big"/><div>{children}</div></div>}
export function StatusBadge({status}:{status:string}){return <span className={'badge '+status}>{statusLabels[status]||'Estado sin identificar'}</span>}
