import {flushSync} from 'react-dom';
import './sidebar-motion.css';
interface Selection{root:HTMLElement;aside:HTMLElement;link:HTMLElement;rect:DOMRect;bounds:DOMRect;realm:string;scroll:number;content:HTMLElement|null}
interface Flight{realm:string;visual:HTMLElement;cancel:()=>void}
let flight:Flight|undefined;
function selection():Selection|undefined{
 const root=document.querySelector<HTMLElement>('#root .app-shell,#root .cc-shell');if(!root)return;
 const aside=root.querySelector<HTMLElement>(':scope > .sidebar'),link=aside?.querySelector<HTMLElement>('.navlink.active,.settings-toggle.is-current,nav a[aria-current=page]');if(!aside||!link)return;
 return{root,aside,link,rect:link.getBoundingClientRect(),bounds:aside.getBoundingClientRect(),realm:root.classList.contains('cc-shell')?'admin':'business:'+root.dataset.businessId,scroll:aside.scrollTop,content:root.querySelector<HTMLElement>('.main-content,#cc-content')};
}
const onScreen=(r:DOMRect,b:DOMRect)=>r.height>0&&r.bottom>b.top&&r.top<b.bottom;
/** Called only after the existing navigation/dirty-operation guards approve the route. */
export function navigateWithSidebarMotion(update:()=>void){
 const continuing=flight?{realm:flight.realm,rect:flight.visual.getBoundingClientRect()}:undefined;flight?.cancel();
 const before=selection(),focused=Boolean(before?.aside.contains(document.activeElement));flushSync(update);let after=selection();
 if(!before||!after||before.realm!==after.realm)return;
 // Keyed admin screens remount their sidebar; retain its independent scroll position.
 after.aside.scrollTop=before.scroll;after=selection();if(!after)return;
 const desktop=matchMedia('(min-width:1001px)').matches;
 if(focused){if(desktop)after.link.focus({preventScroll:true});else{const heading=after.root.querySelector<HTMLElement>('main h1');if(heading){heading.tabIndex=-1;heading.focus({preventScroll:true})}else after.root.querySelector<HTMLElement>('.mobile-menu,.cc-menu-toggle')?.focus({preventScroll:true})}}
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');if(reduced.matches||!desktop||typeof after.link.animate!=='function')return;
 const content=after.content?.animate([{opacity:.78,transform:'translateY(3px)'},{opacity:1,transform:'none'}],{duration:180,easing:'cubic-bezier(.2,.7,.2,1)'});
 const from=continuing?.realm===after.realm?continuing.rect:before.rect,to=after.rect;
 if(!onScreen(from,before.bounds)||!onScreen(to,after.bounds))return;
 if(Math.abs(from.top-to.top)<.5&&Math.abs(from.left-to.left)<.5&&Math.abs(from.width-to.width)<.5&&Math.abs(from.height-to.height)<.5)return;
 const stage=document.createElement('div');stage.className='sidebar-motion-stage';stage.inert=true;stage.setAttribute('aria-hidden','true');
 const shell=document.createElement('div');shell.className=after.root.className;shell.style.cssText='position:absolute;inset:0;display:block;min-height:0;margin:0;padding:0;background:transparent;';
 const aside=document.createElement('aside');aside.className=after.aside.className;aside.dataset.sidebarMotionGhost='true';
 aside.style.cssText=`position:absolute;left:${after.bounds.left}px;top:${after.bounds.top}px;width:${after.bounds.width}px;height:${after.bounds.height}px;min-height:0;margin:0;padding:0;border:0;background:transparent;overflow:visible;transform:none;box-shadow:none;`;
 // Clip to the existing sidebar, including its curved connection, never over the content.
 stage.style.clipPath=`inset(${Math.max(0,after.bounds.top)}px ${Math.max(0,innerWidth-after.bounds.right)}px ${Math.max(0,innerHeight-after.bounds.bottom)}px ${Math.max(0,after.bounds.left)}px)`;
 const nav=document.createElement('nav');nav.style.cssText='position:absolute;inset:0;display:block;margin:0;padding:0;';
 const copy=after.link.cloneNode(true) as HTMLElement;for(const element of [copy,...copy.querySelectorAll<HTMLElement>('[id]')])element.removeAttribute('id');copy.tabIndex=-1;copy.removeAttribute('data-sidebar-motion-target');
 after.link.dataset.sidebarMotionTarget='true';const departing=before.link.isConnected&&before.link!==after.link?before.link:undefined;if(departing)departing.dataset.sidebarMotionDeparting='true';
 const style=getComputedStyle(after.link);copy.style.cssText=`position:absolute;left:0;top:0;margin:0;width:${from.width}px;height:${from.height}px;min-height:0;box-sizing:border-box;visibility:visible;opacity:1;transform-origin:0 0;transition:none;view-transition-name:none;`;
 copy.style.color=style.color;copy.style.outline=style.outline;copy.style.outlineOffset=style.outlineOffset;
 const main=after.root.querySelector<HTMLElement>(':scope > .main,:scope > .cc-main'),surface=main&&getComputedStyle(main).backgroundColor;
 if(surface&&surface!=='rgba(0, 0, 0, 0)')shell.style.setProperty('--sidebar-selection-surface',surface);
 nav.append(copy);aside.append(nav);shell.append(aside);stage.append(shell);document.body.append(stage);after.link.dataset.sidebarMotionTarget='true';
 const target=after.link,animation=copy.animate([
  {transform:`translate3d(${from.left-after.bounds.left}px,${from.top-after.bounds.top}px,0)`,width:from.width+'px',height:from.height+'px'},
  {transform:`translate3d(${to.left-after.bounds.left}px,${to.top-after.bounds.top}px,0)`,width:to.width+'px',height:to.height+'px'}
 ],{duration:220,easing:'cubic-bezier(.22,.7,.25,1)',fill:'both'});
 let finished=false;const cancel=()=>{if(finished)return;finished=true;animation.cancel();content?.cancel();stage.remove();delete target.dataset.sidebarMotionTarget;if(departing)delete departing.dataset.sidebarMotionDeparting;window.removeEventListener('resize',cancel);after!.aside.removeEventListener('scroll',cancel);reduced.removeEventListener('change',cancel);if(flight?.cancel===cancel)flight=undefined;};
 flight={realm:after.realm,visual:copy,cancel};window.addEventListener('resize',cancel,{once:true});after.aside.addEventListener('scroll',cancel,{once:true});reduced.addEventListener('change',cancel,{once:true});void animation.finished.then(cancel,cancel);
}
