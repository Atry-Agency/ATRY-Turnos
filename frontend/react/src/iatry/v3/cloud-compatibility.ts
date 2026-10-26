/** Tested against repository PostgreSQL RPCs. Never authorizes a production connection. */
export const cloudIncompatibilities:Readonly<Record<string,string>>={
 'schedule.exception':'El RPC de jornadas especiales necesita una restricción SQL que no está disponible en el esquema validado. No se ejecutará esta acción.',
 'waitlist.booked':'El RPC solo permite volver a espera o cancelar; marcar atendida requiere el flujo de aceptación de oferta existente.'
};
export const isCloudProfile=(environment:string)=>environment==='supabase-local'||environment==='connected';
