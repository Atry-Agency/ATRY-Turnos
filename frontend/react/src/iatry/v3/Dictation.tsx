import {useEffect,useRef,useState} from 'react';
interface RecognitionResult {isFinal:boolean;0:{transcript:string}}
interface Recognition {
 lang:string;continuous:boolean;interimResults:boolean;
 onresult:((event:{resultIndex:number;results:ArrayLike<RecognitionResult>})=>void)|null;
 onerror:((event:{error:string})=>void)|null;onend:(()=>void)|null;
 start:()=>void;stop:()=>void;abort:()=>void;
}
type SpeechWindow=Window&{SpeechRecognition?:new()=>Recognition;webkitSpeechRecognition?:new()=>Recognition};
/** Browser opt-in dictation. Produces editable text only; never submits or confirms. */
export function Dictation({locale,onText,onError,disabled=false}:{locale:string;onText:(text:string)=>void;onError?:(message:string)=>void;disabled?:boolean}){
 const recognition=useRef<Recognition|null>(null),callback=useRef(onText),errorCallback=useRef(onError),[listening,setListening]=useState(false),[message,setMessage]=useState('');callback.current=onText;errorCallback.current=onError;
 const Constructor=(window as SpeechWindow).SpeechRecognition||(window as SpeechWindow).webkitSpeechRecognition;
 useEffect(()=>{setListening(false);setMessage('');return()=>{const active=recognition.current;if(active){active.onresult=null;active.onerror=null;active.onend=null;active.abort();recognition.current=null}}},[locale]);
 useEffect(()=>{if(disabled)recognition.current?.abort()},[disabled]);
 if(!Constructor)return null;
 function toggle(){
  if(listening){recognition.current?.stop();return}
  if(!Constructor)return;
  const active=new Constructor();recognition.current=active;active.lang=locale;active.continuous=false;active.interimResults=false;
  active.onresult=event=>{for(let i=event.resultIndex;i<event.results.length;i++)if(event.results[i].isFinal)callback.current(event.results[i][0].transcript)};
  active.onerror=event=>{const error=event.error==='not-allowed'?'El micrófono no está permitido. Podés seguir escribiendo.':'No pude transcribir la voz. Podés volver a dictar o escribir.';setMessage(error);errorCallback.current?.(error)};
  active.onend=()=>{setListening(false);if(recognition.current===active)recognition.current=null};
  try{active.start();setListening(true);setMessage('El navegador procesa tu voz. Revisá el texto antes de enviarlo.')}catch{setListening(false);setMessage('El dictado no está disponible. Podés seguir escribiendo.');errorCallback.current?.('El dictado no está disponible. Podés seguir escribiendo.')}
 }
 return <><button type="button" className="iatry-dictation" aria-label={listening?'Terminar dictado':'Dictar mensaje'} aria-pressed={listening} disabled={disabled} onClick={toggle}><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3m-4 0h8"/></svg></button>{message&&<span className="sr-only" role="status">{message}</span>}</>;
}
