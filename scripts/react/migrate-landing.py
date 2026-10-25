"""One-time source conversion: approved HTML becomes authored JSX, never runtime HTML."""
from html.parser import HTMLParser
from pathlib import Path
import json,re
class Node:
 def __init__(self,tag='',attrs=None,parent=None):self.tag=tag;self.attrs=dict(attrs or []);self.children=[];self.parent=parent
class Parse(HTMLParser):
 def __init__(self):super().__init__(convert_charrefs=True);self.root=Node();self.stack=[self.root]
 def handle_starttag(self,tag,attrs):
  n=Node(tag,attrs,self.stack[-1]);self.stack[-1].children.append(n)
  if tag not in {'area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr'}:self.stack.append(n)
 def handle_startendtag(self,tag,attrs):self.handle_starttag(tag,attrs);self.handle_endtag(tag)
 def handle_endtag(self,tag):
  for i in range(len(self.stack)-1,0,-1):
   if self.stack[i].tag==tag:self.stack=self.stack[:i];break
 def handle_data(self,data):self.stack[-1].children.append(data)
source=Path('web/descubrir.html').read_text();parser=Parse();parser.feed(source)
def find(node,tag):
 if isinstance(node,str):return None
 if node.tag==tag:return node
 for child in node.children:
  result=find(child,tag)
  if result:return result
body=find(parser.root,'body')
renames={'class':'className','for':'htmlFor','tabindex':'tabIndex','maxlength':'maxLength','autocomplete':'autoComplete','referrerpolicy':'referrerPolicy','viewbox':'viewBox','fetchpriority':'fetchPriority','stroke-width':'strokeWidth','stroke-linecap':'strokeLinecap','stroke-linejoin':'strokeLinejoin'}
void={'img','input','br','hr','source','wbr','area','embed','link','meta'}
def literal(value):return '{'+json.dumps(value,ensure_ascii=False)+'}'
def render(node,depth=1):
 if isinstance(node,str):
  return ''.join('<MarketingIcon kind="'+('arrow' if part=='↗' else 'down')+'"/>' if part in ['↗','↓'] else literal(part) for part in re.split('([↗↓])',node) if part)
 classes=node.attrs.get('class','').split()
 for cls,component in [('screen-tabs','ScreenGallery'),('message-lab','MessageLab'),('identity-lab','IdentityLab'),('demo-picker','DemoPicker')]:
  if cls in classes:return '<'+component+'/>'
 if 'product-view'in classes or 'screen-caption'in classes:return ''
 if 'data-year'in node.attrs:return '<span data-year>{new Date().getFullYear()}</span>'
 tag='Reveal' if 'reveal'in classes else node.tag;attrs=[]
 if tag=='Reveal':attrs.append('as="'+node.tag+'"')
 for key,value in node.attrs.items():
  key=renames.get(key,key)
  if value is None:attrs.append(key);continue
  if key=='style':
   styles={}
   for part in value.split(';'):
    if ':'not in part:continue
    k,v=part.split(':',1);styles[k if k.startswith('--') else re.sub('-([a-z])',lambda m:m[1].upper(),k)]=v
   attrs.append('style={'+json.dumps(styles,ensure_ascii=False)+' as CSSProperties}');continue
  if key in ['width','height','tabIndex','maxLength']:attrs.append(key+'={'+value+'}')
  else:attrs.append(key+'='+literal(value))
 opening='<'+tag+(' '+' '.join(attrs) if attrs else '')
 if node.tag in void:return opening+'/>'
 children=''.join(render(child,depth+1) for child in node.children)
 if node.tag=='article' and node.parent and 'features'in node.parent.attrs.get('class','').split():
  index=[c for c in node.parent.children if isinstance(c,Node)].index(node);children='<div className="feature-icon"><MarketingIcon kind="'+['calendar','route','palette'][index]+'"/></div>'+children
 return opening+'>'+children+'</'+tag+'>'
result="import type {CSSProperties} from 'react';\nimport {MarketingIcon} from './Icon';\nimport {Reveal} from './Reveal';\nimport {ScreenGallery} from './ScreenGallery';\nimport {MessageLab} from './MessageLab';\nimport {IdentityLab} from './IdentityLab';\nimport {DemoPicker} from './DemoPicker';\n// Approved static copy and native React elements. Interactive sections are separate components.\nexport function Landing(){return <>"+'\n'.join(render(child) for child in body.children)+"</>}\n"
Path('frontend/react/src/marketing/Landing.tsx').write_text(result)
head=source[:source.index('<body>')]
head=re.sub(r'<script\b[^>]*>.*?</script>','',head,flags=re.S)
head=re.sub(r'<link rel="stylesheet" href="\./descubrir.css[^\"]*">','',head)
Path('frontend/react/descubrir.html').write_text(head+'<body><div id="root"></div><script type="module" src="/src/marketing/main.tsx"></script></body></html>\n')
