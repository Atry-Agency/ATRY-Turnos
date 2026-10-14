'use strict';
// The preview publishes the existing UI only. It never copies a server, database,
// environment file or credentials, and cannot claim that cloud operations work.
const fs=require('node:fs'),path=require('node:path');
function build(destination=path.resolve('dist/github-preview')){
 const source=path.resolve(__dirname,'../web');
 fs.mkdirSync(destination,{recursive:true});
 fs.cpSync(source,destination,{recursive:true});
 const index=path.join(destination,'index.html');
 fs.writeFileSync(index,fs.readFileSync(index,'utf8').replace('<head>','<head><script>window.ATRY_CONFIG={backend:"preview"};</script>'));
 fs.writeFileSync(path.join(destination,'.nojekyll'),'');
 console.log('Vista previa generada: interfaz pública, operaciones online deshabilitadas.');
 return destination;
}
if(require.main===module)build();
module.exports={build};
