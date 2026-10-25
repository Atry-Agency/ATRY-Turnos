from PIL import Image, ImageChops
from pathlib import Path
import json
base=Path('docs/react-migration/full/evidence')
results=[]
for folder in ['customers','pages','additional-pages','notifications','scheduling','access-support','team','subscription','settings','account','agenda']:
 for a in sorted((base/folder).glob('javascript-*.png')):
  b=a.with_name(a.name.replace('javascript-','react-',1))
  if not b.exists():continue
  x,y=Image.open(a).convert('RGB'),Image.open(b).convert('RGB')
  if x.size!=y.size:results.append(dict(folder=folder,file=a.name,size=[x.size,y.size]));continue
  d=ImageChops.difference(x,y);r,g,bb=d.split();m=ImageChops.lighter(ImageChops.lighter(r,g),bb);hist=m.histogram();results.append(dict(folder=folder,file=a.name,pixels=x.width*x.height,different=sum(hist[1:]),over4=sum(hist[5:]),bbox=d.getbbox()))
(base/'pixel-audit.json').write_text(json.dumps(results,indent=2))
print(json.dumps({'pairs':len(results),'sizeMismatch':[r for r in results if 'size'in r],'largest':sorted([r for r in results if 'over4'in r],key=lambda r:r['over4']/r['pixels'],reverse=True)[:8]},indent=2))
