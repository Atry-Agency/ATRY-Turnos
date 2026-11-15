'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{buildSync}=require('esbuild');
const root=path.resolve(__dirname,'../..'),temp=fs.mkdtempSync(path.join(os.tmpdir(),'atry-navigation-icons-'));
try{
 const paths=['frontend/react/src/marketing/Landing.tsx','frontend/react/src/marketing/Icon.tsx','web/descubrir.html','web/descubrir.js','web/descubrir.css'];
 for(const p of paths)assert(!fs.readFileSync(path.join(root,p),'utf8').includes('M7 17 17 7M7 7h10v10'),p+' must not restore the repeated diagonal SVG');
 buildSync({stdin:{contents:"import {renderToStaticMarkup} from 'react-dom/server';import {Landing} from './src/marketing/Landing';export const render=()=>renderToStaticMarkup(<Landing/>);",resolveDir:path.join(root,'frontend/react'),loader:'tsx'},outfile:path.join(temp,'landing.cjs'),bundle:true,platform:'node',format:'cjs',jsx:'automatic',loader:{'.css':'empty','.svg':'dataurl','.jpg':'dataurl'}});
 globalThis.window={AtryWhatsApp:require(path.join(root,'web/whatsapp-core.js'))};globalThis.matchMedia=()=>({matches:true});globalThis.document={querySelector:()=>null};globalThis.location={hostname:'atryturnos.com',href:'http://127.0.0.1:3360/descubrir.html',origin:'http://127.0.0.1:3360'};globalThis.localStorage={getItem:()=>null};const html=require(path.join(temp,'landing.cjs')).render();assert(!html.includes('M7 17 17 7M7 7h10v10'));assert(!html.includes('↗'));assert(!html.includes('→'));assert(!html.includes('<b></b>'));
 const links=[...html.matchAll(/<a\b[^>]*\bhref="([^"]*)"/g)].map(x=>x[1].replaceAll('&amp;','&'));
 const baseline=JSON.parse(fs.readFileSync(path.join(root,'scripts/react/fixtures/landing-navigation-before-icons.json'),'utf8'));
 assert.deepEqual(links,baseline,'All published destinations and their order remain intact');
 for(const file of ['frontend/react/src/iatry/v3/OperationalPanel.tsx','frontend/react/src/iatry/v3/InstructionPlan.tsx'])assert.match(fs.readFileSync(path.join(root,file),'utf8'),/aria-label="Enviar (?:mensaje|respuesta)"[^>]*><PanelIcon name="arrow"\/>/,'Send controls retain their necessary icon');
 const shell=fs.readFileSync(path.join(root,'frontend/react/src/app/Shell.tsx'),'utf8');assert.match(shell,/icon\('calendar'\)\} Reservar/);assert.match(shell,/workspace-switch-chevron/);
 console.log('PASS navigation iconography: repeated diagonal absent from React and legacy sources; no decorative glyph arrows; all '+links.length+' destinations retained; necessary send and workspace controls preserved');
}finally{fs.rmSync(temp,{recursive:true,force:true})}
