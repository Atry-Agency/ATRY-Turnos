'use strict';
const path=require('node:path');const {spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'../..');
require(path.join(root,'node_modules/esbuild')).buildSync({entryPoints:[path.join(root,'frontend/react/src/ServiceCard.tsx')],outfile:path.join(root,'frontend/react/dist/component.cjs'),bundle:true,platform:'node',format:'cjs',external:['react','react/jsx-runtime']});
for(const name of ['repository','form'])require(path.join(root,'node_modules/esbuild')).buildSync({entryPoints:[path.join(root,'frontend/react/src/services/'+name+'.ts')],outfile:path.join(root,'frontend/react/dist/'+name+'.cjs'),bundle:true,platform:'node',format:'cjs'});
const result=spawnSync(process.execPath,['--test',path.join(root,'frontend/react/test/component.test.mjs'),path.join(root,'frontend/react/test/repository.test.mjs')],{stdio:'inherit'});process.exitCode=result.status??1;
