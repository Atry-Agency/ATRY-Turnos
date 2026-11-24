'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const root=path.resolve(__dirname,'../..'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'atry-ux-unit-'));
try{
 require('esbuild').buildSync({stdin:{resolveDir:path.join(root,'frontend/react'),loader:'tsx',contents:"import {renderToStaticMarkup} from 'react-dom/server';import {ReceiptDetails,BookingReceipt} from './src/public/Shared';const port={icon:()=>'',notify:()=>{}};export const manage=(b)=>renderToStaticMarkup(<ReceiptDetails receipt={b} port={port}/>);export const receipt=(b)=>renderToStaticMarkup(<BookingReceipt receipt={b} port={port} management='#/gestionar/test'/>);"},outfile:path.join(dir,'test.cjs'),bundle:true,platform:'node',jsx:'automatic',loader:{'.css':'empty','.svg':'dataurl','.jpg':'dataurl'},define:{'import.meta.env.DEV':'false'}});
 const render=require(path.join(dir,'test.cjs')),base={id:'fictional',manage_token:'local-only',status:'confirmed',business_name:'Centro Integral de Bienestar y Estética Profesional',service_name:'Servicio de prueba',staff_name:'Profesional de prueba',starts_at:'2026-12-01T15:00:00Z',ends_at:'2026-12-01T15:30:00Z',price_uyu:790};let checks=0;
 for(const [name,view]of Object.entries(render)){
  for(const currency of['UYU','USD',undefined]){
   const pa=currency==='USD',b={...base,currency,business_country:pa?'PA':'UY',business_currency:pa?'USD':'UYU',business_timezone:pa?'America/Panama':'America/Montevideo',...(pa?{price_minor:1299}:{})},html=view(b),price=html.match(/class="receipt-price"[\s\S]*?<strong>([\s\S]*?)<\/strong>/)[1].replace(/<[^>]*>/g,'');
   assert.ok(pa?price.includes('12.99')&&!price.includes('UYU'):price.includes('790')&&price.includes('UYU'),name+' '+currency+' '+price);checks++;
   assert.ok(html.includes('data-has-identity="false"'));checks++;
   assert.ok(!html.includes('openstreetmap.org/export/embed.html'));checks++;
   if(pa)assert.throws(()=>view({...b,price_minor:undefined}),/importe exacto/);
  }
  for(const status of['pending','cancelled']){const html=view({...base,status});assert.ok(!html.includes('calendar.google.com'));assert.ok(!html.includes('Cómo llegar'));checks+=2}
 }
 console.log('PASS UX corrections:',checks,'checks; UY/PA currency in both receipt consumers, legacy UY, exact USD guard, identity layout and status gates.');
}finally{fs.rmSync(dir,{recursive:true,force:true})}
