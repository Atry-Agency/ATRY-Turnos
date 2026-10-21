/* Presentation-only calendar geometry. Booking validation belongs to the server. */
(function(root){
 'use strict';
 const formatters=new Map(),instants=new Map();
 const parts=(value,zone='America/Montevideo')=>{const key=typeof value==='string'?zone+'|'+value:null;if(key&&instants.has(key))return instants.get(key);if(!formatters.has(zone)){if(formatters.size>=16)formatters.clear();formatters.set(zone,new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}));}const p=Object.fromEntries(formatters.get(zone).formatToParts(new Date(value)).map(x=>[x.type,x.value]));const result={day:`${p.year}-${p.month}-${p.day}`,minute:Number(p.hour)*60+Number(p.minute)};if(key){if(instants.size>=8192)instants.clear();instants.set(key,result);}return result;};
 const clock=m=>`${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`;
 function segment(booking,day,zone){const a=parts(booking.starts_at,zone),b=parts(booking.ends_at,zone);if(a.day>day||b.day<day||(b.day===day&&b.minute===0)||Date.parse(booking.ends_at)<=Date.parse(booking.starts_at))return null;const start=a.day<day?0:a.minute,end=b.day>day?1440:b.minute;return end>start?{booking,start,end}:null;}
 function layout(bookings,day,zone){
  const items=bookings.map(b=>segment(b,day,zone)).filter(Boolean).sort((a,b)=>a.start-b.start||b.end-a.end||String(a.booking.id).localeCompare(String(b.booking.id)));
  let group=[],until=-1;const flush=()=>{const ends=[];for(const item of group){let col=ends.findIndex(end=>end<=item.start);if(col<0)col=ends.length;ends[col]=item.end;item.column=col;}for(const item of group)item.columns=ends.length;group=[];};
  for(const item of items){if(item.start>=until){flush();until=-1;}group.push(item);until=Math.max(until,item.end);}flush();return items;
 }
 const subtract=(windows,block)=>windows.flatMap(w=>block.end<=w.start||block.start>=w.end?[w]:[{start:w.start,end:Math.min(w.end,block.start)},{start:Math.max(w.start,block.end),end:w.end}].filter(x=>x.end>x.start));
 function windows(rules,staffId,day,zone){
  if(!rules)return null;const weekday=new Date(day+'T12:00:00Z').getUTCDay();if((rules.holidays||[]).some(h=>h.day===day))return [];
  const exceptions=(rules.exceptions||[]).filter(h=>h.staff_id===staffId&&h.day===day);if(exceptions.some(h=>Number(h.closed)===1))return [];
  let result=(exceptions.length?exceptions:(rules.hours||[]).filter(h=>h.staff_id===staffId&&Number(h.weekday)===weekday)).map(h=>({start:Number(h.start_min),end:Number(h.end_min)})).filter(h=>Number.isFinite(h.start)&&h.end>h.start);
  const blocks=(rules.breaks||[]).filter(h=>h.staff_id===staffId&&Number(h.weekday)===weekday).map(h=>({start:Number(h.start_min),end:Number(h.end_min)}));
  for(const off of rules.time_off||[])if(off.staff_id===staffId){const s=segment(off,day,zone);if(s)blocks.push(s);}
  for(const block of blocks)result=subtract(result,block);return result.sort((a,b)=>a.start-b.start);
 }
 function bounds(bookings,rules,staffIds,days,zone){const points=[];for(const day of days){const weekday=new Date(day+'T12:00Z').getUTCDay();for(const id of staffIds){const exceptions=(rules?.exceptions||[]).filter(h=>h.staff_id===id&&h.day===day&&!Number(h.closed)),source=exceptions.length?exceptions:(rules?.hours||[]).filter(h=>h.staff_id===id&&Number(h.weekday)===weekday);for(const h of source)if(Number.isFinite(Number(h.start_min))&&Number(h.end_min)>Number(h.start_min))points.push(Number(h.start_min),Number(h.end_min));}for(const b of bookings){const s=segment(b,day,zone);if(s)points.push(s.start,s.end);}}if(!points.length)return {start:480,end:1200};return {start:Math.max(0,Math.floor(Math.min(...points)/60)*60),end:Math.min(1440,Math.ceil(Math.max(...points)/60)*60)};}

 const tones=['violet','blue','rose','amber','teal'];
 const serviceTone=id=>tones[[...String(id||'service')].reduce((n,c)=>(n*31+c.charCodeAt(0))>>>0,0)%tones.length];
 const api={parts,clock,segment,layout,windows,bounds,serviceTone};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.ATRY_AGENDA=api;
})(typeof window!=='undefined'?window:globalThis);
