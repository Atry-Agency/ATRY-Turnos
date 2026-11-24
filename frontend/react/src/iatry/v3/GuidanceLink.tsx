import {useContext,type ReactNode} from 'react';
import {IatryContext} from '../context';
import type {IatryDestination} from '../navigation';
export function GuidanceLink({destination,children}:{destination:IatryDestination;children:ReactNode}){
 const bindings=useContext(IatryContext);
 return <a className="btn secondary sm" href={'#'+destination.route} onClick={event=>{if(!bindings?.visit||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;event.preventDefault();void bindings.visit(destination)}}>{children}</a>;
}
