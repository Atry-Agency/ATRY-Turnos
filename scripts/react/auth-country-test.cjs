'use strict';
const assert=require('node:assert/strict'),{buildSync}=require('esbuild'),vm=require('node:vm');
const code=buildSync({entryPoints:['frontend/react/src/domain/visitor-country.ts'],bundle:true,platform:'node',format:'cjs',write:false}).outputFiles[0].text;
const sandbox={exports:{},module:{exports:{}}};vm.runInNewContext(code,sandbox);const{resolveVisitorCountry,visitorCountry,timeZoneCountry}=sandbox.module.exports;
for(const[manual,hint,zone,result]of[[null,null,'America/Panama','PA'],[null,null,'America/Montevideo','UY'],[null,null,'America/New_York','UY'],[null,null,'UTC','UY'],['UY','PA','America/Panama','UY'],['PA','UY','America/Montevideo','PA'],[null,'PA','UTC','PA'],['invalid','XX','unknown','UY']])assert.equal(resolveVisitorCountry(manual,hint,zone),result);
for(const value of ['pa','507','es-PA','US','',null,{},'<script>'])assert.equal(visitorCountry(value),undefined);
assert.equal(timeZoneCountry('America/Bogota'),undefined);assert.equal(timeZoneCountry('Etc/GMT+5'),undefined);
console.log('PASS registration country: explicit preference > existing hint > exact IANA zone > UY; no language/offset guesses; unknown inputs rejected');
