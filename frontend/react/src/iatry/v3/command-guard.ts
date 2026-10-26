import type {Plan} from './contracts';
// No arbitrary route, DELETE, global administration, account, membership or commercial commands.
const routes:Record<Plan['method'],RegExp[]>={
 POST:[/^\/(services|staff|customers|bookings|time-off|exceptions|holidays|resources|recurring|incidents)$/,/^\/recurring\/[A-Za-z0-9_-]+\/end$/,/^\/visits\/[A-Za-z0-9_-]+\/(cancel|confirm|reschedule)$/],
 PATCH:[/^$/,/^\/(services|staff|customers|bookings|resources|waitlist)\/[A-Za-z0-9_-]+$/,/^\/appearance$/],
 PUT:[/^\/staff\/[A-Za-z0-9_-]+\/hours$/,/^\/services\/[A-Za-z0-9_-]+\/resources$/,/^\/(whatsapp|notification-preferences)$/]
};
export function validateCommand(plan:Plan){if(!routes[plan.method]?.some(pattern=>pattern.test(plan.tail)))throw Error('Esta operación no está autorizada en IAtry.');}
