'use strict';
const fs=require('node:fs'),path=require('node:path');
const {finalize,publicFile}=require('./build-assets.cjs');
function packageReact(destination,configuration){
 const source=path.resolve(__dirname,'../../frontend/react/dist');
 if(!fs.existsSync(path.join(source,'react-assets.json')))throw Error('Primero ejecutá npm run build.');
 const files=JSON.parse(fs.readFileSync(path.join(source,'react-assets.json'),'utf8'));
 if(!Array.isArray(files)||files.some(file=>file!=='/sw.js'&&!publicFile(file)))throw Error('Manifiesto React inválido.');
 fs.mkdirSync(destination,{recursive:true});
 // Remove obsolete public files from a previous package without touching unrelated paths.
 const oldManifest=path.join(destination,'react-assets.json');
 if(fs.existsSync(oldManifest)){const previous=JSON.parse(fs.readFileSync(oldManifest,'utf8'));for(const file of previous){if(file==='/sw.js'||publicFile(file))fs.rmSync(path.join(destination,file),{force:true})}}
 for(const name of ['app.js','cloud-backend.js','proof-worker.js','pilot.js'])fs.rmSync(path.join(destination,name),{force:true});
 for(const file of files){const target=path.join(destination,file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(path.join(source,file),target)}
 fs.writeFileSync(path.join(destination,'runtime-config.js'),'window.ATRY_CONFIG='+JSON.stringify(configuration)+';');
 finalize(destination);return destination;
}
module.exports={packageReact};
