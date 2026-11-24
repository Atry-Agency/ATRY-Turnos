import {useEffect} from 'react';
export interface DestinationFocus {route:string;businessId:string;id:string}
/** Waits for a lazy destination, then focuses its existing section. Never crosses businesses. */
export function useDestinationFocus(request:DestinationFocus|null,route:string,businessId?:string){
 useEffect(()=>{
  if(!request||request.route!==route||request.businessId!==businessId)return;
  let frame=0,finished=false;
  const observer=new MutationObserver(()=>schedule());
  function locate(){
   if(finished)return;
   const node=document.getElementById(request!.id);
   if(!node||!node.getClientRects().length||node.closest('[inert]'))return;
   finished=true;observer.disconnect();node.focus({preventScroll:true});node.scrollIntoView({block:'start',behavior:'instant'});
  }
  function schedule(){cancelAnimationFrame(frame);frame=requestAnimationFrame(locate)}
  observer.observe(document.getElementById('root')||document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['inert']});schedule();
  return()=>{finished=true;cancelAnimationFrame(frame);observer.disconnect()};
 },[request,route,businessId]);
}
