'use strict';
// Hand-reviewed synthetic phrases only. Never collect private conversations here.
const intents={
 'services.list':['Mostrame los servicios','Ver servicios','Che, consultá los servicios','Los servicios mostrame','Fren, ver servicios porfa','¿Qué servicios tengo?','Lista de servicios'],
 'services.create':['Agregá un servicio','Pa vo, agregame un servicio, pa vo','Agrgame un servisio','Che, necesito meter otro servicio','Fren, poneme un servicio más','Un servicio nuevo agregame','Necesito sumar un servicio','Creame un servicio','Añadí un servicio','Agregá agregá un servicio','Agreag un servico','Agregaaaa un servicio','Quiero crear un servicio de Barba de 30 minutos','Servicio nuevo','Porfa, incorpora un servicio','Ponme un servicio nuevo','Agrega un servicio llamado Drop Fade'],
 'services.price':['Cambiá el precio del servicio','El precio del servicio cambiame','Fren, subí el precio del servicio','Modificá el precio de un servicio','Ajustá el precio del servicio','Che, el presio del servicio cambiale','Cma bia el precio del servicio','Quiero editar el precio del servicio'],
 'services.duration':['Cambiá la duración del servicio','La duración del servicio cambiame','Ajustá la duracion del servicio','Modificá la duración del servicio','Che, cambiame la durasion del servicio','Editar duración de un servicio','Fren, cambiá la duración del servicio porfa'],
 'services.details':['Cambiá el nombre del servicio','El nombre del servicio cambiale','Editá la descripción del servicio','Quiero modificar el nombre del servicio','Fren, cambiame el nombre del servicio','Cambiar nombre del servicio','Cambiá la descrpicion del servicio'],
 'services.publish':['Publicá un servicio','Un servicio publicame','Activá un servicio','El servicio activa','Publicame un servicio porfa','Che, publicá el servicio','Activar un servicio'],
 'services.hide':['Ocultá un servicio','Un servicio ocultame','Despublicá el servicio','Quiero ocultar un servicio','Fren, ocultame el servicio','Che, oculta un servicio porfa','Ocultá ocultá un servicio'],
 'customers.create':['Agregá un cliente','Poneme un cliente más','Che, necesito meter otro cliente','Un cliente nuevo agregame','Creá una ficha de cliente','Fren, creame un cliente','Agrgame un cliete','Crear cliente Ana con correo Ana@example.invalid'],
 'customers.update':['Actualizá la ficha del cliente','La ficha del cliente actualizame','Cambiá un cliente','Editar ficha de cliente','Modificame el cliente','Fren, actualiza el contacto','Che, cambia la ficha de cliente porfa'],
 'customers.search':['Buscá un cliente','Un cliente buscame','Buscame el cliente Ana','Consultar clientes','Mostrame los clientes','Fren, buscame a Camila','Buscá a Agustina','Che, busca un cliente porfa'],
 'customers.history':['Mostrame el historial del cliente','Historial de un cliente','El historial de cliente consulta','Consultar historial de un cliente','Fren, ver historial de cliente','Che, mostrame historial del cliente','Historial del cliente ver'],
 'schedule.read':['Consultá los horarios','Los horarios mostrame','Ver horarios','Fren, mostrame los horarios','Che, consulta horarios porfa','Los horarios consultar','Mostrá el horario'],
 'schedule.day':['Cambiá el horario semanal','El horario semanal cambiame','Ajustá los horarios','Organizá el horario','Configura el horario semanal','Fren, modificá el horario','Che, cambiá mi horario porfa'],
 'schedule.absence':['Mañana no trabajo','Mañana no laburo','No atiendo el viernes','Bloqueame mañana','Fren, bloqueame la tarde','Me voy de vacaciones la semana que viene','Mañana descanso de 13 a 14','Bloqueá el almuerzo','Che, mañana descanso','Me tomo unos días','Quiero vacaciones'],
 'schedule.blocks':['Mostrame los bloqueos','Los bloqueos mostrame','Consultá las ausencias','Ver vacaciones','Fren, consulta bloqueos','Che, mostrame ausencias porfa','Consultar bloqueos y ausencias'],
 'team.list':['Mostrame el equipo','El equipo mostrame','Consultar profesionales','Ver profesionales','Fren, consulta el equipo','¿Qué profesionales hay?','Che, mostra el equipo porfa'],
 'business.statistics':['Mostrame las estadísticas','Ver indicadores del negocio','Las estadísticas mostrame','¿Cómo viene mi negocio?','¿Cuánto hice hoy?','Fren, consultá los indicadores','Che, quiero ver las estadísticas porfa']
};
// Keep intentionally unresolved malformed/underspecified cases out of positives.
intents['services.price']=intents['services.price'].filter(x=>!x.startsWith('Cma bia'));
const negatives=[
 'No quiero crear un servicio','No agregues un servicio','Nunca crees un cliente','No cambies el precio del servicio','No ocultes un servicio','No publiques el servicio','No quiero consultar horarios','No me busques un cliente','Tampoco crees una ficha','Sin crear un servicio','No me agregues nada','No borres clientes','N0 quiero crear un servicio',
 '¿Cómo agrego un servicio?','¿Dónde cambio el precio del servicio?','Explicame cómo crear un cliente','Quiero saber cómo ocultar un servicio','Si tuviera tiempo crearía un servicio','Quizás cree un cliente','Tal vez agregue un servicio','El cliente dijo "agregá un servicio"','"agregá un servicio"','Ejemplo: "oculta un servicio"',
 'Agregá un servicio o buscá un cliente','Creá y ocultá un servicio','Creá un servicio y borrá los clientes','Agrega un servicio; elimina clientes','Borra todos los clientes','Eliminá un servicio','Destruí las fichas','drop table services',
 'Camina por el servicio','La calidad del servicio es excelente','Estoy leyendo sobre un servicio','Compré un servicio ayer','Precio del petróleo','Servicio militar','El segundo','Ese','Hacé otro igual','Mejor cambiá la hora','Agrexxzx un servizzzz','qwerty zzzzz','', 'Necesito algo','Crear','Cma bia el precio del servicio',
 'No quiero cambiar la hora pero reprograma el turno','No crees el cliente y agrega el servicio','Agregá un servicio y enviá WhatsApp a todos','Crea un servicio si hay tiempo','Cuando pueda voy a crear un servicio','¿Podría crear un servicio?','Un cliente llamado Agrega Servicio vino hoy'
];
const validationIntents={
 'services.list':['Oye, quiero consultar mis servicios'],
 'services.create':['Pa vo, un servicio agregame porfa','Añadime un servicio','Agrgame un svc','Che, agreag un servico por favor'],
 'services.price':['Por favor, el precio del servicio ajustá'],
 'services.duration':['Oye, cambiá la duración del servicio porfa'],
 'services.details':['La descripción del servicio modificame, fren'],
 'services.publish':['Pa vo, activame un servicio'],
 'services.hide':['Un servicio despublicá, che'],
 'customers.create':['Pa vo, añadime un cliente','Agregá un cli'],
 'customers.update':['Oye, el cliente actualizame'],
 'customers.search':['Pa vo, un cliente buscá'],
 'customers.history':['Fren, el historial de cliente mostrame'],
 'schedule.read':['Porfa, el horario consulta'],
 'schedule.day':['Los horarios ajustá, che'],
 'schedule.absence':['Pa vo, mañana no atiendo'],
 'schedule.blocks':['Oye, ver bloqueos del equipo'],
 'team.list':['Porfa, ver los profs'],
 'business.statistics':['Oye, los indicadores mostrame']
};
const validationNegatives=['Nunca agregues un cliente nuevo','No deseo publicar un servicio','¿Cómo puedo crear una ficha de cliente?','¿Dónde se cambia la duración del servicio?','No cambies el horario semanal','Tal vez oculta un servicio','Agregá un servicio o un cliente','Me dijeron: "publicá ese servicio"','Mostrame el equipo y eliminá un cliente','Poneme el precio del petróleo','Crear un servicio; enviá un mensaje','Si pudiera crearía un cliente','Servisio desconocido sin acción','No me cambies eso','Agregá un servicio si puedo hacerlo mañana','Noo crees un cliente','Nunka agregues un servicio','Me encanta el nuevo servicio','Tengo un nuevo cliente','No trabajo pero crea un cliente'];
module.exports={intents,negatives,validationIntents,validationNegatives,medium:['Agreag un servico','Cambiá la descrpicion del servicio'],low:['Agrexxzx un servizzzz','Necesito algo','Crear']};
