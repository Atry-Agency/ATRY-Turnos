import {useContext,type ReactNode} from 'react';
import {IatryContext} from '../context';
import type {IatryDestination} from '../navigation';
export function GuidanceLink({destination,children,primary=false,className=''}:{destination:IatryDestination;children:ReactNode;primary?:boolean;className?:string}){
 const bindings=useContext(IatryContext);
 return <a className={'btn sm '+(primary?'':'secondary ')+className} href={'#'+destination.route} onClick={event=>{if(!bindings?.visit||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;event.preventDefault();void bindings.visit(destination)}}>{children}</a>;
}
