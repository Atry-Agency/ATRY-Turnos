from pathlib import Path
import json,re
from reportlab.platypus import SimpleDocTemplate,Paragraph,Spacer,PageBreak,Image,Table,TableStyle
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib import colors
from reportlab.lib.utils import ImageReader
from pypdf import PdfReader
R=Path.cwd(); E=R/'docs/react-iatry-validation/evidence'; O=R/'output/pdf/ATRY - Resumen tecnico React e IAtry.pdf'; O.parent.mkdir(parents=True,exist_ok=True)
s=getSampleStyleSheet(); s['Normal'].fontSize=10;s['Normal'].leading=15;s['Title'].textColor=colors.HexColor('#174b57');s['Heading1'].textColor=colors.HexColor('#174b57')
st=[]
def p(t):st.append(Paragraph(t,s['Normal']));st.append(Spacer(1,10))
def h(t):st.append(Paragraph(t,s['Heading1']));st.append(Spacer(1,10))
def page():st.append(PageBreak())
def table(rows):
 t=Table([[Paragraph(str(c),s['Normal']) for c in row] for row in rows],colWidths=[180,325]);t.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),colors.HexColor('#edf5f5')),('VALIGN',(0,0),(-1,-1),'TOP'),('BOTTOMPADDING',(0,0),(-1,-1),9),('TOPPADDING',(0,0),(-1,-1),8),('LINEBELOW',(0,0),(-1,-1),.3,colors.HexColor('#cbd8db'))]));st.append(t)
st.append(Paragraph('ATRY Turnos',s['Title']));h('React + IAtry V1.2');p('Resumen técnico de entrega experimental | 25 de octubre de 2026')
p('<b>Resultado:</b> IAtry integrado al árbol de React, con guía contextual sobre controles reales, memoria por usuario y negocio, identidad original y siete fases de animación verificadas. La entrega permanece local en <b>codex/react-iatry-consolidation</b>.')
p('La validación funcional con datos ficticios pasó en Chromium y WebKit. Esto permite revisar la integración local; no acredita una validación completa contra Supabase ni una aprobación para publicar.')
h('Alcance y conservación');p('Base React: 9f26a36. Base de main: 9a5a0d6. Se preservó el checkout original de IAtry, incluidos sus cambios existentes. Verificación de conservación: 324 archivos de ATRY-Turnos y 589 de la integración original, sin diferencias respecto de las huellas guardadas.')
p('No se publicó, no se modificó producción y no se ejecutaron escrituras en el proyecto Supabase productivo lmdranjpocslqubqhrvb. La revisión del dashboard quedó sin sesión autenticada. No se enviaron mensajes reales.')
h('Organización técnica');p('Provider y hooks propios de React coordinan contexto, referencias, diálogos y preparación de datos. Los portales ubican al asistente dentro del flujo de la página. Se reutilizaron las reglas, textos y memoria originales mediante módulos ESM; el emblema oficial se conserva.')
p('Código: frontend/react/src/iatry/. Evidencias y resultados: docs/react-iatry-validation/evidence/. El harness aislado de Supabase está en scripts/react-iatry/ y bloquea explícitamente el proyecto productivo.')
page();h('Resultados verificables')
reg=(E/'regression.txt').read_text();m=re.search(r'# tests (\d+).*?# pass (\d+).*?# fail (\d+)',reg,re.S)
regtxt=f'{m[2]}/{m[1]} aprobadas; {m[3]} fallos.' if m else 'Ejecución final sin cierre confirmado; consultar regression.txt.'
table([['Comprobación','Resultado y alcance'],['Regresión local',regtxt],['Unitarias React','32/32 aprobadas en la ejecución registrada.'],['TypeScript / build','Comprobación de tipos aprobada. Build de producción local generado correctamente.'],['IAtry funcional','8 comprobaciones por motor: Chromium y WebKit. Las 7 fases observadas; sin errores JS en los flujos cubiertos.'],['Responsive y roles','30 combinaciones de motor, plan y ancho; 4 comprobaciones de rol. Anchos de 320 a 1440 px, sin desbordamiento horizontal.'],['Safari macOS','Smoke manual: ayuda, guía sobre control real y configuración con foco. No equivale a la suite completa.'],['Consultas de IAtry','Sin consultas adicionales propias del asistente en los recorridos registrados. Datos de demostración ficticios.']])
p('Se verificaron: ocultación durante diálogos, respeto de movimiento reducido, pausa fuera de pantalla, memoria tras recarga, desactivación, ayuda manual, navegación con cambios sin guardar y ausencia del asistente en la reserva pública.')
h('Correcciones relevantes');p('Se esperó a que los datos y controles estuvieran listos antes de mostrar la bienvenida. Se estabilizaron las referencias de los destinos y se agregó una alternativa hacia la pestaña real cuando el control deja de estar disponible.')
p('La celebración depende de una transición confirmada a servicio activo. Al completar el recorrido el asistente vuelve al reposo, sin reiniciar una bienvenida. La limpieza de aria-describedby conserva los identificadores de validación agregados por otros componentes.')
p('Los diálogos ocultan al asistente para evitar interferencias. El movimiento se pausa con la página oculta o fuera del área visible. La versión final incluye un reflejo blanco estático en el borde; las capturas y el video preceden ese ajuste menor de CSS.')
page();h('Rendimiento y pendientes')
f=E/'performance.json'
if f.exists():
 d=json.loads(f.read_text());p('Medianas de 5 contextos nuevos por variante, Chrome local, 1440 x 960, sin limitación artificial. Comparación de JavaScript original, IAtry original y React con IAtry. Son mediciones locales, sensibles a carga del equipo; no un SLA.')
 rows=[['Métrica','JavaScript / IAtry original / React + IAtry']]
 for key,label in [('readyMs','Inicio listo (ms)'),('navigationMs','Navegar a servicios (ms)'),('openMs','Abrir formulario (ms)'),('cpuTaskMs','CPU tareas del recorrido (ms)'),('heapAfterGcBytes','Heap JS tras GC (MiB)'),('idleTaskMsPer2Seconds','CPU reposo por 2 s (ms)')]:
  vals=[d['summary'][v][key] for v in ['javascript','javascript-iatry','react-iatry']];vals=[v/1048576 for v in vals] if key=='heapAfterGcBytes' else vals;rows.append([label,' / '.join(f'{v:.1f}' for v in vals)])
 table(rows);p('CPU obtenida por CDP; memoria del heap JS después de recolección explícita, no memoria total del proceso ni GPU. Disponibilidad usa el adaptador demo y no representa latencia real de Supabase. La navegación pública se inicia en un documento nuevo para respetar la protección de formularios modificados.')
else:p('La comparación ampliada de rendimiento no quedó completada. No se atribuye una mejora cuantitativa a React. El registro del intento se conserva para diagnóstico.')
h('Pendientes antes de aprobar producción');p('<b>Supabase aislado:</b> falta un proyecto desechable con configuración y credenciales de prueba. Cero comprobaciones ejecutadas contra Supabase real. El harness preparado cubre RLS, roles, reservas concurrentes, cuotas y Storage; todavía requiere ejecución y revisión en ese entorno.')
p('<b>Firefox:</b> el navegador descargado no logró iniciar en este entorno por fallos gráficos y de sandbox. No se desactivaron protecciones. Pendiente ejecutar la suite en un equipo compatible.')
p('<b>Dispositivos físicos:</b> no probados. Los anchos móviles corresponden a emulación; WebKit automatizado no equivale a Safari en iPhone.')
p('<b>Cierre:</b> no se repitieron matrices visuales ni se generaron comparativas exhaustivas. La evidencia anterior se conserva como histórica. El siguiente paso para habilitar una decisión de publicación es cerrar backend aislado y navegadores/dispositivos pendientes.')
for title,names in [('IAtry en funcionamiento - presentación y guía',['chromium-welcome.png','chromium-identity.png']),('IAtry en funcionamiento - celebración y preferencias',['chromium-celebration.png','chromium-preferences.png'])]:
 page();h(title); imgs=[]
 for name in names:
  path=E/name;w,hh=ImageReader(str(path)).getSize();scale=min(240/w,565/hh);imgs.append(Image(str(path),width=w*scale,height=hh*scale))
 st.append(Table([imgs],colWidths=[252,252],style=TableStyle([('VALIGN',(0,0),(-1,-1),'TOP')])));p('Capturas reales de la ejecución Chromium con datos ficticios. Se incluyen las imágenes dentro de este PDF.')
 if 'preferencias' in title:p('Video complementario: IAtry-React-Primeros-pasos.webm. Grabación existente de la interfaz, 11,84 segundos, 390 x 844 px, 25 fps. Muestra el recorrido y las fases de movimiento e interacción. No se volvió a grabar.')
def footer(c,d):
 c.setFont('Helvetica',8);c.setFillColor(colors.HexColor('#587078'));c.drawString(44,26,'ATRY | Entrega experimental local | Sin publicación');c.drawRightString(550,26,str(d.page))
SimpleDocTemplate(str(O),pagesize=(595,842),rightMargin=44,leftMargin=44,topMargin=40,bottomMargin=44).build(st,onFirstPage=footer,onLaterPages=footer)
r=PdfReader(O);print(O);print('pages',len(r.pages),'image placements',sum(len(p.images) for p in r.pages))
