'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../../frontend/react/src/domain/icon-library');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'sources.json'),'utf8'));
const glyphs={};
for(const entry of manifest.icons){
 const raw=fs.readFileSync(path.join(root,entry.name+'.svg'),'utf8');
 if(crypto.createHash('sha256').update(raw).digest('hex')!==entry.sha256)throw Error('Modified upstream icon: '+entry.name);
 if(!/viewBox="0 0 24 24"/.test(raw)||/<(?:script|foreignObject|image|use)\b|\bon\w+=|\bhref=/i.test(raw))throw Error('Unsafe SVG: '+entry.name);
 glyphs[entry.name]=raw.replace(/^[\s\S]*?<svg\b[^>]*>/,'').replace(/<\/svg>\s*$/,'').trim();
}
const content='/* Generated from pinned official SVGs. Run node scripts/react/build-icon-library.cjs. */\nexport const lucideGlyphs:Readonly<Record<string,string>>=Object.freeze('+JSON.stringify(glyphs,null,2)+');\n';
const target=path.join(root,'glyphs.ts');
if(process.argv.includes('--check')){if(fs.readFileSync(target,'utf8')!==content)throw Error('Stale icon catalogue');console.log(manifest.icons.length+' official icon hashes and generated catalogue verified');}else fs.writeFileSync(target,content);
