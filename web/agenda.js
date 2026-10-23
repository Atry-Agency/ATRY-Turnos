'use strict';
const agendaStatusNames={pending:'Pendiente',confirmed:'Confirmado',completed:'Completado',cancelled:'Cancelado',no_show:'No asistió'};
let agendaClockTimer=null;
const agendaZone=()=>state.business.timezone||'America/Montevideo';
const agendaDayTitle=d=>new Intl.DateTimeFormat('es-UY',{weekday:'short',day:'numeric',month:'short'}).format(new Date(d+'T12:00:00Z'));
function agendaStatus(status){return `<span class="ag-status ag-status--${esc(status)}"><span aria-hidden="true"></span>${esc(agendaStatusNames[status]||status)}</span>`;}
async function agendaRules(people){
 if(state.business.role==='staff')return {rules:null,error:false};
 try{const rules=await api(bapi('/scheduling'));if(!rules.hours)rules.hours=(await Promise.all(people.filter(s=>s.active).map(async s=>(await api(bapi('/staff/'+s.id+'/hours'))).map(h=>({...h,staff_id:s.id}))))).flat();if(!rules.time_off)rules.time_off=await api(bapi('/time-off'));return {rules,error:false};}catch{return {rules:null,error:true};}
}
function agendaMonth(bookings,range){
 const weekdays=['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];return `<div class="ag-month" aria-label="Calendario mensual"><div class="ag-month-weekdays">${weekdays.map(d=>`<span>${d}</span>`).join('')}</div><div class="ag-month-days">${Array.from({length:range.days},(_,i)=>{const d=plusDate(range.start,i),list=bookings.filter(a=>ATRY_AGENDA.segment(a,d,agendaZone())).sort((a,b)=>a.starts_at.localeCompare(b.starts_at));return `<button class="ag-month-day ${d===today()?'is-today':''} ${d.slice(0,7)!==state.dateAgenda.slice(0,7)?'is-outside':''}" data-action="agenda-open-day" data-date="${d}" aria-label="${esc(agendaDayTitle(d))}, ${list.length} turnos. Abrir agenda del día"><span class="ag-day-number">${Number(d.slice(8))}</span><span class="ag-month-count">${list.length?list.length+' '+(list.length===1?'turno':'turnos'):''}</span><span class="ag-month-preview">${list.slice(0,3).map(b=>`<span><i class="ag-state-dot ag-state-dot--${esc(b.status)}"></i><time>${hmLocal(b.starts_at)}</time> ${esc(b.customer_name)}</span>`).join('')}${list.length>3?`<small>+${list.length-3} más</small>`:''}</span><span class="ag-month-dots" aria-hidden="true">${list.slice(0,4).map(b=>`<i class="ag-state-dot ag-state-dot--${esc(b.status)}"></i>`).join('')}</span></button>`;}).join('')}</div></div>`;
}
function agendaEvent(item,bounds,compact){
 const a=item.booking,professional=(state.staffList||[]).find(p=>p.id===a.staff_id),professionalColor=/^#[0-9a-f]{6}$/i.test(professional?.color||'')?professional.color:'#4754E6',top=item.start-bounds.start,height=item.end-item.start,tone=ATRY_AGENDA.serviceTone(a.service_id),tiny=height<25;
 return `<button class="ag-event ag-tone-${tone} ag-event--${esc(a.status)} ${tiny?'ag-event--short':height<50?'ag-event--compact':''}" style="--event-top:${top};--event-duration:${height};--overlap-col:${item.column};--overlap-count:${item.columns}" data-action="agenda-detail" data-id="${esc(a.id)}" aria-label="${esc(a.customer_name)}, ${esc(a.service_name)}, ${hmLocal(a.starts_at)} a ${hmLocal(a.ends_at)}, ${esc(a.staff_name)}, ${esc(agendaStatusNames[a.status]||a.status)}" title="${esc(a.customer_name+' · '+a.service_name+' · '+hmLocal(a.starts_at)+'–'+hmLocal(a.ends_at)+' · '+(agendaStatusNames[a.status]||a.status))}"><span class="ag-event-top"><time>${hmLocal(a.starts_at)}<span>–${hmLocal(a.ends_at)}</span></time><i class="ag-professional-marker" style="background:${professionalColor}" title="Color de ${esc(a.staff_name)}"></i><i class="ag-state-dot ag-state-dot--${esc(a.status)}" aria-hidden="true"></i></span><strong>${esc(a.customer_name)}</strong><span class="ag-event-service">${esc(a.service_name)}</span>${compact?`<span class="ag-event-person">${esc(a.staff_name)}</span>`:''}${a.recurring_id?`<span class="ag-recurring-mark" title="Turno fijo · esta fecha" aria-label="Turno fijo">${ic('repeat')}</span>`:''}<span class="ag-event-status">${esc(agendaStatusNames[a.status]||a.status)}</span></button>`;
}
function agendaTimeGrid(bookings,people,rules,dates,{week=false,mobile=false}={}){
 const C=ATRY_AGENDA,zone=agendaZone(),bounds=C.bounds(bookings,rules,people.map(s=>s.id),dates,zone),duration=bounds.end-bounds.start;
 const lanes=week?dates.map(date=>({date,id:'',name:agendaDayTitle(date)})):people.map(p=>({date:dates[0],...p}));
 if(!lanes.length)return `<div class="ag-empty">${ic('calendar')}<strong>No hay profesionales para mostrar</strong><span>Revisá tu equipo o los filtros seleccionados.</span></div>`;
 const hourLabels=[];for(let m=bounds.start;m<bounds.end;m+=60)hourLabels.push(`<span style="top:${(m-bounds.start)/duration*100}%">${C.clock(m)}</span>`);
 const dayLanes=lanes.map(lane=>{
  const laneStaff=week?people:people.filter(p=>p.id===lane.id),events=bookings.filter(a=>laneStaff.some(s=>s.id===a.staff_id)),segments=C.layout(events,lane.date,zone),windows=laneStaff.map(p=>({person:p,windows:C.windows(rules,p.id,lane.date,zone)})),known=rules!==null;
  const work=windows.flatMap(({windows})=>windows||[]).map(w=>`<div class="ag-work-window" style="top:${(w.start-bounds.start)/duration*100}%;height:${(w.end-w.start)/duration*100}%"></div>`).join('');
  const blocks=[];if(!week&&known){for(const b of rules.breaks||[])if(b.staff_id===lane.id&&Number(b.weekday)===new Date(lane.date+'T12:00Z').getUTCDay())blocks.push({start:Number(b.start_min),end:Number(b.end_min),label:'Descanso'});for(const b of rules.time_off||[])if(b.staff_id===lane.id){const v=C.segment(b,lane.date,zone);if(v)blocks.push({...v,label:b.reason||'Ausencia'});}}
  const blocked=blocks.filter(b=>b.end>bounds.start&&b.start<bounds.end).map(b=>`<div class="ag-block" style="top:${(Math.max(bounds.start,b.start)-bounds.start)/duration*100}%;height:${(Math.min(bounds.end,b.end)-Math.max(bounds.start,b.start))/duration*100}%" title="${esc(b.label)}"><span>${esc(b.label)}</span></div>`).join('');
  const slots=[];const step=Math.max(15,Number(state.business.slot_step_min)||15);for(let m=Math.ceil(bounds.start/step)*step;m<bounds.end;m+=step){const inWork=!known||windows.some(w=>(w.windows||[]).some(h=>m>=h.start&&m<h.end));if(inWork&&subscriptionLive(state.business))slots.push(`<button class="ag-slot" tabindex="${slots.length?'-1':'0'}" style="top:${(m-bounds.start)/duration*100}%;height:${Math.min(step,bounds.end-m)/duration*100}%" data-action="agenda-slot" data-date="${lane.date}" data-time="${C.clock(m)}" data-staff="${week?'':esc(lane.id)}" aria-label="Proponer turno ${agendaDayTitle(lane.date)} a las ${C.clock(m)}${week?'':' con '+esc(lane.name)}" title="Crear turno · ${C.clock(m)}. Se validará la disponibilidad."><span>+ ${C.clock(m)}</span></button>`);}
  return `<div class="ag-lane ${known?'has-rules':''}" data-date="${lane.date}" style="height:calc(${duration} * var(--ag-minute))">${work}${slots.join('')}${blocked}${segments.map(v=>agendaEvent(v,bounds,week)).join('')}<div class="ag-now-line" data-day="${lane.date}" data-start="${bounds.start}" data-end="${bounds.end}" aria-hidden="true" hidden><span></span></div>${known&&windows.every(w=>!w.windows?.length)?'<span class="ag-closed-label">Sin atención disponible</span>':''}</div>`;
 }).join('');
 return `<div class="ag-grid-shell ${week?'ag-grid-week':'ag-grid-day'} ${mobile?'ag-week-mobile':''}"><div class="ag-grid-scroll" tabindex="0" aria-label="${week?'Semana':'Día'}: calendario por horas, desplazable"><div class="ag-grid-inner" style="--ag-lanes:${lanes.length};--ag-duration:${duration}"><div class="ag-grid-head"><span class="ag-corner">${esc(zone.split('/').pop().replaceAll('_',' '))}</span>${lanes.map(l=>`<div class="ag-lane-head ${(week?l.date===today():state.agendaStaff===l.id)?'is-today':''}">${week?`<button data-action="agenda-open-day" data-date="${l.date}">${`<span class="ag-head-weekday">${new Intl.DateTimeFormat('es-UY',{weekday:'short'}).format(new Date(l.date+'T12:00Z'))}</span><strong>${l.date.slice(8)}/${l.date.slice(5,7)}</strong>`}</button>`:`${typeof staffAvatar==='function'?staffAvatar(l,'ag-person-avatar'):`<span class="ag-person-avatar">${esc((l.name||'?').split(' ').map(x=>x[0]).slice(0,2).join(''))}</span>`}<span>${esc(l.name)}${l.active===0?'<small>Inactivo · historial</small>':''}</span>`}</div>`).join('')}</div><div class="ag-grid-body"><div class="ag-hours" style="height:calc(${duration} * var(--ag-minute))">${hourLabels.join('')}</div>${dayLanes}</div></div></div></div>`;
}

function agendaAttentionGroups(bookings,now=Date.now()){
 const active=bookings.filter(b=>['pending','confirmed'].includes(b.status));
 return {current:active.filter(b=>Date.parse(b.starts_at)<=now&&Date.parse(b.ends_at)>now).sort((a,b)=>a.starts_at.localeCompare(b.starts_at)),next:active.filter(b=>Date.parse(b.starts_at)>now).sort((a,b)=>a.starts_at.localeCompare(b.starts_at))};
}
function agendaAttention(bookings){
 const groups=agendaAttentionGroups(bookings),card=b=>`<button class="ag-attention-card ag-tone-${ATRY_AGENDA.serviceTone(b.service_id)}" data-action="agenda-detail" data-id="${esc(b.id)}"><time>${hmLocal(b.starts_at)} <small>— ${hmLocal(b.ends_at)}</small></time><strong>${esc(b.customer_name)}</strong><span>${esc(b.service_name)} · ${esc(b.staff_name)}</span>${agendaStatus(b.status)}<span class="ag-attention-open">Ver turno ${ic('arrow')}</span></button>`;
 return `<section class="ag-attention" aria-label="Modo atención de hoy"><header><span class="ag-attention-live">EN FOCO · HOY</span><h2>Un turno a la vez. Todo bajo control.</h2><p>Turnos pendientes y confirmados de hoy, según tus filtros. El horario no cambia su estado automáticamente.</p></header><div class="ag-attention-columns">${[['En este horario',groups.current,'No hay turnos en curso en este horario.'],['A continuación',groups.next,'No quedan turnos por comenzar hoy.']].map(([title,list,empty])=>`<section><h3>${title}<span>${list.length}</span></h3><div class="ag-attention-list">${list.length?list.map(card).join(''):`<p class="ag-attention-empty">${empty}</p>`}</div></section>`).join('')}</div></section>`;
}

async function renderProfessionalAgenda({background=false}={}){
 const businessId=state.business.id,routeAtStart=path(),generation=state.agendaGeneration=(state.agendaGeneration||0)+1;
 if(state.agendaAttention&&state.dateAgenda!==today())state.agendaAttention=false;
 state.agendaMode=state.agendaMode||'dia';const mode=state.agendaMode,range=calendarRange(state.dateAgenda,mode),employee=state.business.role==='staff',team=hasCapability('team')&&!employee;
 const [all,people]=await Promise.all([api(bapi(`/bookings?date=${range.start}&days=${range.days}${mode==='mes'?'&calendar=month':''}`)),employee?employeeCatalog().then(c=>c.staff.filter(s=>s.id===state.business.staff_id)):api(bapi('/staff'))]);
 if(state.business?.id!==businessId||path()!==routeAtStart||generation!==state.agendaGeneration)return;
 let schedule={rules:null,error:false};if(mode!=='mes'||hasCapability('resources'))schedule=await agendaRules(people);
 if(state.business?.id!==businessId||path()!==routeAtStart||generation!==state.agendaGeneration)return;
 if(background&&(state.dialog||document.querySelector('form[data-dirty="true"]'))){state.syncPending=true;const status=$('#sync-status');if(status)status.textContent='Cambios disponibles; terminá tu edición para actualizar.';return;}
 state.currentBookings=all;state.staffList=people;state.agendaRules=schedule.rules;
 if(!team)state.agendaStaff='';else if(state.agendaStaff&&!people.some(s=>s.id===state.agendaStaff))state.agendaStaff='';
 if(!hasCapability('resources'))state.agendaResource='';
 const q=(state.agendaSearch||'').trim().toLocaleLowerCase('es'),assignments=schedule.rules?.assignments||schedule.rules?.service_resources||[];
 const matching=all.filter(a=>(!employee||a.staff_id===state.business.staff_id)&&(!state.agendaResource||assignments.some(r=>r.resource_id===state.agendaResource&&r.service_id===a.service_id))&&(!q||[a.customer_name,a.customer_email,a.customer_phone,a.service_name,a.staff_name].join(' ').toLocaleLowerCase('es').includes(q)));
 const staffBookings=matching.filter(b=>!state.agendaStaff||b.staff_id===state.agendaStaff),bookings=staffBookings.filter(b=>!state.agendaStatusFilter||b.status===state.agendaStatusFilter);
 let shown=people.filter(s=>(s.active||bookings.some(b=>b.staff_id===s.id))&&(!state.agendaStaff||s.id===state.agendaStaff));
 if(!team&&!employee&&shown.length>1)shown=shown.filter(s=>bookings.some(b=>b.staff_id===s.id)||s.active).slice(0,1);
 // Historical bookings retain their own lane even after a plan reduction or staff deactivation.
 for(const b of bookings)if(!shown.some(s=>s.id===b.staff_id))shown.push(people.find(s=>s.id===b.staff_id)||{id:b.staff_id,name:b.staff_name||'Profesional',active:0});
 const resources=hasCapability('resources')?(schedule.rules?.resources||[]).filter(r=>r.active):[];
 const weekDates=Array.from({length:7},(_,i)=>plusDate(range.start,i));let mobileDate=state.agendaMobileDate;if(!weekDates.includes(mobileDate))mobileDate=weekDates.includes(state.dateAgenda)?state.dateAgenda:weekDates[0];state.agendaMobileDate=mobileDate;
 let calendar;if(mode==='mes')calendar=agendaMonth(bookings,range);else if(mode==='semana')calendar=`<div class="ag-week-strip" aria-label="Seleccionar día de la semana">${weekDates.map(d=>`<button data-action="agenda-week-day" data-date="${d}" aria-pressed="${d===mobileDate}"><span>${new Intl.DateTimeFormat('es-UY',{weekday:'short'}).format(new Date(d+'T12:00Z'))}</span><strong>${Number(d.slice(8))}</strong><small>${bookings.filter(b=>ATRY_AGENDA.segment(b,d,agendaZone())).length} turnos</small></button>`).join('')}</div><div class="ag-week-desktop">${agendaTimeGrid(bookings,shown,schedule.rules,weekDates,{week:true})}</div>${agendaMobileCalendar(bookings,shown,schedule.rules,mobileDate)}`;else calendar=team&&shown.length>1?`<div class="ag-day-desktop">${agendaTimeGrid(bookings,shown,schedule.rules,[state.dateAgenda])}</div>${agendaMobileCalendar(bookings,shown,schedule.rules,state.dateAgenda)}`:agendaTimeGrid(bookings,shown,schedule.rules,[state.dateAgenda]);
 if(state.agendaAttention)calendar=agendaAttention(bookings);
 const chips=[state.agendaStaff?{key:'staff',label:people.find(p=>p.id===state.agendaStaff)?.name||'Profesional'}:null,state.agendaResource?{key:'resource',label:resources.find(r=>r.id===state.agendaResource)?.name||'Recurso'}:null,state.agendaStatusFilter?{key:'status',label:agendaStatusNames[state.agendaStatusFilter]}:null,state.agendaSearch?{key:'search',label:'Búsqueda: '+state.agendaSearch}:null].filter(Boolean);
 const professionals=team?agendaProfessionals(people,matching):'';
 const summary=agendaSummary(staffBookings);
 const dates=mode==='semana'?`${agendaDayTitle(range.start)} — ${agendaDayTitle(plusDate(range.start,6))}`:mode==='mes'?new Intl.DateTimeFormat('es-UY',{month:'long',year:'numeric'}).format(new Date(state.dateAgenda+'T12:00Z')):dateLong(state.dateAgenda);
 const oldScroll=[...document.querySelectorAll('.ag-grid-scroll')].find(el=>el.getClientRects().length),scrollKey=mode+':'+(mode==='semana'?range.start:state.dateAgenda)+':'+(state.agendaStaff||'');const saved=state.agendaScrollKey===scrollKey&&oldScroll?{top:oldScroll.scrollTop,left:oldScroll.scrollLeft}:null;
 setScreen(`<div class="ag-workspace ${state.agendaToolsOpen?'ag-tools-open':''} ${state.agendaDensity==='compact'?'ag-density-compact':'ag-density-comfort'} ${state.agendaFiltersOpen?'ag-filters-open':''}">${headerTitle('Agenda','Hagamos lugar para un gran día.',`<button class="btn" data-action="open-booking">${ic('plus')} Crear turno</button>`)}<section class="ag-toolbar" aria-label="Controles de agenda"><div class="ag-date-controls"><button class="btn secondary icon-only" data-action="agenda-date-shift" data-shift="-1" aria-label="Período anterior">${ic('back')}</button><button class="btn secondary icon-only" data-action="agenda-date-shift" data-shift="1" aria-label="Período siguiente">${ic('arrow')}</button><button class="btn secondary" data-action="agenda-today">Hoy</button><label class="ag-date-input"><span class="sr-only">Fecha de agenda</span><input type="date" id="agenda-date" aria-label="Fecha de agenda" value="${state.dateAgenda}" required></label></div><button class="btn secondary icon-only" data-action="agenda-useful-hour" aria-label="Ir al horario útil" title="Ir a la hora actual o al primer turno">${ic('clock')}</button><button class="btn secondary" data-action="agenda-find-time">${ic('search')} Buscar horario</button><div class="ag-view-switch" role="group" aria-label="Vista del calendario">${['dia','semana','mes'].map(v=>`<button data-action="agenda-view" data-view="${v}" aria-pressed="${mode===v}">${({dia:'Día',semana:'Semana',mes:'Mes'})[v]}</button>`).join('')}</div><button class="btn secondary ag-focus-toggle" data-action="agenda-attention" aria-pressed="${!!state.agendaAttention}">${ic('clock')} Atender hoy</button><button class="btn secondary icon-only ag-filter-toggle" data-action="agenda-toggle-filters" aria-label="Mostrar u ocultar filtros" aria-pressed="${!!state.agendaFiltersOpen}" title="Filtros de agenda · / para buscar"><svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M4 6h16M7 12h10M10 18h4"/></svg></button><button class="btn secondary ag-tools-toggle" data-action="agenda-toggle-tools" aria-pressed="${!!state.agendaToolsOpen}">Más opciones</button><button class="btn secondary icon-only ag-refresh" data-action="refresh" aria-label="Actualizar agenda" title="Actualizar agenda">${ic('refresh')}</button><div class="ag-density" role="group" aria-label="Densidad del calendario"><button data-action="agenda-density" data-density="compact" aria-pressed="${state.agendaDensity==='compact'}">Compacta</button><button data-action="agenda-density" data-density="comfort" aria-pressed="${state.agendaDensity!=='compact'}">Cómoda</button></div></section><div class="ag-context-row ${chips.length?'':'is-empty'}"><div class="ag-filter-chips">${chips.map(c=>`<button data-action="agenda-remove-filter" data-filter="${c.key}" aria-label="Quitar filtro ${esc(c.label)}">${esc(c.label)} ${ic('x')}</button>`).join('')}</div></div><div class="ag-period"><h2>${esc(dates)}</h2><span>${bookings.length} ${bookings.length===1?'turno':'turnos'}</span></div><section class="ag-filterbar ${state.agendaFiltersOpen?'is-open':''}" aria-label="Filtros de agenda">${team?`<label><span>Profesional</span><select id="agenda-staff">${option('','Todo el equipo',!state.agendaStaff)}${people.filter(s=>s.active||all.some(b=>b.staff_id===s.id)).map(s=>option(s.id,s.name+(s.active?'':' · inactivo'),s.id===state.agendaStaff)).join('')}</select></label>`:''}${resources.length?`<label><span>Recurso del servicio</span><select id="agenda-resource">${option('','Todos los recursos',!state.agendaResource)}${resources.map(r=>option(r.id,r.name,r.id===state.agendaResource)).join('')}</select></label>`:''}<form data-form="agenda-search"><label class="sr-only" for="ag-search">Buscar reservas</label><div class="ag-search">${ic('search')}<input id="ag-search" name="q" placeholder="Buscar cliente, servicio o contacto" value="${esc(state.agendaSearch||'')}" maxlength="100"><button class="btn secondary" type="submit">Buscar</button></div></form>${state.agendaSearch||state.agendaStaff||state.agendaResource?'<button class="ag-clear" data-action="agenda-clear-filters">Limpiar filtros</button>':''}</section>${professionals}${summary}<div class="ag-meta"><div class="ag-legend" aria-label="Estados de los turnos">${Object.keys(agendaStatusNames).map(agendaStatus).join('')}</div><span id="sync-status" role="status">${window.ATRY_DEMO?.enabled?'Demostración local · sin sincronización con servidores':state.syncPending?'Cambios disponibles':state.syncConnected?'Sincronización conectada':'Conectando…'}</span></div>${schedule.error?'<p class="ag-data-warning" role="status">No se pudieron cargar las jornadas. Mostramos los turnos; al reservar se comprobará la disponibilidad.</p>':''}${!bookings.length?'<p class="ag-empty-note">No hay turnos para este período y estos filtros.</p>':''}${calendar}<div class="ag-calendar-foot"><span>${mode==='mes'?'Seleccioná un día para abrir su agenda.':'El color lateral identifica el servicio; la etiqueta indica el estado.'}</span><span>${mode!=='mes'?(schedule.rules?'Fondo rayado: fuera de jornada o bloqueo. ':'Jornadas no disponibles para esta vista. '):''}La disponibilidad se valida al reservar.</span><span class="ag-keyboard-help">Atajos: H · hoy / N · crear turno / 1–3 · vistas / / · buscar</span></div></div>`,'Agenda');
 state.agendaScrollKey=scrollKey;for(const el of document.querySelectorAll('.ag-grid-scroll'))if(saved){el.scrollTop=saved.top;el.scrollLeft=saved.left;}
 if(!saved)agendaScrollUseful(bookings);
 updateAgendaClock();clearInterval(agendaClockTimer);agendaClockTimer=setInterval(()=>{if(!path().startsWith('/app/agenda')){clearInterval(agendaClockTimer);return;}if(state.agendaAttention&&!state.dialog)viewAgenda({background:true}).catch(()=>{});else updateAgendaClock();},60000);connectAgendaEvents();
}
function updateAgendaClock(){if(!path().startsWith('/app/agenda')){clearInterval(agendaClockTimer);return;}const now=ATRY_AGENDA.parts(new Date(),agendaZone());for(const line of document.querySelectorAll('.ag-now-line')){const start=Number(line.dataset.start),end=Number(line.dataset.end);line.hidden=now.day!==line.dataset.day||now.minute<start||now.minute>=end;line.style.top=(now.minute-start)/(end-start)*100+'%';} }
async function agendaInteraction(action,button){
 if(action==='close-modal'&&document.querySelector('.ag-detail-mask')){state.dialog=null;document.querySelector('.ag-detail-mask').remove();document.querySelector('[data-action="agenda-detail"][data-id="'+CSS.escape(state.agendaDetailId||'')+'"]')?.focus();if(state.syncPending)await viewAgenda({background:true});return true;}
 if(action==='agenda-toggle-filters'){state.agendaFiltersOpen=!state.agendaFiltersOpen;document.querySelector('.ag-workspace')?.classList.toggle('ag-filters-open',state.agendaFiltersOpen);document.querySelector('.ag-filterbar')?.classList.toggle('is-open',state.agendaFiltersOpen);button.setAttribute('aria-pressed',String(state.agendaFiltersOpen));return true;}
 if(action==='agenda-detail'){
  state.agendaDetailId=button.dataset.id;
  const b=(state.currentBookings||[]).find(b=>b.id===button.dataset.id);if(!b)return true;
  const minutes=Math.round((Date.parse(b.ends_at)-Date.parse(b.starts_at))/60000),rules=state.agendaRules,resources=hasCapability('resources')?(rules?.resources||[]).filter(r=>(rules.assignments||rules.service_resources||[]).some(a=>a.service_id===b.service_id&&a.resource_id===r.id)):[];
  await agendaShowDetail('Detalle del turno',`<article class="ag-booking-detail"><header>${agendaStatus(b.status)}<h3>${esc(b.customer_name)}</h3><p>${esc(b.service_name)}</p></header><dl><div><dt>Fecha</dt><dd>${esc(agendaDayTitle(dayLocal(b.starts_at)))}</dd></div><div><dt>Horario</dt><dd>${hmLocal(b.starts_at)} – ${hmLocal(b.ends_at)} <small>· ${minutes} min</small></dd></div><div><dt>Profesional</dt><dd>${esc(b.staff_name)}</dd></div>${resources.length?`<div><dt>Recursos del servicio</dt><dd>${resources.map(r=>esc(r.name)).join(', ')}</dd></div>`:''}</dl>${typeof waContact==='function'?waContact(b):''}${b.notes?`<div class="ag-booking-notes"><strong>Notas internas</strong><p>${esc(b.notes)}</p></div>`:''}${b.customer_id&&state.business.role!=='staff'?`<section class="ag-history"><button type="button" class="btn secondary sm" data-action="agenda-customer-history" data-id="${esc(b.customer_id)}">${ic('users')} Ver historial del cliente</button><div class="ag-history-content" aria-live="polite"></div></section>`:''}<footer><h4 class="wa-management-label">Gestión del turno</h4>${bookingActions(b)}</footer></article>`);return true;
 }

 if(action==='agenda-open-activity-day'){state.dateAgenda=button.dataset.date;state.agendaMobileDate=state.dateAgenda;state.agendaMode='dia';state.agendaAttention=false;state.agendaSearch='';state.agendaStaff='';state.agendaResource='';state.agendaStatusFilter='';nav('/app/agenda');return true;}
 if(action==='agenda-use-duplicate'){const c=(state.agendaDuplicateCandidates||[]).find(c=>c.id===button.dataset.id);if(c){state.agendaCustomerResults=[c];agendaSelectCustomer(c.id);button.closest('.ag-duplicate-notice')?.remove();}return true;}
 if(action==='agenda-distinct-customer'){const form=button.closest('form');button.closest('.ag-duplicate-notice')?.remove();agendaFieldError(form,'customer_phone','Si es otra persona, ingresá un teléfono o correo diferente: este contacto pertenece a una ficha existente.');form.elements.customer_phone.focus();return true;}
 if(action==='agenda-toggle-tools'){state.agendaToolsOpen=!state.agendaToolsOpen;document.querySelector('.ag-workspace')?.classList.toggle('ag-tools-open',state.agendaToolsOpen);button.setAttribute('aria-pressed',String(state.agendaToolsOpen));return true;}
 if(action==='agenda-useful-hour'){agendaScrollUseful(state.currentBookings||[],true);return true;}
 if(action==='agenda-find-time'){state.agendaFlowDraft=null;state.agendaRescheduleId=null;await agendaFindTime();return true;}
 if(action==='booking-reschedule'&&path().startsWith('/app/agenda')){await agendaPrepareReschedule(button.dataset.id);return true;}
 if(action==='agenda-find-for-booking'){const form=button.closest('form');state.agendaFlowDraft=agendaCaptureDraft(form);state.agendaRescheduleId=null;await agendaFindTime({service:form.elements.service_id.value,date:form.elements.date.value,staff:form.elements.staff_id.value});return true;}
 if(action==='agenda-find-for-reschedule'){const form=button.closest('form'),b=(state.currentBookings||[]).find(x=>x.id===form.dataset.id);if(b){state.agendaRescheduleId=b.id;state.agendaRescheduleDraft={date_time:form.elements.date_time.value,staff_id:form.elements.staff_id.value};await agendaFindTime({service:b.service_id,date:form.elements.date_time.value.slice(0,10),staff:form.elements.staff_id.value});}return true;}
 if(action==='agenda-flow-back'){if(state.agendaRescheduleId)await agendaPrepareReschedule(state.agendaRescheduleId,state.agendaRescheduleDraft);else await agendaCreateBooking({draft:state.agendaFlowDraft,date:state.agendaFlowDraft?.date,time:state.agendaFlowDraft?.time,staff:state.agendaFlowDraft?.staff_id});return true;}
 if(action==='agenda-load-times'){await agendaLoadTimes(button);return true;}
 if(action==='agenda-choose-time'&&state.agendaRescheduleId){const slot=(state.agendaAvailableSlots||[])[Number(button.dataset.index)];if(slot){const id=state.agendaRescheduleId;await agendaPrepareReschedule(id);const form=document.querySelector('form[data-form="reschedule"]');if(form){form.elements.date_time.value=dayLocal(slot.start||slot.starts_at)+'T'+hmLocal(slot.start||slot.starts_at);form.elements.staff_id.value=slot.staff_id;form.dataset.dirty='true';agendaUpdateComparison(form);}}return true;}
 if(action==='agenda-choose-time'){const slot=(state.agendaAvailableSlots||[])[Number(button.dataset.index)];if(slot){state.dateAgenda=ATRY_AGENDA.parts(slot.start||slot.starts_at,agendaZone()).day;state.agendaMobileDate=state.dateAgenda;state.agendaMobileStaff=slot.staff_id;state.agendaAttention=false;await agendaCreateBooking({date:state.dateAgenda,time:hmLocal(slot.start||slot.starts_at),staff:slot.staff_id,draft:state.agendaFlowDraft});}const form=document.querySelector('form[data-form="manual-book"]');if(form&&state.agendaAvailableService)form.elements.service_id.value=state.agendaAvailableService;return true;}
 if(action==='agenda-customer-history'){await agendaCustomerHistory(button);return true;}
 if(action==='agenda-professional'){state.agendaStaff=button.dataset.id||'';await viewAgenda();return true;}
 if(action==='agenda-status-filter'){state.agendaStatusFilter=state.agendaStatusFilter===button.dataset.status?'':button.dataset.status;await viewAgenda();return true;}
 if(action==='open-booking'&&path().startsWith('/app/agenda')){await agendaCreateBooking({staff:state.agendaStaff});return true;}
 if(action==='agenda-customer-search'){await agendaFindCustomer(button);return true;}
 if(action==='agenda-customer-select'){agendaSelectCustomer(button.dataset.id);return true;}
 if(action==='agenda-customer-reset'){agendaSelectCustomer(null);return true;}
 if(action==='agenda-density'){state.agendaDensity=button.dataset.density;await viewAgenda();return true;}
 if(action==='agenda-remove-filter'){const key={staff:'agendaStaff',resource:'agendaResource',search:'agendaSearch',status:'agendaStatusFilter'}[button.dataset.filter];if(key)state[key]='';await viewAgenda();return true;}
 if(action==='agenda-attention'){state.agendaAttention=!state.agendaAttention;if(state.agendaAttention){state.agendaReturn={mode:state.agendaMode,date:state.dateAgenda};state.agendaMode='dia';state.dateAgenda=today();}else if(state.agendaReturn){state.agendaMode=state.agendaReturn.mode;state.dateAgenda=state.agendaReturn.date;}await viewAgenda();return true;}
 if(action==='agenda-view'){state.agendaAttention=false;state.agendaMode=button.dataset.view;await viewAgenda();return true;}
 if(action==='agenda-week-day'){state.agendaMobileDate=button.dataset.date;state.dateAgenda=button.dataset.date;await viewAgenda();return true;}
 if(action==='agenda-today'){state.dateAgenda=today();state.agendaMobileDate=state.dateAgenda;await viewAgenda();return true;}
 if(action==='agenda-clear-filters'){state.agendaStaff='';state.agendaSearch='';state.agendaResource='';state.agendaStatusFilter='';await viewAgenda();return true;}
 if(action==='agenda-slot'){
  await agendaCreateBooking({date:button.dataset.date,time:button.dataset.time,staff:button.dataset.staff||state.agendaStaff});
  return true;
 }
 return false;
}
document.addEventListener('change',event=>{if(event.target.id==='agenda-resource'){state.agendaResource=event.target.value;viewAgenda().catch(e=>toast(e.message,true));}});
window.addEventListener('pagehide',()=>clearInterval(agendaClockTimer));

document.addEventListener('keydown',event=>{if(!event.target.matches('.ag-slot')||!['ArrowUp','ArrowDown','Home','End'].includes(event.key))return;event.preventDefault();const items=[...event.target.closest('.ag-lane').querySelectorAll('.ag-slot')],index=items.indexOf(event.target),target=items[event.key==='Home'?0:event.key==='End'?items.length-1:Math.max(0,Math.min(items.length-1,index+(event.key==='ArrowDown'?1:-1)))];event.target.tabIndex=-1;target.tabIndex=0;target.focus();});

async function agendaShowDetail(title,body){
 state.dialog={title,body};
 document.querySelector('.modal-mask')?.remove();
 document.querySelector('#root').insertAdjacentHTML('beforeend',modalContent());
 document.querySelector('.modal-mask')?.classList.add('ag-detail-mask');
 document.querySelector('.modal button')?.focus();
}
// Calendar shortcuts never intercept typing, dialogs, modifiers or other sections.
document.addEventListener('keydown',event=>{
 if(!path().startsWith('/app/agenda')||state.dialog||event.ctrlKey||event.altKey||event.metaKey||event.isComposing||event.repeat||event.target.closest('input,textarea,select,[contenteditable="true"],dialog'))return;
 const key=event.key.toLowerCase(),actions={h:'agenda-today',n:'open-booking','1':'dia','2':'semana','3':'mes'};
 if(key==='/'){event.preventDefault();state.agendaFiltersOpen=true;document.querySelector('.ag-filterbar')?.classList.add('is-open');document.querySelector('.ag-workspace')?.classList.add('ag-filters-open');document.querySelector('[data-action="agenda-toggle-filters"]')?.setAttribute('aria-pressed','true');document.querySelector('#ag-search')?.focus();return;}
 if(!actions[key])return;event.preventDefault();const selector=['1','2','3'].includes(key)?'[data-action="agenda-view"][data-view="'+actions[key]+'"]':'[data-action="'+actions[key]+'"]';document.querySelector(selector)?.click();
});

function agendaProfessionals(people,bookings){
 const active=people.filter(p=>p.active||bookings.some(b=>b.staff_id===p.id));
 return `<div class="ag-professionals" role="group" aria-label="Elegir profesional"><button class="ag-professional" data-action="agenda-professional" data-id="" aria-pressed="${!state.agendaStaff}"><span class="ag-professional-avatar ag-team-avatar">${ic('users')}</span><span><strong>Todo el equipo</strong><small>${bookings.length} turnos</small></span></button>${active.map((p,i)=>`<button class="ag-professional" data-action="agenda-professional" data-id="${esc(p.id)}" aria-pressed="${state.agendaStaff===p.id}">${typeof staffAvatar==='function'?staffAvatar(p,'ag-professional-avatar'):`<span class="ag-professional-avatar" style="--avatar-hue:${[250,170,325,35,210][i%5]}">${esc((p.name||'?').split(' ').map(x=>x[0]).slice(0,2).join(''))}</span>`}<span><strong>${esc(p.name)}</strong><small>${p.active?bookings.filter(b=>b.staff_id===p.id).length+' turnos':'Historial · inactivo'}</small></span></button>`).join('')}</div>`;
}
function agendaSummary(bookings){
 return `<div class="ag-summary" role="group" aria-label="Resumen del período filtrado">${['confirmed','pending','completed','cancelled','no_show'].map(status=>`<button data-action="agenda-status-filter" data-status="${status}" aria-pressed="${state.agendaStatusFilter===status}"><i class="ag-state-dot ag-state-dot--${status}"></i><span>${({confirmed:'Confirmados',pending:'Pendientes',completed:'Completados',cancelled:'Cancelados',no_show:'Ausentes'})[status]}</span><strong>${bookings.filter(b=>b.status===status).length}</strong></button>`).join('')}</div>`;
}
async function agendaCreateBooking(context={}){
 state.agendaBookingContext={date:context.date||state.dateAgenda,time:context.time||'10:00',staff:context.staff||''};
 if(state.business.role==='staff')await employeeBookingModal();else await bookingModal();
 const form=document.querySelector('form[data-form="manual-book"]');if(!form)return;
 const professional=form.elements.staff_id;if(professional?.options?.length===1){professional.hidden=true;professional.insertAdjacentHTML('afterend',`<span class="small">${esc(professional.options[0].text)}</span>`);}const c=state.agendaBookingContext;form.elements.date.value=c.date;form.elements.time.value=c.time;
 if(c.staff&&form.elements.staff_id.tagName==='SELECT'&&[...form.elements.staff_id.options].some(o=>o.value===c.staff))form.elements.staff_id.value=c.staff;
 document.querySelector('.modal-mask')?.classList.add('ag-create-mask');
 form.insertAdjacentHTML('afterbegin',`<div class="ag-create-context form-full">${ic('calendar')}<span>Nuevo turno · ${esc(agendaDayTitle(c.date))}<strong>${esc(c.time)}</strong></span><small>La disponibilidad se comprueba al guardar.</small></div>`);
 if(state.business.role!=='staff')form.querySelector('.ag-create-context').insertAdjacentHTML('afterend',`<section class="ag-customer-picker form-full"><label for="ag-customer-query">¿Ya es cliente?</label><div class="ag-customer-search"><input id="ag-customer-query" type="search" placeholder="Nombre, correo o teléfono" maxlength="80" autocomplete="off"><button type="button" class="btn secondary sm" data-action="agenda-customer-search">${ic('search')} Buscar</button></div><div id="ag-customer-results" aria-live="polite"><p>Buscá un contacto o completá sus datos más abajo para una primera visita.</p></div></section>`);
 const draft=context.draft;if(draft)agendaRestoreDraft(form,agendaDraftAtSlot(draft,c));
 form.querySelector('[name="service_id"]').closest('.field').insertAdjacentHTML('afterend',`<div class="form-full ag-flow-link"><button type="button" class="btn secondary sm" data-action="agenda-find-for-booking">${ic('calendar')} Elegir un horario disponible</button><span>Conservamos los datos de tu cliente.</span></div>`);
 state.agendaCustomerResults=[];form.querySelector('#ag-customer-query,select')?.focus();
}
async function agendaFindCustomer(button){
 if(state.business.role==='staff')return;
 const form=button.closest('form'),input=form?.querySelector('#ag-customer-query'),target=form?.querySelector('#ag-customer-results'),q=input?.value.trim();if(!target)return;
 if(!q||q.length<2){target.innerHTML='<p>Escribí al menos dos caracteres para buscar.</p>';return;}
 const businessId=state.business.id,sequence=state.agendaCustomerSequence=(state.agendaCustomerSequence||0)+1;
 button.disabled=true;target.innerHTML='<p>Buscando contactos…</p>';
 try{const results=await api(bapi('/customers?q='+encodeURIComponent(q)));if(state.business.id!==businessId||sequence!==state.agendaCustomerSequence||!target.isConnected)return;
 state.agendaCustomerResults=results;target.innerHTML=results.length?`<div class="ag-customer-options">${results.slice(0,8).map(c=>`<button type="button" data-action="agenda-customer-select" data-id="${esc(c.id)}"><span class="ag-customer-initial">${esc((c.name||'?')[0])}</span><span><strong>${esc(c.name)}</strong><small>${esc([c.email,c.phone].filter(Boolean).join(' · ')||'Sin contacto registrado')}</small></span>${ic('plus')}</button>`).join('')}</div>${results.length>8?'<p>Mostramos ocho coincidencias. Afiná la búsqueda para encontrar más.</p>':''}`:'<p>No encontramos coincidencias. Podés completar los datos del nuevo cliente debajo.</p>';
 }catch(e){if(target.isConnected)target.textContent=e.message||'No se pudo buscar. Intentá nuevamente.';}finally{button.disabled=false;}
}
function agendaSelectCustomer(id){
 if(state.business.role==='staff')return;
 const form=document.querySelector('form[data-form="manual-book"]'),c=(state.agendaCustomerResults||[]).find(c=>c.id===id);if(!form||id&&!c)return;
 form.querySelector('[name="customer_id"]')?.remove();
 if(c)form.insertAdjacentHTML('afterbegin',`<input type="hidden" name="customer_id" value="${esc(c.id)}">`);
 for(const [name,value]of [['customer_name',c?.name],['customer_email',c?.email],['customer_phone',c?.phone]]){const input=form.elements[name];input.value=value||'';input.readOnly=!!c;}
 form.dataset.dirty='true';const result=form.querySelector('#ag-customer-results');if(result)result.innerHTML=c?`<div class="ag-customer-selected">${ic('check')}<span><strong>${esc(c.name)}</strong><small>Cliente seleccionado. Su ficha de contacto se conserva.</small></span><button type="button" data-action="agenda-customer-reset" aria-label="Cambiar cliente">${ic('x')}</button></div>${!c.email&&!c.phone?'<p>Este cliente no tiene correo ni teléfono. Agregá un contacto desde su ficha antes de reservar.</p>':''}`:'<p>Completá los datos de una primera visita o buscá otro cliente.</p>';
}
// Enter in the customer search performs a lookup, never an accidental reservation.
document.addEventListener('keydown',event=>{if(event.target.id==='ag-customer-query'&&event.key==='Enter'){event.preventDefault();event.target.closest('form').querySelector('[data-action="agenda-customer-search"]')?.click();}});

document.addEventListener('change',event=>{
 const form=event.target.closest('form[data-form="manual-book"]');if(!form||!['date','time'].includes(event.target.name))return;
 const summary=form.querySelector('.ag-create-context>span');if(!summary)return;
 const date=form.elements.date.value,time=form.elements.time.value;
 summary.innerHTML=`Nuevo turno · ${date?esc(agendaDayTitle(date)):'Elegí una fecha'}<strong>${esc(time||'Elegí una hora')}</strong>`;
});

function agendaUsefulMinute(bookings,day,now,zone,bounds={start:0,end:1440}){
 const entries=bookings.map(b=>ATRY_AGENDA.segment(b,day,zone)).filter(Boolean);
 if(day===now.day&&now.minute>=bounds.start&&now.minute<bounds.end)return now.minute;
 if(day===now.day&&now.minute>=bounds.end)return entries.length?Math.max(...entries.map(x=>x.start)):bounds.start;
 return entries.length?Math.min(...entries.map(x=>x.start)):Math.max(bounds.start,540);
}
function agendaScrollUseful(bookings,smooth=false){
 const now=ATRY_AGENDA.parts(new Date(),agendaZone());
 for(const scroll of document.querySelectorAll('.ag-grid-scroll')){
 const lanes=[...scroll.querySelectorAll('.ag-lane')],day=lanes.some(l=>l.dataset.date===now.day)?now.day:lanes[0]?.dataset.date;if(!day)continue;
 const line=scroll.querySelector('.ag-now-line'),start=Number(line?.dataset.start||480),end=Number(line?.dataset.end||1200),body=scroll.querySelector('.ag-hours');if(!body)continue;
 const minute=agendaUsefulMinute(bookings.filter(b=>!state.agendaStaff||b.staff_id===state.agendaStaff),day,now,agendaZone(),{start,end}),scale=body.getBoundingClientRect().height/(end-start),top=Math.max(0,(Math.min(end,Math.max(start,minute))-start)*scale-55);
 scroll.scrollTo({top,behavior:smooth&&!matchMedia('(prefers-reduced-motion: reduce)').matches?'smooth':'auto'});
 }
}
function agendaMobileCalendar(bookings,people,rules,day){
 const selected=people.find(p=>p.id===state.agendaMobileStaff)||people.find(p=>p.id===state.agendaStaff)||people[0];
 if(selected)state.agendaMobileStaff=selected.id;
 const selector=people.length>1?`<label class="ag-mobile-professional">${ic('users')}<span>Profesional</span><select id="agenda-mobile-professional" aria-label="Profesional en móvil">${people.map(p=>option(p.id,p.name,p.id===selected.id)).join('')}</select></label>`:'';
 return `<div class="ag-mobile-calendar">${selector}${agendaTimeGrid(bookings,selected?[selected]:[],rules,[day],{mobile:true})}</div>`;
}
async function agendaFindTime(defaults={}){
 const employee=state.business.role==='staff',catalog=employee?await employeeCatalog():{services:await api(bapi('/services')),staff:state.staffList||[]};
 const people=catalog.staff.filter(p=>p.active&&(!employee||p.id===state.business.staff_id)),services=catalog.services.filter(v=>v.active&&(!state.agendaRescheduleId||v.id===defaults.service));
 if(!services.length||!people.length){toast('Necesitás servicios y profesionales activos para consultar horarios.',true);return;}
 state.agendaAvailableSlots=[];state.agendaAvailableService='';
 await showDialog('Encontrar un horario',`<div class="ag-time-finder"><p>Elegí un servicio y una fecha. Consultamos los horarios del sistema de reservas; se vuelven a validar al guardar.</p><div class="form-grid"><label class="field form-full"><span>Servicio</span><select id="ag-find-service">${services.map(v=>option(v.id,v.name+' · '+v.duration_min+' min',v.id===defaults.service)).join('')}</select></label><label class="field"><span>Fecha</span><input id="ag-find-date" type="date" value="${esc(defaults.date||state.dateAgenda)}" required></label><label class="field"><span>Profesional</span><select id="ag-find-staff" ${people.length===1?'hidden':''}>${!employee&&hasCapability('team')?option('','Cualquiera disponible'):''}${people.map(p=>option(p.id,p.name,p.id===(defaults.staff||state.agendaStaff))).join('')}</select>${people.length===1?`<span>${esc(people[0].name)}</span>`:''}</label></div>${state.agendaRescheduleId?'<p>Mostramos huecos libres; el horario del turno actual permanece ocupado hasta confirmar el cambio.</p>':''}${state.agendaFlowDraft||state.agendaRescheduleId?`<button type="button" class="btn secondary sm ag-flow-back" data-action="agenda-flow-back">${ic('back')} Volver sin cambiar el horario</button>`:''}<button class="btn full" type="button" data-action="agenda-load-times">${ic('search')} Consultar disponibilidad</button><div class="ag-find-results" aria-live="polite"><p>Consultá para ver horarios disponibles.</p></div></div>`);
 document.querySelector('.modal-mask')?.classList.add('ag-create-mask');
}
async function agendaLoadTimes(button){
 const box=button.closest('.ag-time-finder'),target=box?.querySelector('.ag-find-results');if(!target)return;
 const date=box.querySelector('#ag-find-date').value,service=box.querySelector('#ag-find-service').value,staff=box.querySelector('#ag-find-staff').value;
 if(!date||!service){target.textContent='Elegí una fecha y un servicio.';return;}
 const bid=state.business.id,sequence=state.agendaTimesSequence=(state.agendaTimesSequence||0)+1;button.disabled=true;target.innerHTML='<p>Consultando horarios…</p>';state.agendaAvailableSlots=[];
 try{const query=new URLSearchParams({date,service_id:service});if(staff)query.set('staff_id',staff);
 const result=await api('/api/public/'+encodeURIComponent(state.business.slug)+'/availability?'+query);
 if(bid!==state.business.id||sequence!==state.agendaTimesSequence||!target.isConnected)return;
 state.agendaAvailableService=service;state.agendaAvailableSlots=(result.slots||[]).filter(slot=>state.business.role!=='staff'||slot.staff_id===state.business.staff_id).sort((a,b)=>(a.start||a.starts_at).localeCompare(b.start||b.starts_at)||String(a.staff_name||'').localeCompare(b.staff_name||''));
 target.innerHTML=state.agendaAvailableSlots.length?`<p>${state.agendaAvailableSlots.length} opciones · ${esc(agendaDayTitle(date))}</p><div class="ag-time-options">${state.agendaAvailableSlots.map((slot,i)=>`<button type="button" data-action="agenda-choose-time" data-index="${i}"><strong>${hmLocal(slot.start||slot.starts_at)}</strong><span>${esc(slot.staff_name||'Profesional')}</span>${ic('plus')}</button>`).join('')}</div><p>Elegir un horario abre el formulario; todavía no reserva.</p>`:'<p>No hay horarios disponibles para esta combinación. Probá otra fecha o profesional.</p>';
 }catch(e){if(target.isConnected)target.textContent='No pudimos consultar la disponibilidad. '+(e.message||'Intentá nuevamente.');}finally{button.disabled=false;}
}
async function agendaCustomerHistory(button){
 if(state.business.role==='staff')return;const target=button.parentElement.querySelector('.ag-history-content'),bid=state.business.id;button.disabled=true;target.textContent='Consultando historial…';
 try{const data=await api(bapi('/customers/'+encodeURIComponent(button.dataset.id)+'/history'));if(bid!==state.business.id||!target.isConnected)return;
 const history=Array.isArray(data)?data:(data.bookings||[]),summary={visits:history.filter(b=>b.status==='completed').length,cancelled:history.filter(b=>b.status==='cancelled').length,no_show:history.filter(b=>b.status==='no_show').length};target.innerHTML=`<div class="ag-history-stats"><span><strong>${Number(summary.visits)||0}</strong> completados</span><span><strong>${Number(summary.cancelled)||0}</strong> cancelaciones</span><span><strong>${Number(summary.no_show)||0}</strong> ausencias</span></div><p>Resumen de las reservas consultadas · hasta 100 registros. Últimos turnos:</p>${history.slice().sort((a,b)=>b.starts_at.localeCompare(a.starts_at)).slice(0,5).map(b=>`<div class="ag-history-row"><span>${esc(agendaDayTitle(dayLocal(b.starts_at)))} · ${hmLocal(b.starts_at)}<small>${esc(b.service_name||b.service||'Servicio')}</small></span>${agendaStatus(b.status)}</div>`).join('')||'<p>No hay reservas registradas.</p>'}`;
 }catch(e){if(target.isConnected)target.textContent=e.message||'No se pudo consultar el historial.';}finally{button.disabled=false;}
}
document.addEventListener('change',event=>{if(event.target.id==='agenda-mobile-professional'){state.agendaMobileStaff=event.target.value;viewAgenda().catch(e=>toast(e.message,true));}if(event.target.closest('.ag-time-finder')){state.agendaTimesSequence=(state.agendaTimesSequence||0)+1;state.agendaAvailableSlots=[];const results=document.querySelector('.ag-find-results');if(results)results.textContent='Cambiaste los filtros. Consultá nuevamente para ver horarios actualizados.';}});

function agendaCaptureDraft(form){
 const draft={};for(const input of form.querySelectorAll('input[name],select[name],textarea[name]'))draft[input.name]=input.value;return draft;
}
function agendaRestoreDraft(form,draft){
 for(const [name,value]of Object.entries(draft)){const input=form.elements.namedItem(name);if(input)input.value=value;}
 if(draft.customer_id){form.insertAdjacentHTML('afterbegin',`<input type="hidden" name="customer_id" value="${esc(draft.customer_id)}">`);for(const name of ['customer_name','customer_email','customer_phone'])form.elements[name].readOnly=true;
 const target=form.querySelector('#ag-customer-results');if(target)target.innerHTML=`<div class="ag-customer-selected">${ic('check')}<span><strong>${esc(draft.customer_name)}</strong><small>Cliente seleccionado · datos conservados</small></span><button type="button" data-action="agenda-customer-reset" aria-label="Cambiar cliente">${ic('x')}</button></div>`;}
 form.dataset.dirty='true';
}
async function agendaPrepareReschedule(id,draft=null){
 const b=(state.currentBookings||[]).find(x=>x.id===id);if(!b)return;
 const people=state.business.role==='staff'?(await employeeCatalog()).staff.filter(p=>p.id===state.business.staff_id):await api(bapi('/staff'));
 state.staffList=people.filter(p=>p.active||p.id===b.staff_id);await rescheduleModal(id);
 const form=document.querySelector('form[data-form="reschedule"]');if(!form)return;
 document.querySelector('.modal-mask')?.classList.add('ag-create-mask');form.classList.add('ag-reschedule-form');
 if(draft){form.elements.date_time.value=draft.date_time;form.elements.staff_id.value=draft.staff_id;}
 form.insertAdjacentHTML('afterbegin',`<div class="ag-reschedule-comparison" aria-live="polite"></div>`);
 form.querySelector('button[type="submit"],button:not([type])')?.insertAdjacentHTML('beforebegin',`<button type="button" class="btn secondary full" data-action="agenda-find-for-reschedule">${ic('search')} Ver horarios disponibles</button>`);
 agendaUpdateComparison(form);
}
function agendaUpdateComparison(form){
 const b=(state.currentBookings||[]).find(x=>x.id===form.dataset.id),target=form.querySelector('.ag-reschedule-comparison');if(!b||!target)return;
 const value=form.elements.date_time.value,staff=(state.staffList||[]).find(p=>p.id===form.elements.staff_id.value);
 target.innerHTML=`<div><span>Horario actual</span><strong>${esc(agendaDayTitle(dayLocal(b.starts_at)))} · ${hmLocal(b.starts_at)}</strong><small>${esc(b.staff_name)}</small></div><div><span>Nuevo horario propuesto</span><strong>${value?esc(agendaDayTitle(value.slice(0,10)))+' · '+esc(value.slice(11,16)):'Elegí fecha y hora'}</strong><small>${esc(staff?.name||'Elegí profesional')}</small></div>`;
}
document.addEventListener('change',event=>{const form=event.target.closest('form[data-form="reschedule"]');if(form)agendaUpdateComparison(form);});

function agendaDraftAtSlot(draft,context){return {...draft,date:context.date,time:context.time,staff_id:context.staff||draft.staff_id};}

function agendaContactKey(email,phone){return String(email||'').trim().toLowerCase()+'|'+String(phone||'').replace(/[^0-9]/g,'');}
function agendaExactContacts(customers,email,phone){
 const e=String(email||'').trim().toLowerCase(),p=String(phone||'').replace(/[^0-9]/g,'');
 return customers.filter(c=>(e&&String(c.email||'').trim().toLowerCase()===e)||(p&&String(c.phone||'').replace(/[^0-9]/g,'')===p));
}
function agendaBookingIssues(data,services,people){
 const issues={};if(!String(data.customer_name||'').trim()||String(data.customer_name||'').trim().length<2)issues.customer_name='Ingresá el nombre del cliente (al menos dos caracteres).';
 if(!String(data.customer_email||'').trim()&&!String(data.customer_phone||'').trim())issues.customer_phone='Ingresá un teléfono o correo para identificar y contactar al cliente.';
 if(data.customer_phone&&!/[0-9]/.test(data.customer_phone))issues.customer_phone='Ingresá un número de teléfono válido.';
 if(data.customer_email&&!/^\S+@\S+\.\S+$/.test(String(data.customer_email).trim()))issues.customer_email='Ingresá un correo electrónico válido.';
 const service=services.find(s=>s.id===data.service_id),person=people.find(p=>p.id===data.staff_id);
 if(!service||!service.active)issues.service_id='Elegí un servicio activo.';
 if(!person||!person.active)issues.staff_id='Elegí un profesional activo.';
 else if(service&&((Array.isArray(person.service_ids)&&!person.service_ids.includes(service.id))||(!Array.isArray(person.service_ids)&&Array.isArray(service.staff_ids)&&!service.staff_ids.includes(person.id))))issues.staff_id='Este profesional no ofrece el servicio elegido. Cambiá el profesional o el servicio.';
 if(!data.date)issues.date='Elegí una fecha.';if(!data.time)issues.time='Elegí una hora.';
 return issues;
}
function agendaFieldError(form,name,message){
 const input=form.elements.namedItem(name);if(!input||input.type==='hidden')return;
 const container=input.closest('.field')||input.parentElement,id='booking-error-'+name;container.querySelector('#'+id)?.remove();input.removeAttribute('aria-invalid');
 const descriptions=(input.getAttribute('aria-describedby')||'').split(' ').filter(x=>x&&x!==id);
 if(message){input.setAttribute('aria-invalid','true');descriptions.push(id);container.insertAdjacentHTML('beforeend',`<p class="ag-field-error" id="${id}" role="alert">${esc(message)}</p>`);}
 if(descriptions.length)input.setAttribute('aria-describedby',descriptions.join(' '));else input.removeAttribute('aria-describedby');
}
async function agendaCheckDuplicates(form){
 if(state.business.role==='staff'||form.elements.namedItem('customer_id')?.value)return [];
 const email=form.elements.customer_email.value.trim(),phone=form.elements.customer_phone.value.trim(),key=agendaContactKey(email,phone);
 if(!email&&!phone)return [];
 const bid=state.business.id,sequence=Number(form.dataset.duplicateSequence||0)+1;form.dataset.duplicateSequence=sequence;
 const queries=[email,phone].filter(Boolean),results=await Promise.all(queries.map(q=>api(bapi('/customers?q='+encodeURIComponent(q)))));
 if(!form.isConnected||bid!==state.business.id||Number(form.dataset.duplicateSequence)!==sequence||key!==agendaContactKey(form.elements.customer_email.value,form.elements.customer_phone.value))return null;
 const candidates=agendaExactContacts([...new Map(results.flat().map(c=>[c.id,c])).values()],email,phone);state.agendaDuplicateCandidates=candidates;
 form.querySelector('.ag-duplicate-notice')?.remove();
 if(candidates.length){const anchor=form.elements.customer_phone.closest('.field');anchor.insertAdjacentHTML('afterend',`<section class="ag-duplicate-notice form-full" role="status"><strong>Este contacto ya está registrado</strong><p>Revisá la ficha antes de crear otra persona. No unimos clientes automáticamente.</p>${candidates.map(c=>`<button type="button" class="btn secondary sm" data-action="agenda-use-duplicate" data-id="${esc(c.id)}">${ic('users')} Usar ficha de ${esc(c.name)}</button>`).join('')}<button type="button" class="ag-distinct-customer" data-action="agenda-distinct-customer">Es otra persona: corregir el contacto</button></section>`);}
 return candidates;
}
async function agendaValidateBooking(form,data){
 const issues=agendaBookingIssues(data,state.services||[],state.staffList||[]);
 // Employee catalog is deliberately scoped; it is also the source of service validation.
 for(const name of ['customer_name','customer_phone','customer_email','service_id','staff_id','date','time'])agendaFieldError(form,name,issues[name]||'');
 const first=Object.keys(issues)[0];if(first){form.elements.namedItem(first)?.focus();throw new Error('Revisá los campos indicados antes de guardar.');}
 let duplicates;try{duplicates=await agendaCheckDuplicates(form);}catch{agendaFieldError(form,'customer_phone','No pudimos comprobar si el contacto ya existe. Intentá guardar nuevamente.');throw new Error('No se pudo comprobar el contacto. Tus datos se conservan.');}
 if(duplicates===null)throw new Error('El contacto cambió durante la comprobación. Revisalo y guardá nuevamente.');
 if(duplicates.length){form.querySelector('.ag-duplicate-notice button')?.focus();throw new Error('Elegí una ficha existente o indicá que se trata de otra persona.');}
}
document.addEventListener('focusout',event=>{
 const form=event.target.closest('form[data-form="manual-book"]');if(!form||!['customer_email','customer_phone'].includes(event.target.name))return;
 agendaCheckDuplicates(form).catch(()=>{});
});
document.addEventListener('input',event=>{const form=event.target.closest('form[data-form="manual-book"]');if(!form)return;agendaFieldError(form,event.target.name,'');if(['customer_email','customer_phone'].includes(event.target.name)){form.dataset.duplicateSequence=Number(form.dataset.duplicateSequence||0)+1;delete form.dataset.duplicateAcknowledged;form.querySelector('.ag-duplicate-notice')?.remove();}});
document.addEventListener('invalid',event=>{const form=event.target.closest('form[data-form="manual-book"]');if(form)agendaFieldError(form,event.target.name,event.target.validationMessage);},true);
document.addEventListener('change',event=>{const form=event.target.closest('form[data-form="manual-book"]');if(!form||!['service_id','staff_id'].includes(event.target.name))return;
 const data={service_id:form.elements.service_id.value,staff_id:form.elements.staff_id.value},issue=agendaBookingIssues(data,state.services||[],state.staffList||[]).staff_id;agendaFieldError(form,'staff_id',issue||'');
 const service=(state.services||[]).find(s=>s.id===data.service_id),field=form.elements.service_id.closest('.field');field.querySelector('.ag-duration-note')?.remove();if(service)field.insertAdjacentHTML('beforeend',`<p class="ag-duration-note">Duración del servicio: ${Number(service.duration_min)} min${Number(service.buffer_before_min)||Number(service.buffer_after_min)?' · La preparación y limpieza también ocupan agenda.':''}</p>`);
});

function agendaWeeklyModel(rows,end){
 if(!Array.isArray(rows)||rows.some(r=>!r||!/^\d{4}-\d{2}-\d{2}$/.test(r.day)||!Number.isInteger(Number(r.n))||Number(r.n)<0))return null;
 const days=Array.from({length:7},(_,i)=>plusDate(end,i-6)).map(day=>({day,n:rows.filter(r=>r.day===day).reduce((sum,r)=>sum+(Number.isFinite(Number(r.n))&&Number(r.n)>=0?Number(r.n):0),0)}));
 const total=days.reduce((s,d)=>s+d.n,0),peak=Math.max(...days.map(d=>d.n)),step=Math.max(1,Math.ceil(peak/4)),max=step*4;
 return {days,total,average:total/7,peak,peakDays:days.filter(d=>d.n===peak).length,max,ticks:[max,max-step,max-2*step,max-3*step,0]};
}
function agendaWeeklyActivity(rows,end){
 const model=agendaWeeklyModel(rows,end);if(!model)return '<section class="card aw-card"><h2 class="section-label">Actividad de los últimos 7 días</h2><p class="muted small">No se pudo obtener la actividad. Actualizá para consultar los datos.</p></section>';
 const {days,total,average,peak,peakDays,max,ticks}=model,weekday=d=>new Intl.DateTimeFormat('es-UY',{weekday:'short'}).format(new Date(d+'T12:00Z'));
 return `<section class="card aw-card" aria-label="Actividad de los últimos siete días"><header><div><h2 class="section-label">Tu semana, en números</h2><p>${esc(agendaDayTitle(days[0].day))} — ${esc(agendaDayTitle(end))}</p></div><span class="aw-period">7 días</span></header><div class="aw-summary"><div><strong>${total}</strong><span>turnos no cancelados</span></div><div><strong>${average.toLocaleString('es-UY',{maximumFractionDigits:1})}</strong><span>promedio por día</span></div><div><strong>${peak}</strong><span>máximo diario${peak&&peakDays>1?' · '+peakDays+' días':''}</span></div></div><div class="aw-plot"><div class="aw-axis" aria-hidden="true">${ticks.map(n=>`<span>${n}</span>`).join('')}</div><div class="aw-bars" role="group" aria-label="Turnos por fecha. Seleccioná un día para abrir su agenda.">${days.map(d=>`<button class="aw-column ${d.day===end?'is-today':''}" data-action="agenda-open-activity-day" data-date="${d.day}" aria-label="${esc(agendaDayTitle(d.day))}: ${d.n} ${d.n===1?'turno':'turnos'}${d.day===end?', hoy en curso':''}. Abrir agenda" title="${esc(agendaDayTitle(d.day))} · ${d.n} turnos${d.day===end?' · Hoy en curso':''}"><span class="aw-track"><span class="aw-bar ${d.n?'':'is-zero'}" style="--aw-height:${d.n/max*100}%"><strong>${d.n}</strong></span></span><span class="aw-day">${esc(weekday(d.day))}<b>${d.day.slice(8)}</b>${d.day===end?'<i>Hoy</i>':''}</span></button>`).join('')}</div></div><footer><span><i></i> Por fecha del turno · excluye cancelados</span><span>Hoy está en curso</span></footer>${total?'':'<p class="aw-empty">Todavía no hay turnos en este período. Las fechas permiten abrir la agenda para organizar la semana.</p>'}<p class="aw-help">Tocá un día para ver sus turnos ${ic('arrow')}</p></section>`;
}
