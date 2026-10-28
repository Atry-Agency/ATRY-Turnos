/** Identity edits can propagate into recurring appointments in the existing RPC.
 * Until that effect has a verified proposal/readback contract, live IAtry edits
 * are limited to notes. Local fixtures may still exercise the full RPC contract.
 */
export function assertCustomerWriteSafety(before:Record<string,unknown>,payload:Record<string,unknown>,environment:string){
 const changed=['name','email','phone'].filter(key=>String(before[key]??'')!==String(payload[key]??before[key]??''));
 if(changed.length&&!['local','phase-one-local','supabase-local','demo'].includes(environment))throw Error('Cambiar el nombre o el contacto puede actualizar turnos recurrentes asociados. Esa edición sigue bloqueada en IAtry hasta verificar sus efectos. Podés actualizar únicamente las notas.');
 if(Number(payload.marketing_consent??before.marketing_consent??0)!==Number(before.marketing_consent??0))throw Error('IAtry no puede cambiar el consentimiento de marketing en esta etapa.');
}
