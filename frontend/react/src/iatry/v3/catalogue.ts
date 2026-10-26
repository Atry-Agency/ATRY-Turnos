import {catalogTools} from './tools-catalog';
import {schedulingTools} from './tools-scheduling';
import {bookingTools} from './tools-bookings';
import {visitTools} from './tools-visits';
import {businessTools} from './tools-business';
import {text,type Capability} from './contracts';
/** A model may propose an ID/arguments in the future; only the conversation's confirmed plan can execute. */
export const capabilities:Capability[]=[...catalogTools,...schedulingTools,...bookingTools,...visitTools,...businessTools].map(tool=>({...tool,...(tool.prepare?{prepare:async(ctx,values)=>{const plan=await tool.prepare!(ctx,values);const details=plan.summary;plan.summary=[];for(const f of tool.fields){const options=typeof f.options==='function'?await f.options(ctx,values):f.options,value=values[f.key],labels=(Array.isArray(value)?value:[String(value??'')]).map(x=>options?.find(o=>o.value===x)?.label||x);plan.summary.push({label:f.label,value:typeof value==='boolean'?(value?'Sí':'No'):labels.join(', ')||'Sin valor'})}plan.summary.push(...details);return plan}}:{})}));
export const exclusions=[
 ['Comercial','Contrataciones, pagos, cambios de plan y habilitaciones','Excluido: requiere autorización comercial específica.'],
 ['Accesos','Invitar, revocar o cambiar roles; administración global','Excluido: cambia permisos o puede generar comunicaciones reales.'],
 ['Eliminación','Borrar reglas, profesionales, fichas, usuarios o negocios','Excluido: no se automatizan eliminaciones irreversibles.'],
 ['Archivos','Subir y recortar fotografías o logotipos','Pendiente: integrar selección de archivo, recorte y validación de Storage sin duplicar el editor existente.'],
 ['Visitas combinadas','Crear una visita con varios servicios desde el asistente','Pendiente: solo existe creación pública protegida por aceptación/captcha; no se inventa una creación privada. Consulta, confirmación, cancelación y reprogramación privada sí están implementadas.'],
 ['Exportación','Descargar CSV de reservas','Pendiente: confirmación y descarga de datos personales en el centro de asistencia.'],
 ['Identidad avanzada','Borrar presets o recortar archivos','Eliminar un estilo guardado o preparar un archivo conserva sus controles específicos; guardar y aplicar presets sí está implementado.'],
 ['Envíos','Abrir WhatsApp, registrar enviado, reintentar correos o enviar avisos','Excluido de esta fase: no se realizan envíos reales.'],
 ['Cuenta','Registro, contraseñas, sesiones, creación de organizaciones','Fuera de la automatización del negocio: requiere sus controles de identidad específicos.']
] as const;
