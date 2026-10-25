import type {Booking,Rules,BookingContext} from '../agenda/model';
import {Calendar as CalendarCore} from '../agenda/core';
import {scopedApi} from '../infrastructure/scoped-api';
import {parseInfo} from '../communications/contracts';
import {Button} from '../ui/primitives';
import {Icon} from '../ui/Icon';
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
const BusinessSettings=lazy(()=>import('../settings/SettingsScreen').then(m=>({default:m.SettingsScreen})));
const Account=lazy(()=>import('../account/AccountScreen').then(m=>({default:m.AccountScreen})));
const NewBusiness=lazy(()=>import('../account/NewBusiness').then(m=>({default:m.NewBusiness})));
const Agenda=lazy(()=>import('../agenda/AgendaScreen').then(m=>({default:m.AgendaScreen})));
const TimeFinder=lazy(()=>import('../agenda/TimeFinder').then(m=>({default:m.TimeFinder})));
const BookingDetail=lazy(()=>import('../agenda/BookingDetail').then(m=>({default:m.BookingDetail})));
const Reschedule=lazy(()=>import('../agenda/Reschedule').then(m=>({default:m.Reschedule})));
const PrivateVisit=lazy(()=>import('../visits/PrivateVisit').then(m=>({default:m.PrivateVisit})));
const CustomerProfile=lazy(()=>import('../customers/CustomerProfile').then(m=>({default:m.CustomerProfile})));
// Keep this primary destination synchronous: a cold lazy import triggers the
// Suspense fallback throttle (~300 ms), even when the catalog is already cached.
import {ServicesScreen as Services} from '../services/ServicesScreen';
const Customers=lazy(()=>import('../customers/CustomersScreen').then(m=>({default:m.CustomersScreen})));
const ManualBooking=lazy(()=>import('../bookings/ManualBooking').then(m=>({default:m.ManualBooking})));
const RecurringEditor=lazy(()=>import('../recurring/RecurringEditor').then(m=>({default:m.RecurringEditor})));
const Composer=lazy(()=>import('../communications/WhatsAppComposer').then(m=>({default:m.WhatsAppComposer})));
const Communications=lazy(()=>import('../communications/WhatsAppScreen').then(m=>({default:m.WhatsAppScreen})));
const Insights=lazy(()=>import('../statistics/InsightsScreen').then(m=>({default:m.InsightsScreen})));
const Settings=lazy(()=>import('../communications/WhatsAppSettings').then(m=>({default:m.WhatsAppSettings})));
import {DashboardScreen as Dashboard} from '../dashboard/DashboardScreen';
const Recurring=lazy(()=>import('../recurring/RecurringScreen').then(m=>({default:m.RecurringScreen})));
const EndRecurring=lazy(()=>import('../recurring/EndRecurring').then(m=>({default:m.EndRecurring})));
const Waitlist=lazy(()=>import('../waitlist/WaitlistScreen').then(m=>({default:m.WaitlistScreen})));
const Statistics=lazy(()=>import('../statistics/BasicStatistics').then(m=>({default:m.BasicStatistics})));
const Slots=lazy(()=>import('../statistics/SmartSlots').then(m=>({default:m.SmartSlots})));
export type {NativeView} from './routes';
type Overlay={kind:'booking-detail';booking:Booking;rules:Rules|null}|{kind:'reschedule';booking:Booking}|{kind:'finder'}|{kind:'visit';id:string}|{kind:'customer-profile';id:string}|{kind:'new-business'}|{kind:'plan-request';plan:Plan;tax:string}|{kind:'staff';people?:TeamPerson[];photos:PhotoRepository;services:TeamService[];person?:TeamPerson;photoOnly?:boolean}|{kind:'member';staff:Person[];member?:Member;direct?:boolean}|{kind:'weekly';staff:{id:string;name:string}}|{kind:'rule';rule:RuleKind;staffId?:string;staff:{id:string;name:string;active:number|boolean}[];resource?:Resource}|{kind:'booking';customer?:Customer;context?:BookingContext;agenda?:boolean}|{kind:'recurring';customer?:Customer;row?:RecurringRecord}|{kind:'end-recurring';row:RecurringRecord}|{kind:'whatsapp';customer?:Customer;bookingId?:string;messageKind?:string}|{kind:'whatsapp-settings'}|null;
export function FeatureHost({view,port,scope,control}:{view:NativeView;port:AppPort;scope:Scope;control:(value:ScreenController|null)=>void}){
 const [overlay,setOverlay]=useState<Overlay>(null),[requestEditor,setRequestEditor]=useState<{customer:Customer;nonce:number}|undefined>();const [offer,setOffer]=useState<{id:string;kind:string}|null>(null),live=useRef(true),refreshPending=useRef(false);const pageController=useRef<ScreenController|null>(null),dialogController=useRef<ScreenController|null>(null),counter=useRef(0);
 useEffect(()=>{live.current=true;control({canRefresh:()=>!dialogController.current&&(pageController.current?.canRefresh?.()??true),reload:()=>{if(dialogController.current||pageController.current?.canRefresh?.()===false)refreshPending.current=true;else return pageController.current?.reload()},beforeLeave:async()=>{if(dialogController.current&&!await dialogController.current.beforeLeave())return false;return pageController.current?.beforeLeave()||true}});return()=>{live.current=false;control(null)}},[]);
 const close=()=>{setOverlay(null);if(refreshPending.current&&pageController.current?.canRefresh?.()!==false){refreshPending.current=false;pageController.current?.reload()}};
 async function savedOffer(id:string,kind?:string){close();pageController.current?.reload();if(!kind)return;const api=scopedApi(port,scope,{allowStaff:true});try{const info=await api.read('/whatsapp',parseInfo);if(live.current&&info.config.enabled)setOffer({id,kind})}catch{}finally{api.dispose()}}
 const phone=(customer:Customer)=>{if(view==='clientes'){setOverlay(null);setRequestEditor({customer,nonce:++counter.current})}else setOverlay({kind:'customer-profile',id:customer.id})};
 const pageControl=(next:ScreenController|null)=>{pageController.current=next};
 const common={port,scope,control:(next:ScreenController|null)=>{dialogController.current=next},onClose:close};
 return <Suspense fallback={<Feedback>Cargando pantalla…</Feedback>}>
 {offer&&<section className="hint-block wa-offer" role="status"><span>El cambio ya está guardado.</span><Button type="button" variant="secondary" small onClick={()=>setOverlay({kind:'whatsapp',bookingId:offer.id,messageKind:offer.kind})}><Icon name="whatsapp" port={port}/> Avisar al cliente</Button><Button type="button" variant="secondary" small className="icon-only" aria-label="Cerrar aviso" onClick={()=>setOffer(null)}><Icon name="x" port={port}/></Button></section>}
 {view==='agenda'?<Agenda port={port} scope={scope} control={pageControl} onBooking={context=>setOverlay({kind:'booking',agenda:true,context})} onFind={()=>setOverlay({kind:'finder'})} onDetail={(booking,rules)=>setOverlay({kind:'booking-detail',booking,rules})}/>:view==='cuenta'?<Account port={port} control={pageControl} onNewBusiness={()=>setOverlay({kind:'new-business'})}/>:view==='configuracion'?<BusinessSettings port={port} scope={scope} control={pageControl}/>:view==='suscripcion'?<Subscription port={port} scope={scope} control={pageControl} onSelect={(plan,tax)=>setOverlay({kind:'plan-request',plan,tax})}/>:view==='equipo'?<Team port={port} scope={scope} control={pageControl} onEdit={(photos,services,person,photoOnly,people)=>setOverlay({kind:'staff',photos,services,person,photoOnly,people})} onWeek={staff=>setOverlay({kind:'weekly',staff})} onAbsence={(staff,staffId)=>setOverlay({kind:'rule',rule:'absence',staff,staffId})} onLink={staff=>setOverlay({kind:'member',staff,direct:true})}/>:view==='accesos'?<Access port={port} scope={scope} control={pageControl} onEdit={(staff,member)=>setOverlay({kind:'member',staff,member})}/>:view==='soporte'?<Support port={port} scope={scope} control={pageControl}/>:view==='mi-horario'?<OwnHours port={port} scope={scope} control={pageControl} onWeek={staff=>setOverlay({kind:'weekly',staff})}/>:view==='disponibilidad'?<Schedule port={port} scope={scope} control={pageControl} onWeek={staff=>setOverlay({kind:'weekly',staff})} onRule={(rule,staff,resource)=>setOverlay({kind:'rule',rule,staff,resource})}/>:view==='notificaciones'?<Notifications port={port} scope={scope} control={pageControl}/>:view==='configuracion-inicial'?<Onboarding port={port} scope={scope} control={pageControl}/>:view==='servicios'?<Services port={port} scope={scope} control={pageControl}/>:view==='inicio'?<Dashboard port={port} scope={scope} control={pageControl} onBooking={()=>setOverlay({kind:'booking'})}/>:view==='turnos-fijos'?<Recurring port={port} scope={scope} control={pageControl} onEdit={row=>setOverlay({kind:'recurring',row})} onEnd={row=>setOverlay({kind:'end-recurring',row})}/>:view==='lista-espera'?<Waitlist port={port} scope={scope} control={pageControl}/>:view==='estadisticas'?<Statistics port={port} scope={scope} control={pageControl}/>:view==='smartslots'?<Slots port={port} scope={scope} control={pageControl}/>:view==='comunicacion'?<Communications port={port} scope={scope} control={pageControl} onSettings={()=>setOverlay({kind:'whatsapp-settings'})} onCompose={bookingId=>setOverlay({kind:'whatsapp',bookingId,messageKind:'reminder'})}/>:view==='insights'?<Insights port={port} scope={scope} control={pageControl}/>:<Customers port={port} scope={scope} requestEditor={requestEditor} control={next=>{pageController.current=next}} actions={{booking:customer=>setOverlay({kind:'booking',customer}),recurring:customer=>setOverlay({kind:'recurring',customer}),whatsapp:customer=>setOverlay({kind:'whatsapp',customer}),phoneState:value=>{try{return {number:port.whatsapp().phone(value),error:value?'':'Sin teléfono registrado'}}catch{return {number:'',error:'El teléfono registrado no tiene un formato válido'}}},canExport:port.capability('exports'),canRecurring:port.capability('recurring'),publish:rows=>port.publishCustomers?.(rows)}}/>}
 {overlay&&<Suspense fallback={<Feedback>Preparando formulario…</Feedback>}>
 {overlay.kind==='booking-detail'?<BookingDetail {...common} booking={overlay.booking} rules={overlay.rules} onChanged={kind=>void savedOffer(overlay.booking.id,kind)} onReschedule={()=>setOverlay({kind:'reschedule',booking:overlay.booking})} onWhatsApp={()=>setOverlay({kind:'whatsapp',bookingId:overlay.booking.id})} onPhone={id=>setOverlay({kind:'customer-profile',id})} onVisit={id=>setOverlay({kind:'visit',id})}/>:overlay.kind==='reschedule'?<Reschedule {...common} booking={overlay.booking} onSaved={()=>void savedOffer(overlay.booking.id,'reschedule')}/>:overlay.kind==='finder'?<TimeFinder {...common} onChoose={(slot,service)=>{const when=CalendarCore.parts(slot.start||slot.starts_at!,port.business().timezone||'America/Montevideo');port.agendaPreferences({date:when.day,mobileDate:when.day,mobileStaff:slot.staff_id,attention:false});setOverlay({kind:'booking',agenda:true,context:{date:when.day,time:CalendarCore.clock(when.minute),staff:slot.staff_id,service}})}}/>:overlay.kind==='visit'?<PrivateVisit {...common} id={overlay.id} onClose={()=>{close();pageController.current?.reload()}}/>:overlay.kind==='customer-profile'?<CustomerProfile {...common} customerId={overlay.id} onSaved={()=>{close();pageController.current?.reload()}} onWhatsApp={customer=>setOverlay({kind:'whatsapp',customer})}/>:overlay.kind==='new-business'?<NewBusiness port={port} control={common.control} onClose={close}/>:overlay.kind==='plan-request'?<RequestEditor {...common} plan={overlay.plan} tax={overlay.tax} onSaved={()=>{close();pageController.current?.reload()}}/>:overlay.kind==='staff'?<StaffEditor {...common} photos={overlay.photos} services={overlay.services} person={overlay.person} people={overlay.people} photoOnly={overlay.photoOnly} onSaved={()=>{close();pageController.current?.reload()}}/>:overlay.kind==='member'?<MemberEditor {...common} staff={overlay.staff} member={overlay.member} direct={overlay.direct} onSaved={permissions=>{close();if(permissions)void port.refreshPermissions();else return pageController.current?.reload()}}/>:overlay.kind==='weekly'?<Weekly {...common} staff={overlay.staff} onSaved={()=>{close();pageController.current?.reload()}}/>:overlay.kind==='rule'?<Rule {...common} kind={overlay.rule} staff={overlay.staff} staffId={overlay.staffId} resource={overlay.resource} onSaved={()=>{close();pageController.current?.reload()}}/>:overlay.kind==='booking'?<ManualBooking {...common} customer={overlay.customer} context={overlay.context} agenda={overlay.agenda} onSaved={date=>{close();port.goAgenda(date);if(view==='agenda')pageController.current?.reload()}}/>:overlay.kind==='recurring'?<RecurringEditor {...common} customer={overlay.customer} row={overlay.row} onSaved={()=>{close();if(view==='turnos-fijos')pageController.current?.reload();else port.navigate('/app/turnos-fijos')}}/>:overlay.kind==='end-recurring'?<EndRecurring {...common} row={overlay.row} onSaved={()=>{setOverlay(null);pageController.current?.reload()}}/>:overlay.kind==='whatsapp'?<Composer {...common} customerId={overlay.customer?.id} bookingId={overlay.bookingId} kind={overlay.messageKind} onSettings={()=>setOverlay({kind:'whatsapp-settings'})} onPhone={phone}/>:<Settings {...common} onSaved={()=>{setOverlay(null);pageController.current?.reload()}}/>}
 </Suspense>}
 </Suspense>;
}
