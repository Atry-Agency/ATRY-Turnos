from pathlib import Path
import re,json,hashlib
r=Path(__file__).resolve().parents[2];web=r/'web';files={}
for p in sorted(web.glob('*')):
 if p.suffix not in ['.js','.html','.css']:continue
 t=p.read_text();files[p.name]={'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'functions':re.findall(r'(?:async\s+)?function\s+(\w+)',t),'actions':sorted(set(re.findall(r'data-(?:action|workspace|commercial|cc-action)=["\x27]([\w-]+)',t))),'forms':sorted(set(re.findall(r'data-(?:form|visit-form)=["\x27]([\w-]+)',t)))}
views=re.findall(r"(?:if|else if)\(view==='([^']+)'",(web/'app.js').read_text());admin=re.search(r'const ccSections=(\{.+?\});',(web/'control-center.js').read_text()).group(1)
result={'referenceCommit':'c626238','htmlEntries':[p.name for p in web.glob('*.html')],'appViews':list(dict.fromkeys(views)),'publicRoutes':['/','/login','/registro','/cuenta-nueva','/cuenta','/recuperar','/restablecer/:token','/reservar/:slug','/gestionar/:token','/oferta/:token','/invitacion/:token'],'adminSections':re.findall(r"(\w+):'([^']+)'",admin),'files':files}
(r/'docs/react-migration/full/inventory.json').write_text(json.dumps(result,indent=2,ensure_ascii=False));print('Entradas',result['htmlEntries'],'vistas',result['appViews'],'secciones admin',len(result['adminSections']))
