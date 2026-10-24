export interface TeamPerson{id:string;name:string;email?:string;color?:string;active:number|boolean;service_ids:string[];user_id?:string|null}
export interface TeamService{id:string;name:string}
export interface Absence{id:string;staff_id:string;staff_name:string;starts_at:string;ends_at:string;reason:string}
export const teamList=(v:unknown):TeamPerson[]=>{if(!Array.isArray(v)||v.some(p=>!p||typeof p.id!=='string'||typeof p.name!=='string'||!Array.isArray(p.service_ids)))throw Error('No se recibió un equipo válido.');return v};
export const serviceList=(v:unknown):TeamService[]=>{if(!Array.isArray(v)||v.some(p=>!p||typeof p.id!=='string'||typeof p.name!=='string'))throw Error('No se recibieron servicios válidos.');return v};
export const absenceList=(v:unknown):Absence[]=>{if(!Array.isArray(v)||v.some(p=>!p||typeof p.id!=='string'||typeof p.starts_at!=='string'||typeof p.ends_at!=='string'))throw Error('No se recibieron ausencias válidas.');return v};
