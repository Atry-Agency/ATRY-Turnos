'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const T=require('../web/theme-core'),{prepare,publicConfig}=require('../server/appearance');
const triples=[['Soft Static','Calma','#222526','#CCDCEF','#FF6574'],['Ocean Drive','Calma','#2C99D6','#FBFAFC','#EB2F33'],['Blue Romance','Calma','#09318D','#FCFFFF','#EED2E2'],['Neon Rodeo','Energía','#1734BE','#FBE45C','#ED2B8C'],['Tropic Fever','Energía','#005C47','#E0F354','#FD550A'],['Cherry Soda','Energía','#CA0B0A','#FCFFFF','#EC9AC2'],['Velvet Vice','Actitud','#55263D','#F5EBCC','#F34E3D'],['Night Swim','Actitud','#080F1B','#329DD2','#FF4C2B'],['Afterburn','Actitud','#28282B','#F9F9F9','#FF4200']];
test('COLOR CLUB: the nine official triples are exact and immutable',()=>{
 assert.deepEqual(T.colorClub.map(p=>[p.name,p.category,p.primary,p.secondary,p.accent]),triples);
 assert.equal(Object.isFrozen(T.colorClub),true);assert.ok(T.colorClub.every(Object.isFrozen));
});
test('COLOR CLUB: panel/public modes and UY/PA preserve all three raw colors with readable derived text',()=>{
 for(const p of T.colorClub)for(const plan of ['negocio','pro'])for(const mode of ['light','dark'])for(const country_code of ['UY','PA'])for(const publicView of [false,true]){
  const input={plan,country_code,theme_config:{primary:p.primary,secondary:p.secondary,mode,public_mode:publicView?(mode==='light'?'dark':'light'):'inherit'}};
  const v=T.effective(input,publicView);
  assert.equal(v.primary,p.primary);assert.equal(v.secondary,p.secondary);assert.equal(v.accent,p.accent);assert.equal(v.paletteId,p.id);assert.equal(v.actionFill,p.accent);assert.equal(v.background,p.secondary);assert.equal(v.sidebar,p.primary);
  for(const [fg,bg]of [[v.ink,v.surface],[v.muted,v.surface],[v.canvasInk,v.background],[v.canvasMuted,v.background],[v.canvasAction,v.background],[v.onActionFill,v.actionFill],[v.onAccent,v.accent],[v.accentInk,v.surface],[v.action,v.surface],[v.onSidebar,v.sidebar],[T.readable(v.ink,v.secondary),v.secondary]])assert.ok(T.contrast(fg,bg)>=4.5,`${p.id} ${mode} ${fg}/${bg}`);
 }
});
test('COLOR CLUB: existing version-1 persistence and public projection recover accent without schema changes',()=>{
 for(const p of T.colorClub){const b={plan:'pro',theme_revision:7,theme_config:JSON.stringify({version:1,font:'system',cards:'outlined',presets:[{name:'Club guardado',config:{version:1,primary:p.primary,secondary:p.secondary}}]})};
 const result=prepare(b,{expected_revision:7,theme_config:{version:1,primary:p.primary,secondary:p.secondary}}),saved=JSON.parse(result.theme_config);
 assert.equal(saved.accent,undefined);assert.equal(saved.font,'system');assert.equal(saved.cards,'outlined');assert.equal(T.effective({...b,...result}).accent,p.accent);
 assert.equal(T.effective({plan:'pro',theme_config:publicConfig({...b,...result})},true).accent,p.accent);
 assert.equal(T.effective({plan:'pro',theme_config:saved.presets[0].config}).accent,p.accent);
 }
});
test('COLOR CLUB: essential restrictions, downgrade and custom two-color themes stay intact',()=>{
 for(const p of T.colorClub){assert.throws(()=>T.validate({primary:p.primary,secondary:p.secondary},'individual'));const v=T.effective({plan:'individual',theme_config:{primary:p.primary,secondary:p.secondary}});assert.equal(v.paletteId,'');assert.equal(v.primary,'#4754E6');}
 for(const p of Object.values(T.palettes)){const v=T.effective({plan:'pro',theme_config:p===T.palettes.atry?{}:{primary:p.primary,secondary:p.secondary}});assert.equal(v.paletteId,'');assert.equal(v.actionFill,v.action);assert.equal(v.accent,v.secondary);}
 assert.equal(T.paletteFor({primary:'#222526',secondary:'#CCDCEE'}),null);
 assert.equal(T.paletteFor({primary:'#222526',secondary:'#ccdcef'}).id,'soft-static');
});

test('COLOR CLUB: default cards retain classic white/light and dark surfaces, while Pro custom surfaces remain available',()=>{
 for(const p of T.colorClub)for(const mode of ['light','dark']){
  const v=T.effective({plan:'negocio',theme_config:{primary:p.primary,secondary:p.secondary,mode}});
  assert.equal(v.surface,mode==='dark'?'#1B1C24':'#FFFFFF');
  assert.equal(v.background,p.secondary);assert.equal(v.sidebar,p.primary);assert.equal(v.accent,p.accent);
 }
 const p=T.colorClub[6],custom=T.effective({plan:'pro',theme_config:{primary:p.primary,secondary:p.secondary,surface:'#FAF8F5'}});
 assert.equal(custom.surface,'#FAF8F5');assert.equal(T.effective({plan:'negocio'}).surface,'#FFFFFF');
});
