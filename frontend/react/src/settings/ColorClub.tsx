import {useState, type CSSProperties} from 'react';
import {Theme, type ThemeConfig} from '../domain/theme';
import './color-club.css';

type Palette = {name:string;primary:string;secondary:string;accent?:string};
export function ColorClub({draft,rank,disabled,onSelect}:{draft:ThemeConfig;rank:number;disabled:boolean;onSelect:(palette:Palette)=>void}) {
 const [category,setCategory]=useState('Todas');
 const selected=Theme.paletteFor(draft);
 const original=String(draft.primary).toUpperCase()===Theme.palettes.atry.primary&&String(draft.secondary).toUpperCase()===Theme.palettes.atry.secondary;
 return <div className="color-club">
  <button type="button" className="cc-original" aria-pressed={original} disabled={disabled} onClick={()=>onSelect(Theme.palettes.atry)}>
   <span className="cc-classic-sample" aria-hidden="true"><i/><i/></span><span><strong>ATRY Original</strong><small>La identidad clásica de ATRY.</small></span><span className="cc-check" aria-hidden="true">{original?'✓':'↗'}</span>
  </button>
  <header className="cc-heading"><span className="ts-eyebrow">ATRY / COLOR CLUB</span><h3>Encontrá tu combinación.</h3><p>Principal en la navegación, secundario en el fondo y un tercer color para los acentos.</p></header>
  <div className="cc-filters" role="group" aria-label="Categorías de COLOR CLUB">{['Todas','Calma','Energía','Actitud'].map(item=><button type="button" key={item} aria-pressed={category===item} onClick={()=>setCategory(item)}>{item}</button>)}</div>
  {rank===0&&<p className="cc-availability">COLOR CLUB está disponible desde el plan Negocio. Tus colores esenciales siguen en Identidad.</p>}
  <div className="cc-grid">{Theme.colorClub.filter(p=>category==='Todas'||p.category===category).map(p=><button type="button" className="cc-card" key={p.id} aria-label={`${p.name}, ${p.category}. Principal ${p.primary}, secundario ${p.secondary}, acento ${p.accent}`} aria-pressed={selected?.id===p.id} disabled={disabled||rank===0} onClick={()=>onSelect(p)}>
   <span className="cc-swatches" aria-hidden="true" style={{'--cc-primary':p.primary,'--cc-secondary':p.secondary,'--cc-accent':p.accent} as CSSProperties}><i/><i/><i/></span>
   <span className="cc-card-info"><span><strong>{p.name}</strong><small>{p.category}</small></span><span className="cc-check" aria-hidden="true">{selected?.id===p.id?'✓':''}</span></span>
   <span className="cc-hex" aria-hidden="true"><span>{p.primary}</span><span>{p.secondary}</span><span>{p.accent}</span></span>
  </button>)}</div>
  <p className="cc-selection" role="status">{selected?`${selected.name} seleccionada.`:original?'ATRY Original seleccionado.':'Tu combinación personalizada.'}</p>
 </div>;
}
