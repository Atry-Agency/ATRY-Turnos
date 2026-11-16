import {useId,useLayoutEffect,useRef,useState,type InputHTMLAttributes} from 'react';
import {fieldExample} from '../ui/field-examples';
import {TextField} from '../ui/primitives';
import {Icon} from '../ui/Icon';
import type {FeaturePort} from '../services/contracts';
import './credential-field.css';
/** Presentation only: native value, autocomplete, constraints and form payload remain unchanged. */
export function CredentialField({port,label,type,...props}:InputHTMLAttributes<HTMLInputElement>&{port:FeaturePort;label:string;type:'email'|'password'}){
 const id=useId(),input=useRef<HTMLInputElement>(null),[visible,setVisible]=useState(false),selection=useRef<[number|null,number|null]|null>(null),password=type==='password';
 useLayoutEffect(()=>{if(selection.current&&input.current){const [start,end]=selection.current;if(document.activeElement===input.current&&start!==null&&end!==null)input.current.setSelectionRange(start,end);selection.current=null}},[visible]);
 return <TextField {...props} placeholder={props.placeholder??fieldExample({...props,label,type})} id={id} inputRef={input} fieldClassName="auth-credential" label={label} type={password&&visible?'text':type} leadingIcon={<span className="auth-credential-icon"><Icon name={password?'lock':'mail'} port={port}/></span>} trailingAction={password?<button className="auth-password-toggle" type="button" aria-label={visible?'Ocultar contraseña':'Mostrar contraseña'} aria-pressed={visible} aria-controls={id} title={visible?'Ocultar contraseña':'Mostrar contraseña'} disabled={props.disabled||props.readOnly} onPointerDown={e=>{if(document.activeElement===input.current)e.preventDefault()}} onClick={()=>{selection.current=input.current?[input.current.selectionStart,input.current.selectionEnd]:null;setVisible(v=>!v)}}><Icon name={visible?'eye-open':'eye-off'} port={port}/></button>:undefined}/>;
}
