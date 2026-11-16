// Approved SVG paths and sector mapping extracted from the existing UI.
const iconPaths:Record<string,string>={phone:'<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />',waitlist:'<circle cx="7" cy="6" r="3"/><path d="M2 18v-2a5 5 0 0 1 10 0v2M15 5h6M15 11h6M15 17h6"/>',calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>',grid:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',users:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',settings:'<circle cx="12" cy="12" r="3"/><path d="M19 13.4a2 2 0 0 0 0-2.8l1.6-1.3-1.8-3-2 .7a2 2 0 0 0-2.4-1.4L14 3h-4l-.4 2.6a2 2 0 0 0-2.4 1.4l-2-.7-1.8 3L5 10.6a2 2 0 0 0 0 2.8l-1.6 1.3 1.8 3 2-.7a2 2 0 0 0 2.4 1.4L10 21h4l.4-2.6a2 2 0 0 0 2.4-1.4l2 .7 1.8-3z"/>',bell:'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',scissors:'<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="m8.12 8.12 12.26 12.26M14.8 9.2l5.58-5.58M8.12 15.88l3.3-3.3"/>',arrow:'<path d="M5 12h14m-6-6 6 6-6 6"/>',chevron:'<path d="m9 18 6-6-6-6"/>',back:'<path d="M19 12H5m6 6-6-6 6-6"/>',plus:'<path d="M12 5v14M5 12h14"/>',check:'<path d="m5 12 4 4L19 6"/>',checkcircle:'<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',external:'<path d="M14 4h6v6M10 14 20 4"/><path d="M20 14v6H4V4h6"/>',copy:'<rect x="7" y="7" width="14" height="14" rx="2"/><path d="M17 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h2"/>',trash:'<path d="M4 7h16M10 11v6M14 11v6M6 7l1 14h10l1-14M9 7V4h6v3"/>',menu:'<path d="M4 6h16"/><path d="M4 12h16"/><path d="M4 18h16"/>',x:'<path d="M6 6l12 12M18 6 6 18"/>',mail:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',shop:'<path d="M4 10V21h16V10M3 10l2-7h14l2 7a3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0ZM9 21v-7h6v7"/>',chart:'<path d="M4 20V11M10 20V5M16 20v-9M22 20V8"/>',spark:'<path d="m12 3 1.7 6.3L20 11l-6.3 1.7L12 19l-1.7-6.3L4 11l6.3-1.7L12 3ZM20 19l1 2-2 1-1-2z"/>',heart:'<path d="M20.8 4.8a5.5 5.5 0 0 0-7.8 0L12 5.8l-1-1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.4a5.5 5.5 0 0 0 0-7.8Z"/>',shield:'<path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z"/><path d="m9 12 2 2 4-4"/>',download:'<path d="M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4"/>',info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/>',logout:'<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',search:'<circle cx="10" cy="10" r="7"/><path d="m15 15 6 6"/>',block:'<circle cx="12" cy="12" r="9"/><path d="M6 6l12 12"/>',refresh:'<path d="M20 4v5h-5"/><path d="M20 9a8 8 0 1 0 .2 5"/>',wallet:'<rect x="3" y="6" width="18" height="15" rx="2"/><path d="M3 9V5a2 2 0 0 1 2-2h13M15 13h6v5h-6a2.5 2.5 0 0 1 0-5Z"/>',help:'<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.8 2.8 0 1 1 4.4 2.3C12.7 12.2 12 13 12 14M12 18h.01"/>',globe:'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c-5 4-5 14 0 18M12 3c5 4 5 14 0 18"/>',edit:'<path d="M12 20H4v-8L16 3l5 5-12 12H4M14 5l5 5"/>',lock:'<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',filter:'<path d="M4 7h16M7 12h10M10 17h4"/>',coffee:'<path d="M4 6h13v10a6.5 6.5 0 0 1-13 0V6ZM17 9h3a3 3 0 0 1 0 6h-3M3 21h16"/>'};
Object.assign(iconPaths,{
 'eye-open':'<path d="M2.06 12.35a1 1 0 0 1 0-.7 10.75 10.75 0 0 1 19.88 0 1 1 0 0 1 0 .7 10.75 10.75 0 0 1-19.88 0"/><circle cx="12" cy="12" r="3"/>',
 'eye-off':'<path d="m3 3 18 18M10.58 10.59a2 2 0 0 0 2.83 2.82M9.88 5.09A10.8 10.8 0 0 1 21.94 11.65a1 1 0 0 1 0 .7 10.8 10.8 0 0 1-2.4 3.73M6.61 6.61a10.8 10.8 0 0 0-4.55 5.04 1 1 0 0 0 0 .7 10.8 10.8 0 0 0 14.33 5.04"/>',
 palette:'<path d="M12 3a9 9 0 1 0 0 18h1a2 2 0 0 0 1-3.7 1.5 1.5 0 0 1 1-2.7h2a4 4 0 0 0 4-4C21 6 17 3 12 3Z"/><circle cx="7" cy="9" r=".7"/><circle cx="11" cy="6" r=".7"/><circle cx="16" cy="7" r=".7"/>',
 // Phosphor Icons regular hair-dryer, MIT; original 256-unit geometry.
 hairdryer:'<g transform="scale(0.09375)" fill="currentColor" stroke="none"><path d="M200,88a32,32,0,1,0-32,32A32,32,0,0,0,200,88Zm-32,16a16,16,0,1,1,16-16A16,16,0,0,1,168,104Zm9.42,102.62L209,137.07A64,64,0,0,0,168,24a8.4,8.4,0,0,0-1.32.11L29.37,47A16,16,0,0,0,16,62.78v50.44A16,16,0,0,0,29.37,129L128,145.44V200a16,16,0,0,0,16,16,40,40,0,0,0,40,40h16a8,8,0,0,0,0-16H184a24,24,0,0,1-24-24h2.85A16,16,0,0,0,177.42,206.62ZM32,62.78,168.64,40a48,48,0,0,1,0,96L32,113.23Zm134.68,89.11A8.4,8.4,0,0,0,168,152a63.9,63.9,0,0,0,17.82-2.54l-23,50.54H144V148.11Z"/></g>',
 grid:'<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>',
 chart:'<path d="M4 3v17a1 1 0 0 0 1 1h16M8 16v-4M13 16V7M18 16v-7"/>',
 spark:'<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M8 3v4M16 3v4M3 11h18m-13 5 3 3 5-5"/>',
 shop:'<path d="M4 10v10a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V10M3 10l2-7h14l2 7M9 21v-7h6v7"/><path d="M3 10a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0"/>',
 refresh:'<path d="M20 4v5h-5"/><path d="M20 9a8 8 0 1 0 .2 5"/>'
});
iconPaths.repeat='<path d="m17 2 4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 0 1-3 3H3"/>';

Object.assign(iconPaths,{
 palette:'<path d="M12 3a9 9 0 1 0 0 18h1a2 2 0 0 0 1-3.7 1.5 1.5 0 0 1 1-2.7h2a4 4 0 0 0 4-4C21 6 17 3 12 3Z"/><circle cx="7" cy="9" r=".7"/><circle cx="11" cy="6" r=".7"/><circle cx="16" cy="7" r=".7"/>',
 craft:'<rect width="7" height="7" x="3" y="3" rx="1" /><rect width="7" height="7" x="14" y="3" rx="1" /><rect width="7" height="7" x="14" y="14" rx="1" /><rect width="7" height="7" x="3" y="14" rx="1" />',
 nail:'<path d="M8 12V7a4 4 0 0 1 8 0v5M8 8h8M6 21v-7a6 6 0 0 1 12 0v7"/>',
 eye:'<path d="m15 18-.722-3.25" /><path d="M2 8a10.645 10.645 0 0 0 20 0" /><path d="m20 15-1.726-2.05" /><path d="m4 15 1.726-2.05" /><path d="m9 18 .722-3.25" />',
 thread:'<path d="M17 13.44 4.442 17.082A2 2 0 0 0 4.982 21H19a2 2 0 0 0 .558-3.921l-1.115-.32A2 2 0 0 1 17 14.837V7.66" /><path d="m7 10.56 12.558-3.642A2 2 0 0 0 19.018 3H5a2 2 0 0 0-.558 3.921l1.115.32A2 2 0 0 1 7 9.163v7.178" />',
 wellness:'<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" /><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" />'
});
Object.assign(iconPaths,{
 palette:'<path d="M12 3a9 9 0 1 0 0 18h1a2 2 0 0 0 1-3.7 1.5 1.5 0 0 1 1-2.7h2a4 4 0 0 0 4-4C21 6 17 3 12 3Z"/><circle cx="7" cy="9" r=".7"/><circle cx="11" cy="6" r=".7"/><circle cx="16" cy="7" r=".7"/>',
 nail:'<rect x="7" y="10" width="10" height="11" rx="3"/><path d="M9 10V3h6v7M9 6h6M10 14h4"/>',
 eye:'<path d="m15 18-.722-3.25" /><path d="M2 8a10.645 10.645 0 0 0 20 0" /><path d="m20 15-1.726-2.05" /><path d="m4 15 1.726-2.05" /><path d="m9 18 .722-3.25" />',
 scissors:'<circle cx="6" cy="6" r="3" /><path d="M8.12 8.12 12 12" /><path d="M20 4 8.12 15.88" /><circle cx="6" cy="18" r="3" /><path d="M14.8 14.8 20 20" />',
 craft:'<rect width="7" height="7" x="3" y="3" rx="1" /><rect width="7" height="7" x="14" y="3" rx="1" /><rect width="7" height="7" x="14" y="14" rx="1" /><rect width="7" height="7" x="3" y="14" rx="1" />',
 thread:'<path d="M17 13.44 4.442 17.082A2 2 0 0 0 4.982 21H19a2 2 0 0 0 .558-3.921l-1.115-.32A2 2 0 0 1 17 14.837V7.66" /><path d="m7 10.56 12.558-3.642A2 2 0 0 0 19.018 3H5a2 2 0 0 0-.558 3.921l1.115.32A2 2 0 0 1 7 9.163v7.178" />'
});
iconPaths.whatsapp='<path d="M21 11.5a9 9 0 0 1-13.3 7.9L3 21l1.6-4.7A9 9 0 1 1 21 11.5Z"/><path d="M8 7c-2 3 2 7 5 8l2-2-3-1-1 1-2-2 1-1Z"/>';

export const approvedIcons=Object.freeze(iconPaths);
export const icon=(name:string)=>approvedIcons[name]||approvedIcons.info;
export function sectorIcon(sector='',service=''){
 const classify=(text:string)=>{text=String(text).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  if(/unas|manicur|pedicur|nail/.test(text))return 'nail';
  if(/pestanas|cejas|lash|brow/.test(text))return 'eye';
  if(/modista|costura|sastr|arreglo de ropa/.test(text))return 'thread';
  if(/peluquer/.test(text))return 'hairdryer';
  if(/barber|cabello|corte|peinado/.test(text))return 'scissors';
  if(/masaj|bienestar|spa|estetic/.test(text))return 'wellness';
  return null;
 };return classify(service)||classify(sector)||'craft';
}
