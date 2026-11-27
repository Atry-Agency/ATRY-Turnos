import {financeMoney} from './model';
import type {RegionalBusiness} from '../domain/region';
/** Financial explanations are pure presentation: no transport, permissions or commands. */
export function cashDifference(counted:string,expected:string,business:RegionalBusiness){
 const difference=BigInt(counted)-BigInt(expected);
 return difference===0n?'El efectivo coincide.':difference<0n?'Faltan '+financeMoney((-difference).toString(),business)+'.':'Sobran '+financeMoney(difference.toString(),business)+'.';
}
export const financeGuides={
 opening:{title:'Antes de recibir efectivo',text:'Abrir caja es anotar cuánto efectivo físico tenés al empezar. Ese dinero puede ser para dar cambio: no es una venta.',steps:['Contá billetes y monedas. Si no hay efectivo, ingresá 0.','Revisá el importe y la caja elegida.','Confirmá. Desde ese momento podés registrar entradas y salidas de efectivo.']},
 closing:{title:'Terminá tu jornada con claridad',text:'Cerrar caja es comparar lo que debería haber con lo que contaste. A esa comparación se le llama arqueo.',steps:['Contá sólo billetes y monedas. No sumes transferencias ni tarjetas.','Escribí el total contado. Si falta o sobra dinero, dejá un motivo.','Revisá y confirmá el cierre. El registro queda conservado; para seguir usando efectivo, abrí otra sesión.']},
};
export const financeQuestions=['¿Cómo funciona el Cierre inteligente?','¿Qué es abrir caja?','¿Cómo cierro la caja?','¿Cómo registro un cobro parcial?','¿Por qué completar un turno no significa cobrarlo?'];
