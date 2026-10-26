import {useEffect,useState} from 'react';
export function useMotionPreference(){
 const [reduced,setReduced]=useState(()=>matchMedia('(prefers-reduced-motion: reduce)').matches);
 useEffect(()=>{const query=matchMedia('(prefers-reduced-motion: reduce)'),change=()=>setReduced(query.matches);query.addEventListener('change',change);change();return()=>query.removeEventListener('change',change)},[]);
 return reduced;
}
