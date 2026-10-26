'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{audit,allowed,approvedBase}=require('./iatry-visual-audit.cjs');
const production={entry:{type:'chunk',modules:Object.fromEntries([...allowed].map(id=>['/project/'+id,{}]))}};
assert.equal(audit(production).length,allowed.size);
for(const file of ['v3/engine.ts','v3/catalogue.ts','v2/Provider.tsx','visual/UnexpectedExecutor.ts']){const injected={...production,lazyChunk:{type:'chunk',modules:{['/project/src/iatry/'+file]:{}}}};assert.throws(()=>audit(injected),/unapproved assistant module/)}
assert.equal(fs.existsSync('frontend/react/src/iatry/v3'),false);assert.equal(fs.existsSync('frontend/react/src/iatry/v2'),false);
// A forged feature flag must fail before packaging could claim exclusion.
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'atry-visual-guard-'));
try{fs.writeFileSync(path.join(tmp,'runtime-config.js'),"window.ATRY_CONFIG={backend:'supabase',supabaseUrl:'https://djoxdtloqwbrhgtgencc.supabase.co',supabaseKey:'sb_publishable_fixture_for_validation_only',turnstileSiteKey:''};");fs.writeFileSync(path.join(tmp,'iatry-visual-audit.js'),'globalThis.ATRY_IATRY_BUILD='+JSON.stringify({mode:'visual-only',automatedOperations:true,approvedBase,revision:approvedBase,assistantModules:[...allowed]})+';');assert.throws(()=>require('./release-check.cjs').check(tmp));}finally{fs.rmSync(tmp,{recursive:true,force:true})}
console.log('PASS visual release guard: valid graph accepted; experimental/lazy/unknown assistant modules and forged execution flag rejected; operational source absent.');
