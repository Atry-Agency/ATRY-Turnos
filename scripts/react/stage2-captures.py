from pathlib import Path
import json,statistics,gzip
from PIL import Image
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor
from reportlab.lib.utils import simpleSplit
r=Path(__file__).resolve().parents[2];p=r/'docs/react-migration/stage2/evidence';q=json.loads((p/'qa.json').read_text());rows=json.loads((p/'pixels.json').read_text());out=r/'output/pdf/React - Etapa 2 - Servicios y comparativas.pdf';out.parent.mkdir(parents=True,exist_ok=True);c=canvas.Canvas(str(out),pagesize=(640,820));c.setTitle('ATRY Turnos - Etapa 2 - Servicios React y comparativas');total=len(rows)+2

def text(x,y,value,size=11,color='#273248',bold=False):
 c.setFillColor(HexColor(color));c.setFont('Helvetica-Bold' if bold else 'Helvetica',size);c.drawString(x,y,value)
def para(value,y,size=11,width=550):
 for line in simpleSplit(value,'Helvetica',size,width):text(40,y,line,size);y-=size+6
 return y-12
def header(title):text(40,778,'ATRY TURNOS / MIGRACION REACT',11,'#4754E6',True);text(40,735,title,25,bold=True)
def footer(page):text(40,25,f'Etapa 2 / local experimental / {page} de {total}',9,'#64748B')
header('Servicios: primera pantalla React')
y=695
for value in [
'Lista, alta, edicion, activacion, desactivacion, profesionales y formulario son React nativo. Se eliminaron el observador y el doble render de la etapa 1.',
'Primitivas: Button, TextField, SelectField, Card, Badge, Feedback, Modal y Confirmation. Se conservan CSS, iconos y estilos aprobados.',
'Quedan compartidos: shell, router, autenticacion, transporte API/cloud, cache, realtime, temas y notificaciones. Backend, permisos y reglas de reserva permanecen sin cambios.',
'Validacion: 241 pruebas heredadas + 11 nuevas; 13 controles funcionales de navegador + 3 de carga/foco/bfcache; 6 comprobaciones HTTP con SQLite aislado. Sin errores de consola.',
'Conservacion visual: 53 pares / 106 capturas incrustadas. Tres planes, modo oscuro, tema personalizado y anchos 320/390/430/768/1440. Tambien se muestra el boton Guardar tras desplazar los dialogos moviles.',
f"44 pares son identicos pixel a pixel. Diferencia maxima bruta: {max(row['differentPixels'] for row in rows)} pixeles; hasta {max(row['pixelsChannelDeltaAbove4'] for row in rows)} con diferencia de canal mayor a 4. Bordes/rasterizacion, sin cambios de medidas o CSS.",
'Produccion e IAtry V1.2 permanecen intactos. Sin publicacion, merge, cambios productivos ni migraciones remotas. Se detiene aqui para revision.',
'Documentacion: docs/react-migration/stage2/LEEME.md. Incluye arquitectura, resultados, pendientes y recomendacion fundamentada de Clientes como siguiente pantalla.'
]:y=para(value,y)
footer(1);c.showPage();c.setPageSize((640,820));header('Rendimiento y limites')
text(40,692,'Medianas locales - 5 muestras por variante',12,bold=True);text(380,662,'JavaScript',10,bold=True);text(490,662,'React',10,bold=True)
metrics=[('renderMs','Carga hasta pantalla lista (ms)',1),('dialogMs','Apertura de dialogo (ms)',1),('inputMs','Interaccion con nombre (ms)',1),('saveMs','Guardar y cerrar (ms)',1),('navigationMs','Navegar a Clientes (ms)',1),('returnMs','Volver a Servicios (ms)',1),('requestCount','Solicitudes iniciales',1),('initialJavaScriptBytes','JavaScript cargado (kB)',1000),('usedHeapAfterGcBytes','Heap tras ciclos y GC (MB)',1000000),('cpuScriptMs','CPU script del recorrido (ms)',1),('layoutMs','CPU layout del recorrido (ms)',1)]
y=637
for key,label,divisor in metrics:
 text(40,y,label,10)
 for x,variant in [(380,'javascript'),(490,'react')]:text(x,y,f"{statistics.median(v[key] for v in q['performance'] if v['variant']==variant)/divisor:.2f}",10)
 y-=23
bundle=(r/'frontend/react/dist/pilot.js').read_bytes();y-=18
for value in [
f'Bundle React/DOM/pantalla: {len(bundle):,} bytes crudos; {len(gzip.compress(bundle,compresslevel=6)):,} gzip nivel 6. Se agrega al frontend heredado completo. No se incorporaron dependencias adicionales.',
'Calentamiento previo y orden alternado JS/React. Los tiempos incluyen automatizacion; el heap es memoria JavaScript tras GC, no RSS total. CPU script/layout cubre el recorrido completo, no una llamada de render aislada.',
'Supabase productivo no fue contactado: su latencia no esta medida. Se probaron el adaptador cloud simulado y la regresion PostgreSQL embebida. Staging autorizado y Safari/dispositivos fisicos quedan pendientes antes de publicar.',
'Una creacion con respuesta perdida sigue requiriendo cuidado: el backend no ofrece idempotencia de POST de servicios. El cliente bloquea envios simultaneos; no se modifico ese contrato.'
]:y=para(value,y,size=10)
footer(2);c.showPage()
for number,row in enumerate(rows,3):
 w,h=row['dimensions'];scale=.5;pw=max(520,w*2*scale+80);ph=h*scale+140;c.setPageSize((pw,ph));text(25,ph-30,'ATRY TURNOS / SERVICIOS / JAVASCRIPT Y REACT',12,'#4754E6',True)
 scene={'list':'Listado','dialog':'Formulario - inicio','bottom':'Formulario movil - Guardar visible'}[row['kind']];text(25,ph-52,f"{row['name']} / {w} x {h} px / {scene}",10);text(25,ph-78,'Referencia JavaScript',11,bold=True);text(pw/2+10,ph-78,'Servicios React',11,bold=True)
 c.drawImage(str(p/row['javascript']),25,40,width=w*scale,height=h*scale);c.drawImage(str(p/row['react']),pw/2+10,40,width=w*scale,height=h*scale);text(25,18,f"{number}/{total} - Diferencia bruta: {row['differentPixels']} pixeles - delta de canal >4: {row['pixelsChannelDeltaAbove4']}",9);c.showPage()
c.save();print(out)
