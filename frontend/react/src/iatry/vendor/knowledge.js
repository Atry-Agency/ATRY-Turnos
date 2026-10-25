// IAtry V1.2: original inert body; only ESM packaging adapted.
const version='1.2',steps=['configuracion','servicios','disponibilidad','comunicacion'];
const tips=Object.freeze({
 'configuracion-inicial':{id:'welcome',guideTitle:'Tu negocio empieza acá.',title:'¡Hola! Soy IAtry.',text:'Vamos a revisar tu negocio, servicios y horarios. Vos elegís el ritmo.',target:'.setup-step[href="#/app/configuracion"]',detail:'Entrá en la tarjeta señalada para revisar el nombre y los datos de contacto.',route:'configuracion'},
 configuracion:{id:'identity',guideTitle:'Que tus clientes te reconozcan.',title:'Primero, los datos de tu negocio.',text:'Revisá el nombre y cómo pueden contactarte.',target:'[data-form="save-settings"] input[name="name"]',detail:'Este nombre identifica a tu negocio. Revisá también el contacto y guardá cuando esté listo.',next:'servicios',nextLabel:'Seguir con servicios'},
 servicios:{id:'services',guideTitle:'Lo que van a poder reservar.',title:'Dale forma a tus servicios.',text:'Elegí qué ofrecés, cuánto dura y cuál es su precio.',target:'[data-action="add-service"]',detail:'“Nuevo servicio” abre el formulario. Elegí quién lo ofrece y revisá los datos antes de guardar.',next:'disponibilidad',nextLabel:'Seguir con horarios'},
 disponibilidad:{id:'hours',guideTitle:'Tu semana, a tu medida.',title:'Ahora, los horarios.',text:'Organizá los días y tramos en los que atendés.',target:'[data-action="edit-hours"]',detail:'“Editar semana” define la atención habitual de este profesional. Podés combinar varios tramos.',next:'comunicacion',nextLabel:'Ver comunicación'},
 comunicacion:{id:'communication',guideTitle:'WhatsApp, si lo necesitás.',title:'Un contacto más cercano.',text:'Este paso es opcional. El envío siempre lo decidís vos.',target:'[data-wa-settings]',detail:'Configurá el contacto comercial y los textos. Preparar un mensaje no confirma su envío ni su entrega.',next:'configuracion-inicial',nextLabel:'Volver a mis pasos'}
});
const celebration={id:'service-ready',title:'¡Bien! Tu servicio ya está activo.',text:'Ya hay un servicio activo. Ahora podemos revisar cuándo vas a atender.',detail:'El servicio está verificado en tus datos. Esto todavía no confirma que haya horarios disponibles.',route:'disponibilidad',label:'Revisar horarios',celebrate:true};
function personalName(value){
 const full=String(value||'').trim();
 const first=full.split(/\s+/)[0];
 if(!/^[\p{L}][\p{L}'’-]{1,31}$/u.test(first||''))return '';
 if(/^(propietari[oa]|encargad[oa]|emplead[oa]|usuari[oa]|administrador[ae]?|admin|owner|manager|staff|demo|prueba|test|negocio|equipo|cliente|cuenta|atry)$/i.test(first))return '';
 if(/(?:@|https?:|demo|ejemplo|example|\d)/i.test(full))return '';
 return first;
}
const api={version,steps,tips,celebration,personalName};
export default api;
