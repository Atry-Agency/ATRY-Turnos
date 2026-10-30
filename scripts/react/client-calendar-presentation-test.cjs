'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const root=path.resolve(__dirname,'../..'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'atry-calendar-view-'));
try{
 const outfile=path.join(dir,'view.cjs');
 require('esbuild').buildSync({stdin:{contents:"import {renderToStaticMarkup} from 'react-dom/server';import {ReservationSummary} from './src/calendar/ReservationSummary';import {AddToCalendar} from './src/calendar/AddToCalendar';export const summary=(booking)=>renderToStaticMarkup(<ReservationSummary booking={booking}/>);export const picker=(booking)=>renderToStaticMarkup(<AddToCalendar booking={booking}/>);",resolveDir:path.join(root,'frontend/react'),loader:'tsx'},outfile,bundle:true,platform:'node',format:'cjs',jsx:'automatic',loader:{'.css':'empty','.svg':'dataurl','.jpg':'dataurl'}});
 const {summary,picker}=require(outfile),b={id:'test-calendar',status:'confirmed',business_name:'Estudio Aurora',service_name:'Corte',staff_name:'Lucía',starts_at:'2026-11-02T02:45:00Z',ends_at:'2026-11-02T03:15:00Z',business_address:'Montevideo'};
 const html=summary(b);
 for(const text of ['2026','23:45','00:15','domingo','Finaliza al día siguiente','Estudio Aurora','Lucía','Montevideo'])assert.ok(html.includes(text),text);
 assert.ok(html.includes('>01<'),'UTC Monday must display Sunday 1 in Uruguay');
 assert.ok(!summary({...b,business_address:undefined}).includes('calendar-reservation-location'),'No invented address');
 assert.ok(!summary({...b,starts_at:'bad'}).includes('calendar-reservation-schedule'),'No invented schedule');
 assert.equal(picker({...b,status:'cancelled'}),'');assert.equal(picker({...b,status:'pending'}),'');
 assert.ok(!picker(b).includes('IAtry'),'No assistant decoration on client picker');
 assert.ok(html.includes('calendar-professional-avatar'),'Default professional avatar');assert.ok(!html.includes('calendar-refracted-crystal'),'Empty decorative corner');assert.ok(!html.includes('<iframe'),'No map without configured coordinates');assert.ok(summary({...b,business_location_kind:'physical',business_latitude:-34.9,business_longitude:-56.16}).includes('openstreetmap.org/export/embed.html'),'Configured coordinates use a real map');assert.ok(!summary({...b,business_location_kind:'at_home',business_latitude:-34.9,business_longitude:-56.16}).includes('<iframe'),'No private home map');
 console.log('PASS calendar presentation: Uruguay day/year/time, overnight, missing data, confirmed-only and no client IAtry');
}finally{fs.rmSync(dir,{recursive:true,force:true})}
