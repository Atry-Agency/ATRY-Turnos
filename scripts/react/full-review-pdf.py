from pathlib import Path
from PIL import Image
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor
from reportlab.lib.utils import simpleSplit,ImageReader
import json,re,io
r=Path(__file__).resolve().parents[2];base=r/'docs/react-migration/full';e=base/'evidence';out=r/'output/pdf/React - Revision integral y capturas.pdf';out.parent.mkdir(parents=True,exist_ok=True)
c=canvas.Canvas(str(out),pagesize=(640,820));c.setTitle('ATRY Turnos - React - Revisión integral local y capturas incrustadas');c.setAuthor('ATRY / revisión experimental local');pages=[];images=0

def text(x,y,value,size=11,bold=False,color='#263145'):
 c.setFillColor(HexColor(color));c.setFont('Helvetica-Bold' if bold else 'Helvetica',size);c.drawString(x,y,value)
def header(title,width=640,height=820):
 c.setPageSize((width,height));text(30,height-30,'ATRY TURNOS / REACT / REVISION LOCAL',10,True,'#4754E6');text(30,height-64,title,20,True)
def finish(title,width=640):
 text(30,20,f'{len(pages)+1} / 25-10-2026 / experimental - sin publicación',9,color='#687284');pages.append(title);c.showPage()
def paragraphs(title,values):
 header(title);y=713
 for value in values:
  for line in simpleSplit(value,'Helvetica',11,575):
   if y<65:finish(title);header(title+' (continuación)');y=713
   text(30,y,line);y-=16
  y-=15
 finish(title)
perf=json.loads((e/'native-performance.json').read_text())['summary'];audit=json.loads((e/'pixel-audit-summary.json').read_text());unit=(e/'unit-tests.txt').read_text();unit_count=re.search(r'# pass (\d+)',unit).group(1)
paragraphs('Una aplicación React autónoma',[
'La entrada principal, las veinte rutas privadas, autenticación, reservas públicas, consola administrativa y landing se implementan con React, TypeScript y Vite. El servidor y los empaquetadores entregan la distribución React.',
'Este documento contiene capturas reales incrustadas. Cada comparación identifica referencia JavaScript y React. Los originales completos y los logs permanecen en docs/react-migration/full/evidence/. No hacen falta enlaces externos para ver estas imágenes.',
'El build ordinario excluye el piloto, el puente temporal y los controladores DOM anteriores. Se conservan CSS, recursos, motores de dominio inertes y adaptadores de infraestructura aprobados.',
'No hubo publicación, push, merge, migración remota ni cambios productivos. El trabajo pertenece al worktree experimental feature/react-migration.',
'Conservación comprobada: 324 huellas de main y 589 de IAtry coinciden con el respaldo inicial; sin archivos cambiados ni faltantes. IAtry no está integrado.',
'El informe técnico exhaustivo INFORME.md incluye arquitectura, inventario, contratos, dependencias, seguridad, cambios, mapa de IAtry, ejecución y límites. MEDICIONES.md incluye todos los bundles y cifras auditables.'
])
paragraphs('Resultados verificados',[
'Build TypeScript y Vite aprobado. Regresión de dominio/backend: 243 de 243. Pruebas React: '+unit_count+' de '+unit_count+'. Distribución: 6 de 6 pruebas específicas.',
'Shell: 43 comprobaciones de navegación, planes, menú y borradores. HTTP aislado: cuenta/múltiples negocios, registro/contraseña, invitación/empleado, reservas individuales y visitas.',
'Administración: todas las secciones y operaciones críticas representativas, incluyendo conflicto 409 conservando borrador, pausa de nuevas reservas, suspensión/restablecimiento y cambio global de plan.',
'Reserva con respuesta perdida después de guardar: se reenvía el mismo cuerpo/UUID y queda un único turno. Visitas: cotización, creación, reprogramación y cancelación de todos sus tramos.',
'Cloud: SDK Supabase real y adaptadores existentes con HTTPS interceptado y SQLite en memoria. Contraseña inválida se limpia; la correcta reintenta la operación pendiente una sola vez. Sin proyecto real.',
'Landing: dos demos React, nombre/paleta/vistas y cinco anchos. 105 combinaciones de temas válidos, planes, anchos y tres pantallas representativas.',
'Service worker: instalación, recarga offline y chunks; no cachea API ni URL con parámetros. Preview: no emite solicitudes API. Teclado, foco, pestañas y movimiento reducido: comprobaciones aprobadas.',
f"Auditoría visual: {audit['pairs']} pares y {len(audit['sizeMismatch'])} diferencias de dimensiones. Los máximos residuales y conteos por carpeta están en MEDICIONES.md. Las capturas no equivalen por sí solas a probar todas las interacciones."
])
paragraphs('Arquitectura y contratos',[
'Modelo de aplicación -> almacén externo -> NativeApp/Shell -> FeatureHost -> componentes por función. Los puertos tipados delimitan sesión, negocio, API, capacidades y navegación.',
'La API descarta respuestas de contextos anteriores. Formularios y diálogos tienen guardas de borrador/operación. Se conserva el aislamiento de negocio y la autorización del servidor.',
'Disponibilidad, recursos, cuotas, políticas y cotizaciones siguen validados por el backend. La adaptación local del catálogo de empleado no calcula disponibilidad ni amplía permisos.',
'Las fotos conservan validación y optimización WebP. Sus Blob URL se revocan al desmontar, reemplazar o descartar respuestas tardías.',
'Los CRUD originales sin idempotencia de creación mantienen esa limitación. Tras una respuesta incierta debe verificarse el listado antes de repetir manualmente. El cliente no promete deduplicación que el servidor no ofrece.',
'Los paquetes se construyen desde una lista cerrada de archivos. Rechazan claves secretas y JWT privilegiados; no incluyen servidor, bases ni archivos de entorno.',
'IAtry: pueden reutilizarse selección/análisis, textos y memoria. El controlador y el movimiento necesitan hooks/refs y adaptación al modelo React. Avatar HTML pasa a JSX; los destinos de conocimiento necesitan anclas estables. Ningún módulo experimental fue reescrito.'
])
paragraphs('Rendimiento y limitaciones',[
'Protocolo: cinco contextos nuevos de Chrome headless por interfaz, demo Pro, 1440 x 960, sin throttling y con service workers bloqueados. Son medidas locales de laboratorio.',
f"Montaje mediano: anterior {perf['legacy']['readyMs']:.1f} ms; React {perf['react']['readyMs']:.1f} ms. DOMContentLoaded: {perf['legacy']['domContentLoadedMs']:.1f} / {perf['react']['domContentLoadedMs']:.1f} ms.",
f"JavaScript transferido: {perf['legacy']['jsTransferBytes']/1000:.1f} / {perf['react']['jsTransferBytes']/1000:.1f} kB; scripts: {perf['legacy']['jsFiles']} / {perf['react']['jsFiles']}. Heap observado: {perf['legacy']['heapBytes']/1000000:.2f} / {perf['react']['heapBytes']/1000000:.2f} MB, sin GC forzado.",
'La primera variante diferida de Inicio montaba alrededor de 386 ms. Cargar Inicio directamente eliminó la espera de Suspense. Se mantuvo la separación de módulos secundarios. React reduce transferencia pero añade memoria y algo de montaje respecto al script anterior.',
'No se probaron un Supabase desplegado, correo/Turnstile reales, un flujo PKCE completo con proveedor real, Safari/Firefox o dispositivos físicos. Las pruebas de accesibilidad son acotadas; no son certificación WCAG ni sustituyen lector de pantalla.',
'La matriz de temas usa pantallas representativas; no cubre el producto cartesiano de todas las rutas, errores y dispositivos. Los comandos administrativos destructivos no se ejecutaron contra servicios reales.',
'Recomendación: revisar y aceptar localmente la implementación; no sustituir producción sin ensayo autorizado de staging y navegadores objetivo. Se conserva CLOUD_BACKEND_VALIDATED=1 como requisito para activar cloud en un paquete público.',
'Ejecución: npm ci; npm ci --prefix frontend/react; npm run build; npm run test:react; npm test; npm run dev:react. Demo aislada en 127.0.0.1:3321/?demo=1&plan=3#/app/inicio.'
])
# Desktop representatives: one highest available plan for each distinct scene.
chosen=[]
folders=['customers','pages','additional-pages','notifications','scheduling','access-support','team','subscription','settings','account','agenda','native-public','native-admin','native-shell']
for folder in folders:
 prefix='legacy-' if folder=='native-shell' else 'javascript-';groups={}
 for file in sorted((e/folder).glob(prefix+'*1440*.png')):
  key=re.sub(r'-[123]-1440','-PLAN-1440',file.name);key=re.sub(r'-p[123]-1440','-PLAN-1440',key)
  groups.setdefault(key,[]).append(file)
 for group in groups.values():chosen.append(group[-1])
# Additional widths and plans shown explicitly, without replicating the entire 500-pair archive.
for folder,name in [('native-shell','legacy-inicio-1-390.png'),('native-shell','legacy-agenda-2-320.png'),('native-shell','legacy-configuracion-3-430.png'),('native-shell','legacy-agenda-3-768.png'),('native-public','javascript-single-initial-1-390.png'),('native-public','javascript-visit-initial-3-390.png'),('native-admin','javascript-correos-390.png'),('native-admin','javascript-configuracion-320.png'),('team','javascript-equipo-3-390.png'),('settings','javascript-identity-3-390.png')]:
 file=e/folder/name
 if file.exists():chosen.append(file)
manifest=[]
for file in chosen:
 other=file.with_name(file.name.replace('legacy-' if file.parent.name=='native-shell' else 'javascript-','react-',1))
 if not other.exists():continue
 a,b=Image.open(file),Image.open(other);scale=.5;w=max(640,(a.width+b.width)*scale+90);h=max(550,max(a.height,b.height)*scale+140);title=file.parent.name+' / '+file.stem.replace('javascript-','').replace('legacy-','');header(title,w,h)
 text(30,h-91,'REFERENCIA JAVASCRIPT',10,True);text(60+a.width*scale,h-91,'REACT',10,True)
 c.drawImage(str(file),30,h-110-a.height*scale,width=a.width*scale,height=a.height*scale);c.drawImage(str(other),60+a.width*scale,h-110-b.height*scale,width=b.width*scale,height=b.height*scale);images+=2
 text(30,43,'Capturas completas incrustadas. Ampliar el PDF para revisar texto y controles.',9,color='#687284');finish(title,w);manifest.append({'javascript':str(file.relative_to(r)),'react':str(other.relative_to(r))})
# Landing is tiled with overlap into readable paired pages; no section is omitted.
landing=[e/'native-marketing'/f'{variant}-landing-390.png' for variant in ['javascript','react']]
if all(file.exists() for file in landing):
 originals=[Image.open(file).convert('RGB') for file in landing];step=1000;overlap=60
 for index,top in enumerate(range(0,max(img.height for img in originals),step)):
  tiles=[img.crop((0,top,img.width,min(top+step+overlap,img.height))) for img in originals];scale=.65;w=640;h=max(550,max(img.height for img in tiles)*scale+140);title=f'Landing / 390 px / tramo {index+1}';header(title,w,h)
  for column,img in enumerate(tiles):
   x=40+column*300;text(x,h-91,'REFERENCIA JAVASCRIPT' if column==0 else 'REACT',10,True);c.drawImage(ImageReader(img),x,h-110-img.height*scale,width=img.width*scale,height=img.height*scale);images+=1
  text(30,43,'Tramos consecutivos con 60 px de solapamiento; capturas completas en evidence/.',9,color='#687284');finish(title,w)
for name in ['identity-390.png','theme-3-dark-390.png','theme-3-contrast-1440.png','native-admin-http.png']:
 file=e/name
 if not file.exists():continue
 img=Image.open(file);scale=min(.7,1000/img.width);w=max(640,img.width*scale+60);h=max(550,img.height*scale+140);title='Validación React / '+name;header(title,w,h);c.drawImage(str(file),(w-img.width*scale)/2,55,width=img.width*scale,height=img.height*scale);images+=1;finish(title,w)
c.save();(e/'pdf-manifest.json').write_text(json.dumps({'file':str(out.relative_to(r)),'pages':len(pages),'embeddedImages':images,'comparisons':manifest,'pageTitles':pages},indent=2));print(out,len(pages),'pages',images,'images')
