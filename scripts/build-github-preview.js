'use strict';
const fs=require('node:fs'),path=require('node:path');
function build(destination=path.resolve('dist/github-preview')){require('./react/package.cjs').packageReact(destination,{backend:'preview'});fs.writeFileSync(path.join(destination,'.nojekyll'),'');return destination;}
if(require.main===module)build();
module.exports={build};
