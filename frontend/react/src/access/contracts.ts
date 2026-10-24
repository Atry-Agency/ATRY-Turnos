export interface Member{id:string;name:string;email:string;role:string}
export interface Person{id:string;name:string;active:number|boolean;user_id?:string|null}
export interface Invitation{id:string;email:string;role:string;accepted_at?:string|null;revoked_at?:string|null;expires_at:string}
export const roleLabel=(role:string)=>({owner:'Propietario',manager:'Encargado',staff:'Empleado'})[role as 'owner']||role;
export const memberList=(v:unknown):Member[]=>{if(!Array.isArray(v)||v.some(m=>!m||!['id','name','email','role'].every(k=>typeof m[k]==='string')))throw Error('No se recibieron accesos válidos.');return v};
export const invitationList=(v:unknown):Invitation[]=>{if(!Array.isArray(v)||v.some(m=>!m||!['id','email','role','expires_at'].every(k=>typeof m[k]==='string')))throw Error('No se recibieron invitaciones válidas.');return v};
export const peopleList=(v:unknown):Person[]=>{if(!Array.isArray(v)||v.some(m=>!m||typeof m.id!=='string'||typeof m.name!=='string'))throw Error('No se recibieron profesionales válidos.');return v};
