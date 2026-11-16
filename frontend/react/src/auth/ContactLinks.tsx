import './auth-contact.css';
/** Contact destinations only. These links never start an OAuth or account-registration flow. */
export const atryContacts=[
 {name:'Correo',label:'Escribir a ATRY por correo',href:'mailto:atryagency@gmail.com',mark:'gmail'},
 {name:'Instagram',label:'Instagram de ATRY Agency',href:'https://www.instagram.com/atryagency/',mark:'instagram'},
 {name:'WhatsApp',label:'Conversar con ATRY por WhatsApp',href:'https://wa.me/59893802328',mark:'whatsapp'},
] as const;
export function ContactLinks(){return <nav className="auth-contact" aria-label="Contactar a ATRY"><span>¿Te damos una mano?</span><div>{atryContacts.map(contact=><a key={contact.mark} href={contact.href} title={contact.name} aria-label={contact.label} {...(contact.mark!=='gmail'?{target:'_blank',rel:'noopener noreferrer'}:{})}><img src={'./assets/brand/contact/'+contact.mark+'.svg'} width={20} height={20} alt=""/></a>)}</div></nav>}
