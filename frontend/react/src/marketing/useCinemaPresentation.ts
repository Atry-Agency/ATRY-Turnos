import {useEffect,useRef,useState} from 'react';
import type {RefObject} from 'react';
const clamp=(value:number)=>Math.max(0,Math.min(.9999,value));
/** Local narrative clock. It never scrolls the document or executes product actions. */
export function useCinemaPresentation(section:RefObject<HTMLElement|null>,motionOff:boolean){
 const [progress,setProgress]=useState(0),[playing,setPlaying]=useState(false),[presentationPaused,setPresentationPaused]=useState(false),[reading,setReading]=useState(false);
 const manualTarget=useRef(0),drainTimer=useRef<ReturnType<typeof setTimeout>|null>(null),directUntil=useRef(0);
 const current=useRef(0),raw=useRef(0),offset=useRef(0),idleSince=useRef(performance.now()),nextAt=useRef(0),active=useRef(false),engaged=useRef(false),finished=useRef(false),suspended=useRef(presentationPaused),motion=useRef(motionOff);
 motion.current=motionOff;suspended.current=presentationPaused;
 const show=(value:number)=>{current.current=clamp(value);setProgress(current.current)};
 useEffect(()=>{
  const stop=()=>{active.current=false;setPlaying(false);idleSince.current=performance.now()};
  const input=(event:Event)=>{if(drainTimer.current){clearTimeout(drainTimer.current);drainTimer.current=null;offset.current=current.current-raw.current;manualTarget.current=current.current}stop();const target=event.target;if(target instanceof Element&&target.closest('.iatry-cinema-scroll')){engaged.current=true;setReading(true)}};
  const drain=()=>{drainTimer.current=null;const el=section.current;if(!el)return;const box=el.getBoundingClientRect(),from=Math.floor(current.current*7),to=Math.floor(manualTarget.current*7);if(box.top>2||box.bottom<innerHeight-2||motion.current||Math.abs(to-from)<=1){show(manualTarget.current);return}show((from+Math.sign(to-from)+.1)/7);idleSince.current=performance.now();drainTimer.current=setTimeout(drain,750)};
  const update=()=>{const el=section.current;if(!el)return;const r=el.getBoundingClientRect();raw.current=clamp(-r.top/Math.max(1,r.height-innerHeight));manualTarget.current=clamp(raw.current+offset.current);if(performance.now()<directUntil.current||motion.current||r.top>2||r.bottom<innerHeight-2){if(drainTimer.current)clearTimeout(drainTimer.current);drainTimer.current=null;show(manualTarget.current);return}if(drainTimer.current)return;const from=Math.floor(current.current*7),to=Math.floor(manualTarget.current*7);if(Math.abs(to-from)>1){show((from+Math.sign(to-from)+.1)/7);drainTimer.current=setTimeout(drain,750)}else show(manualTarget.current)};
  let frame=0;const scroll=()=>{stop();if(!frame)frame=requestAnimationFrame(()=>{frame=0;update()})};
  const visibility=()=>{stop()};
  const timer=setInterval(()=>{
   const el=section.current,now=performance.now();if(!el)return;const box=el.getBoundingClientRect(),chapter=Math.floor(current.current*7),focused=document.activeElement instanceof Element&&Boolean(document.activeElement.closest('#iatry .iatry-cinema-scroll'));
   if(drainTimer.current||document.hidden||motion.current||suspended.current||engaged.current||focused||chapter===5||finished.current||box.top>2||box.bottom<innerHeight-2){if(active.current){active.current=false;setPlaying(false)}idleSince.current=now;return}
   if(!active.current){if(now-idleSince.current<6000)return;active.current=true;setPlaying(true);nextAt.current=now+1200;return}
   if(now<nextAt.current)return;
   const phase=Math.min(4,Math.floor((current.current*7-chapter)*5));
   const next=phase<4?(chapter+(phase+1)/5+.015)/7:chapter===4?6.02/7:(chapter+1.015)/7;
   show(next);offset.current=current.current-raw.current;nextAt.current=now+(phase===1||phase===2?2200:1400);
   if(Math.floor(current.current*7)===6){finished.current=true;active.current=false;setPlaying(false)}
  },200);
  for(const name of ['wheel','touchstart','pointerdown','keydown'])window.addEventListener(name,input,{passive:true,capture:true});
  window.addEventListener('scroll',scroll,{passive:true});window.addEventListener('resize',update);document.addEventListener('visibilitychange',visibility);update();
  return()=>{clearInterval(timer);if(drainTimer.current)clearTimeout(drainTimer.current);cancelAnimationFrame(frame);for(const name of ['wheel','touchstart','pointerdown','keydown'])window.removeEventListener(name,input,true);window.removeEventListener('scroll',scroll);window.removeEventListener('resize',update);document.removeEventListener('visibilitychange',visibility)};
 },[section]);
 function selectChapter(index:number){if(drainTimer.current)clearTimeout(drainTimer.current);drainTimer.current=null;directUntil.current=performance.now()+1800;offset.current=0;engaged.current=false;setReading(false);finished.current=false;active.current=false;setPlaying(false);idleSince.current=performance.now();show((index+.12)/7)}
 function togglePresentation(){const pause=!presentationPaused;setPresentationPaused(pause);suspended.current=pause;active.current=false;setPlaying(false);idleSince.current=performance.now();if(!pause){engaged.current=false;setReading(false);finished.current=false}}
 return {progress,playing,presentationPaused,reading,selectChapter,togglePresentation};
}
