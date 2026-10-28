/** Tested against repository PostgreSQL RPCs. Never authorizes a production connection. */
export const cloudIncompatibilities:Readonly<Record<string,string>>={
 'schedule.exception':'Jornadas especiales sigue bloqueada: el RPC tiene un conflicto de nombres en ON CONFLICT. La corrección solo se comprobó en PostgreSQL temporal; falta homologación real.',
 'waitlist.booked':'El RPC solo permite volver a espera o cancelar; marcar atendida requiere el flujo de aceptación de oferta existente.'
};
export const isCloudProfile=(environment:string)=>environment==='phase-one-local'||environment==='reservation-validation'||environment==='operation-validation'||environment==='supabase-local'||environment==='connected'||environment==='supabase-readonly';
