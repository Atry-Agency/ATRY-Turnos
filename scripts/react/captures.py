from pathlib import Path
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor
from PIL import Image
import json
r=Path(__file__).resolve().parents[2];p=r/'docs/react-migration/evidence';out=r/'output/pdf';out.mkdir(parents=True,exist_ok=True)
rows=json.loads((p/'pixel-comparison.json').read_text());c=canvas.Canvas(str(out/'React - Primera etapa y capturas comparativas.pdf'),pagesize=(640,820));c.setTitle('ATRY Turnos - Primera etapa React')
def text(x,y,t,size=11,color='#273248'):
 c.setFillColor(HexColor(color));c.setFont('Helvetica',size);c.drawString(x,y,t)
text(40,760,'ATRY TURNOS / MODERNIZACION REACT',12,'#4754E6');text(40,712,'Primera etapa experimental',28);text(40,680,'Arquitectura, conservacion y prueba visual',16)
lines=['Base: origin/main 9a5a0d6 - 24/10/2026','Rama: feature/react-migration / worktree independiente','','Produccion limpia. IAtry V1.2 preservado y respaldado.','React + TypeScript + Vite: tarjeta de servicio nativa.','El panel, formularios y resto del producto siguen en JavaScript.','','241 pruebas originales y 2 unitarias del componente aprobadas.','Pruebas de editar, ocultar, publicar, dialogo y navegacion aprobadas.','16 pares de capturas: tres planes y cinco anchos, mas tema Pro.','Todas las imagenes estan incrustadas en este PDF.','','Bundle adicional: aproximadamente 78 kB gzip.','Los tiempos locales no miden la latencia de Supabase.','La convivencia React/legacy agrega trabajo y debe retirarse por etapas.','','Documentos tecnicos: docs/react-migration/LEEME.md','Incluyen matriz, mapa, riesgos, etapas y resultados brutos.','','Sin publicacion, merge ni cambios de backend/RLS.','La conversion se detiene aqui para revision.']
y=636
for line in lines:text(40,y,line,11);y-=23
c.showPage()
for num,row in enumerate(rows,2):
 a=Image.open(p/row['javascript']);w,h=a.size;scale=.5;pw=max(520,w*2*scale+80);ph=h*scale+140;c.setPageSize((pw,ph));text(25,ph-30,'ATRY TURNOS / JAVASCRIPT Y REACT',12,'#4754E6');text(25,ph-52,row['javascript'].replace('javascript-','').replace('.png','')+f' | {w} x {h} px | fecha y datos identicos',10);text(25,ph-78,'Referencia JavaScript',11);text(pw/2+10,ph-78,'Tarjetas React / shell original',11)
 c.drawImage(str(p/row['javascript']),25,40,width=w*scale,height=h*scale);c.drawImage(str(p/row['react']),pw/2+10,40,width=w*scale,height=h*scale);text(25,18,f"Pagina {num} / 17 - Diferencia: {row['differentPixels']} pixeles - captura completa",9);c.showPage()
c.save();print(out/'React - Primera etapa y capturas comparativas.pdf')
