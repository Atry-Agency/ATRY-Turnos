'use strict';
const fs=require('node:fs'),path=require('node:path');
async function build(env=process.env,directory=path.resolve('dist/github-preview')){
 if(env.CLOUD_BACKEND_VALIDATED!=='1'){
  require('./build-github-preview').build(directory);
  if(env.CLOUD_INTEGRATION_QA==='1'){
   const qa=path.join(directory,'validacion');await require('./build-pages').build(env,qa,{verificationOnly:true});
   for(const file of ['_headers','_redirects'])fs.unlinkSync(path.join(qa,file));
  }
  return directory;
 }
 await require('./build-pages').build(env,directory);
 fs.writeFileSync(path.join(directory,'.nojekyll'),'');
 // GitHub Pages uses hash routes; Cloudflare-specific headers are not interpreted there.
 for(const file of ['_headers','_redirects'])fs.unlinkSync(path.join(directory,file));
 return directory;
}
if(require.main===module)build().then(()=>console.log('Artefacto GitHub Pages preparado.')).catch(error=>{console.error(error.message);process.exitCode=1;});
module.exports={build};
