import {lazy,Suspense,useEffect,useRef,useState} from 'react';
import {Feedback} from '../ui/primitives';
import type {AppPort} from './port';
import type {Scope} from '../services/contracts';
import type {ScreenController} from '../services/ServicesScreen';
import type {RecurringRecord} from '../recurring/model';
import {type NativeView} from './routes';
import type {Plan} from '../subscription/contracts';
import type {TeamPerson,TeamService} from '../team/contracts';
import type {PhotoRepository} from '../team/photos';
import type {Member,Person} from '../access/contracts';
import type {RuleKind,Resource} from '../scheduling/RuleEditor';
import type {Customer} from '../customers/contracts';
const Onboarding=lazy(()=>import('../onboarding/OnboardingScreen').then(m=>({default:m.OnboardingScreen})));
const Notifications=lazy(()=>import('../notifications/NotificationsScreen').then(m=>({default:m.NotificationsScreen})));
const Schedule=lazy(()=>import('../scheduling/ScheduleScreen').then(m=>({default:m.ScheduleScreen})));
const Weekly=lazy(()=>import('../scheduling/WeeklyEditor').then(m=>({default:m.WeeklyEditor})));
const Rule=lazy(()=>import('../scheduling/RuleEditor').then(m=>({default:m.RuleEditor})));
const OwnHours=lazy(()=>import('../scheduling/OwnHours').then(m=>({default:m.OwnHours})));
const Support=lazy(()=>import('./SupportScreen').then(m=>({default:m.SupportScreen})));
const Access=lazy(()=>import('../access/AccessScreen').then(m=>({default:m.AccessScreen})));
const MemberEditor=lazy(()=>import('../access/MemberEditor').then(m=>({default:m.MemberEditor})));
const Team=lazy(()=>import('../team/TeamScreen').then(m=>({default:m.TeamScreen})));
const StaffEditor=lazy(()=>import('../team/StaffEditor').then(m=>({default:m.StaffEditor})));
const Subscription=lazy(()=>import('../subscription/SubscriptionScreen').then(m=>({default:m.SubscriptionScreen})));
const RequestEditor=lazy(()=>import('../subscription/RequestEditor').then(m=>({default:m.RequestEditor})));
const Services=lazy(()=>import('../services/ServicesScreen').then(m=>({default:m.ServicesScreen})));
const Customers=lazy(()=>import('../customers/CustomersScreen').then(m=>({default:m.CustomersScreen})));
const ManualBooking=lazy(()=>import('../bookings/ManualBooking').then(m=>({default:m.ManualBooking})));
const RecurringEditor=lazy(()=>import('../recurring/RecurringEditor').then(m=>({default:m.RecurringEditor})));
const Composer=lazy(()=>import('../communications/WhatsAppComposer').then(m=>({default:m.WhatsAppComposer})));
const Communications=lazy(()=>import('../communications/WhatsAppScreen').then(m=>({default:m.WhatsAppScreen})));
const Insights=lazy(()=>import('../statistics/InsightsScreen').then(m=>({default:m.InsightsScreen})));
const Settings=lazy(()=>import('../communications/WhatsAppSettings').then(m=>({default:m.WhatsAppSettings})));
const Dashboard=lazy(()=>import('../dashboard/DashboardScreen').then(m=>({default:m.DashboardScreen})));
const Recurring=lazy(()=>import('../recurring/RecurringScreen').then(m=>({default:m.RecurringScreen})));
const EndRecurring=lazy(()=>import('../recurring/EndRecurring').then(m=>({default:m.EndRecurring})));
const Waitlist=lazy(()=>import('../waitlist/WaitlistScreen').then(m=>({default:m.WaitlistScreen})));
const Statistics=lazy(()=>import('../statistics/BasicStatistics').then(m=>({default:m.BasicStatistics})));
const Slots=lazy(()=>import('../statistics/SmartSlots').then(m=>({default:m.SmartSlots})));
export type {NativeView} from './routes';
type Overlay={kind:'plan-request';plan:Plan;tax:string}|{kind:'staff';photos:PhotoRepository;services:TeamService[];person?:TeamPerson;photoOnly?:boolean}|{kind:'member';staff:Person[];member?:Member;direct?:boolean}|{kind:'weekly';staff:{id:string;name:string}}|{kind:'rule';rule:RuleKind;staffId?:string;staff:{id:string;name:string;active:number|boolean}[];resource?:Resource}|{kind:'booking';customer?:Customer}|{kind:'recurring';customer?:Customer;row?:RecurringRecord}|{kind:'end-recurring';row:RecurringRecord}|{kind:'whatsapp';customer?:Customer;bookingId?:string;messageKind?:string}|{kind:'whatsapp-settings'}|null;
export function FeatureHost({view,port,scope,control}:{view:NativeView;port:AppPort;scope:Scope;control:(value:ScreenController|null)=>void}){
 const [overlay,setOverlay]=useState<Overlay>(null),[requestEditor,setRequestEditor]=useState<{customer:Customer;nonce:number}|undefined>();const pageController=useRef<ScreenController|null>(null),dialogController=useRef<ScreenController|null>(null),counter=useRef(0);
 useEffect(()=>{control({reload:()=>pageController.current?.reload(),beforeLeave:async()=>{if(dialogController.current&&!await dialogController.current.beforeLeave())return false;return pageController.current?.beforeLeave()||true}});return()=>control(null)},[]);
 const close=()=>setOverlay(null);
 const phone=(customer:Customer)=>{setOverlay(null);setRequestEditor({customer,nonce:++counter.current})};
 const pageControl=(next:ScreenController|null)=>{pageController.current=next};
 const common={port,scope,control:(next:ScreenController|null)=>{dialogController.current=next},onClose:close};
 return <Suspense fallback={<Feedback>Cargando pantalla…</Feedback>}>
 {view==='suscripcion'?<Subscription port={port} scope={scope} control={pageControl} onSelect={(plan,tax)=>setOverlay({kind:'plan-request',plan,tax})}/>:view==='equipo'?<Team port={port} scope={scope} control={pageControl} onEdit={(photos,services,person,photoOnly)=>setOverlay({kind:'staff',photos,services,person,photoOnly})} onWeek={staff=>setOverlay({kind:'weekly',staff})} onAbsence={(staff,staffId)=>setOverlay({kind:'rule',rule:'absence',staff,staffId})} onLink={staff=>setOverlay({kind:'member',staff,direct:true})}/>:view==='accesos'?<Access port={port} scope={scope} control={pageControl} onEdit={(staff,member)=>setOverlay({kind:'member',staff,member})}/>:view==='soporte'?<Support port={port} scope={scope} control={pageControl}/>:view==='mi-horario'?<OwnHours port={port} scope={scope} control={pageControl} onWeek={staff=>setOverlay({kind:'weekly',staff})}/>:view==='disponibilidad'?<Schedule port={port} scope={scope} control={pageControl} onWeek={staff=>setOverlay({kind:'weekly',staff})} onRule={(rule,staff,resource)=>setOverlay({kind:'rule',rule,staff,resource})}/>:view==='notificaciones'?<Notifications port={port} scope={scope} control={pageControl}/>:view==='configuracion-inicial'?<Onboarding port={port} scope={scope} control={pageControl}/>:view==='servicios'?<Services port={port} scope={scope} control={pageControl}/>:view==='inicio'?<Dashboard port={port} scope={scope} control={pageControl} onBooking={()=>setOverlay({kind:'booking'})}/>:view==='turnos-fijos'?<Recurring port={port} scope={scope} control={pageControl} onEdit={row=>setOverlay({kind:'recurring',row})} onEnd={row=>setOverlay({kind:'end-recurring',row})}/>:view==='lista-espera'?<Waitlist port={port} scope={scope} control={pageControl}/>:view==='estadisticas'?<Statistics port={port} scope={scope} control={pageControl}/>:view==='smartslots'?<Slots port={port} scope={scope} control={pageControl}/>:view==='comunicacion'?<Communications port={port} scope={scope} control={pageControl} onSettings={()=>setOverlay({kind:'whatsapp-settings'})} onCompose={bookingId=>setOverlay({kind:'whatsapp',bookingId,messageKind:'reminder'})}/>:view==='insights'?<Insights port={port} scope={scope} control={pageControl}/>:<Customers port={port} scope={scope} requestEditor={requestEditor} control={next=>{pageController.current=next}} actions={{booking:customer=>setOverlay({kind:'booking',customer}),recurring:customer=>setOverlay({kind:'recurring',customer}),whatsapp:customer=>setOverlay({kind:'whatsapp',customer}),phoneState:value=>{try{return {number:port.whatsapp().phone(value),error:value?'':'Sin teléfono registrado'}}catch{return {number:'',error:'El teléfono registrado no tiene un formato válido'}}},canExport:port.capability('exports'),canRecurring:port.capability('recurring'),publish:rows=>port.publishCustomers(rows)}}/>}
 {overlay&&<Suspense fallback={<Feedback>Preparando formulario…</Feedback>}>
 {overlay.kind==='plan-request'?<RequestEditor {...common} plan={overlay.plan} tax={overlay.tax} onSaved={()=>{close();pageController.current?.reload()}}/>:overlay.kind==='staff'?<StaffEditor {...common} photos={overlay.photos} services={overlay.services} person={overlay.person} photoOnly={overlay.photoOnly} onSaved={()=>{close();pageController.current?.reload()}}/>:overlay.kind==='member'?<MemberEditor {...common} staff={overlay.staff} member={overlay.member} direct={overlay.direct} onSaved={permissions=>{close();if(permissions)void port.refreshPermissions();else pageController.current?.reload()}}/>:overlay.kind==='weekly'?<Weekly {...common} staff={overlay.staff} onSaved={()=>{close();pageController.current?.reload()}}/>:overlay.kind==='rule'?<Rule {...common} kind={overlay.rule} staff={overlay.staff} staffId={overlay.staffId} resource={overlay.resource} onSaved={()=>{close();pageController.current?.reload()}}/>:overlay.kind==='booking'?<ManualBooking {...common} customer={overlay.customer} onSaved={date=>{setOverlay(null);port.goAgenda(date)}}/>:overlay.kind==='recurring'?<RecurringEditor {...common} customer={overlay.customer} row={overlay.row} onSaved={()=>{setOverlay(null);port.navigate('/app/turnos-fijos')}}/>:overlay.kind==='end-recurring'?<EndRecurring {...common} row={overlay.row} onSaved={()=>{setOverlay(null);pageController.current?.reload()}}/>:overlay.kind==='whatsapp'?<Composer {...common} customerId={overlay.customer?.id} bookingId={overlay.bookingId} kind={overlay.messageKind} onSettings={()=>setOverlay({kind:'whatsapp-settings'})} onPhone={phone}/>:<Settings {...common} onSaved={()=>{setOverlay(null);pageController.current?.reload()}}/>}
 </Suspense>}
 </Suspense>;
}
