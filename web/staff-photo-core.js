(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.AtryStaffPhoto=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 const bucket='staff-photos',maxBytes=65536;
 function path(bid,sid,revision){if(![bid,sid,revision].every(v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(v)))throw Error('Ruta de fotografía inválida');return `${bid}/${sid}/${revision}.webp`;}
 function validPath(value,bid,sid){return typeof value==='string'&&value.startsWith(bid+'/'+sid+'/')&&/^[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+\.webp$/.test(value);}
 function bytes(image){if(typeof image!=='string'||!/^data:image\/webp;base64,[A-Za-z0-9+/]+={0,2}$/.test(image))throw Error('La fotografía debe ser WebP optimizada');const data=image.split(',')[1],raw=typeof atob==='function'?Uint8Array.from(atob(data),c=>c.charCodeAt(0)):new Uint8Array(Buffer.from(data,'base64'));if(raw.length>maxBytes||raw.length<16||String.fromCharCode(...raw.slice(0,4))!=='RIFF'||String.fromCharCode(...raw.slice(8,12))!=='WEBP')throw Error('Fotografía inválida o mayor a 64 KB');return raw;}
 return {bucket,maxBytes,path,validPath,bytes};
});
