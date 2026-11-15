import {CalendarIcon} from '../calendar/CalendarIcon';
import googleLogo from '../calendar/assets/google-calendar.svg';
import appleLogo from '../calendar/assets/apple-calendar.jpg';
/** Display-only editorial fixture. No booking, export, or authenticated operations. */
export function ConfirmationPhone({active}:{active:number}){return <div className="receipt-phone" role="img" aria-label="Vista ilustrativa de una reserva confirmada: Estudio Aurora, corte de pelo con Lucía, 1 de noviembre de 10:00 a 10:30. Opciones de calendario y ubicación.">
<div className="receipt-phone-island" aria-hidden="true"/><div className="receipt-phone-screen" aria-hidden="true">
<div className="receipt-brand">ATRY TURNOS</div><div className="receipt-status"><span>✓</span> TU RESERVA ESTÁ CONFIRMADA</div>
<h3>Todo listo para tu<br/>próxima visita.</h3><p className="receipt-intro">Te esperamos en Estudio Aurora.<br/>Aquí tenés los detalles de tu turno.</p>
<div className={'receipt-card'+(active===0?' receipt-highlight':'')}><div className="receipt-business"><div><small>TU TURNO</small><h4>Estudio Aurora</h4><p>Corte de pelo</p><span className="receipt-professional"><i><CalendarIcon name="user"/></i>con Lucía</span></div><div className="receipt-business-logo"><img src="./assets/brand/atry.png" alt="" width="38" height="38"/></div></div>
<div className="receipt-date"><div><strong>01</strong><span>NOV</span></div><div><small>HORARIO</small><b>10:00 – 10:30</b><span>Hora de Uruguay</span></div></div>
<div className={'receipt-location'+(active===2?' receipt-highlight':'')}><div className="receipt-address"><CalendarIcon name="pin"/><div><small>UBICACIÓN</small><p>Plaza Independencia,<br/>Montevideo</p></div><span className="receipt-directions">Cómo llegar</span></div><div className="receipt-map"><img src="./assets/landing/confirmacion-mapa.png" alt="" width="316" height="51" loading="lazy"/><span>© OpenStreetMap</span></div></div></div>
<div className={'receipt-calendars'+(active===1?' receipt-highlight':'')}><header><CalendarIcon name="calendar"/><div><small>SUMALO A TU CALENDARIO</small><p>No te olvides de tu turno.</p></div></header><div className="receipt-providers">{[[googleLogo,'Google Calendar'],[appleLogo,'Apple Calendar']].map(([logo,name])=><div key={name}><img src={logo} alt="" width="26" height="26"/><span>{name}</span><CalendarIcon name="calendar"/></div>)}</div></div>
<div className="receipt-done">Listo, gracias</div><div className="receipt-home-indicator"/></div></div>}
