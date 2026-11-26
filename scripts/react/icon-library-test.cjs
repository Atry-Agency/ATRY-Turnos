'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{buildSync}=require('esbuild'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'../..'),temp=fs.mkdtempSync(path.join(os.tmpdir(),'atry-official-icons-'));
try{
 execFileSync(process.execPath,[path.join(__dirname,'build-icon-library.cjs'),'--check'],{stdio:'inherit'});
 const output=path.join(temp,'icons.cjs');buildSync({stdin:{contents:`import {renderToStaticMarkup} from 'react-dom/server';import {icon,iconAliases,sectorIcon} from './src/domain/icons';import {lucideGlyphs} from './src/domain/icon-library/glyphs';import {PanelIcon} from './src/iatry/v3/PanelIcon';import {BusyMark} from './src/ui/PanelSkeleton';export {icon,iconAliases,sectorIcon,lucideGlyphs};export const render=()=>renderToStaticMarkup(<><PanelIcon name="service-create"/><BusyMark/></>);`,resolveDir:path.join(root,'frontend/react'),loader:'tsx'},outfile:output,bundle:true,platform:'node',format:'cjs',jsx:'automatic',loader:{'.css':'empty'}});
 const m=require(output);for(const[name,official]of Object.entries(m.iconAliases)){assert.ok(m.lucideGlyphs[official],name);assert.equal(m.icon(name),m.lucideGlyphs[official]);}
 assert.notEqual(m.icon('grid'),m.lucideGlyphs['layout-grid']);assert.equal(m.icon('grid'),m.lucideGlyphs.house);
 for(const[sector,expected]of [['Uñas','nail'],['Pestañas','eye'],['Costura','thread'],['Peluquería','hairdryer'],['Barbería','scissors'],['Bienestar','wellness'],['Otra actividad','craft']])assert.equal(m.sectorIcon(sector),expected);
 assert.equal(m.icon('unknown'),m.lucideGlyphs.info);const html=m.render();assert.match(html,/data-icon="service-create"/);assert.match(html,/data-icon-motion="spin"/);assert.match(html,/focusable="false"/);assert.match(html,/aria-hidden="true"/);assert.ok(!/https?:|<image|<use/.test(html));
 console.log('PASS official icons: all semantic aliases, sector mappings, safe decorative SVGs, IAtry metadata and busy feedback; no external runtime');
}finally{fs.rmSync(temp,{recursive:true,force:true})}
