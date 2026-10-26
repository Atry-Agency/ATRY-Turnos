import {useEffect,useRef,useState} from 'react';
/** Static official asset over compositor-only currents. No canvas, filters or rotating gradient. */
export function LiquidAvatar(){
 const ref=useRef<HTMLSpanElement>(null),[visible,setVisible]=useState(false);
 useEffect(()=>{let intersects=false;const update=()=>setVisible(intersects&&!document.hidden),observer=new IntersectionObserver(entries=>{intersects=Boolean(entries[0]?.isIntersecting);update()});if(ref.current)observer.observe(ref.current);document.addEventListener('visibilitychange',update);return()=>{observer.disconnect();document.removeEventListener('visibilitychange',update)}},[]);
 return <span ref={ref} className="iatry-avatar iatry-liquid" data-energy-visible={visible} aria-hidden="true"><span className="iatry-liquid-halo"/><span className="iatry-liquid-basin"><span className="iatry-current iatry-current-a"/><span className="iatry-current iatry-current-b"/><span className="iatry-current iatry-current-c"/><span className="iatry-liquid-reflection"/><span className="iatry-liquid-wave"/></span><img className="iatry-liquid-emblem" src="./assets/brand/atry.png" width={58} height={58} alt=""/></span>
}
