from pathlib import Path
import json,gzip,re
r=Path(__file__).resolve().parents[2];base=r/'docs/react-migration/full';e=base/'evidence';dist=r/'frontend/react/dist'
perf=json.loads((e/'native-performance.json').read_text());audit=json.loads((e/'pixel-audit-summary.json').read_text());rows=json.loads((e/'pixel-audit.json').read_text())
files=[]
for file in sorted(dist.rglob('*.js')):
 if file.name=='sw.js':continue
 raw=file.read_bytes();files.append({'file':str(file.relative_to(dist)),'bytes':len(raw),'gzip6':len(gzip.compress(raw,compresslevel=6))})
(e/'bundles.json').write_text(json.dumps(files,indent=2));summary=perf['summary'];lines=['# Mediciones verificadas','',f"Comparaciones visuales: {audit['pairs']} pares; {len(audit['sizeMismatch'])} diferencias de dimensiones.",f"Pares idénticos: {sum(x.get('different',-1)==0 for x in rows)}.",'','## Rendimiento local','', '| Mediana / 5 contextos nuevos | Anterior | React |','| --- | ---: | ---: |']
for key,label,scale in [('readyMs','Montaje detectado (ms)',1),('fontsReadyMs','Fuentes tras montaje (ms)',1),('domContentLoadedMs','DOMContentLoaded (ms)',1),('jsTransferBytes','Transferencia JS (kB)',1000),('jsFiles','Solicitudes JS',1),('domNodes','Nodos DOM',1),('heapBytes','Heap JS observado (MB)',1000000)]:lines.append(f"| {label} | {summary['legacy'][key]/scale:.2f} | {summary['react'][key]/scale:.2f} |")
lines+=['','Heap observado sin GC forzado; no equivale al uso total del proceso. Carga local sin throttling ni backend remoto. El ensayo anterior al ajuste de Inicio detectó unos 386 ms de montaje; el ensayo final detecta unos 80 ms. Los resultados brutos finales y el protocolo están en native-performance.json.','','## Bundles','', '| Archivo | Bytes | gzip nivel 6 |','| --- | ---: | ---: |']
for file in files:lines.append(f"| {file['file']} | {file['bytes']} | {file['gzip6']} |")
lines+=['','Los tamaños gzip se calculan sobre archivos; no suponen que el servidor local use compresión HTTP. Los módulos cloud, administración y pantallas secundarias se cargan cuando corresponden.','','## Píxeles','', '| Carpeta | Pares | Exactos | Máximo delta >4 / píxeles |','| --- | ---: | ---: | ---: |']
for folder in sorted({x['folder'] for x in rows}):
 group=[x for x in rows if x['folder']==folder];worst=max((x.get('over4',0)/x.get('pixels',1) for x in group),default=0);lines.append(f"| {folder} | {len(group)} | {sum(x.get('different',-1)==0 for x in group)} | {100*worst:.4f}% |")
(base/'MEDICIONES.md').write_text('\n'.join(lines)+'\n')
