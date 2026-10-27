/** Tested against repository PostgreSQL RPCs. Never authorizes a production connection. */
export const cloudIncompatibilities:Readonly<Record<string,string>>={
 'schedule.exception':'Jornadas especiales sigue bloqueada: falta homologar la diferencia entre el esquema local y el real. No se ejecutará esta acción.',
 'waitlist.booked':'El RPC solo permite volver a espera o cancelar; marcar atendida requiere el flujo de aceptación de oferta existente.'
};
export const isCloudProfile=(environment:string)=>environment==='supabase-local'||environment==='connected'||environment==='supabase-readonly';
