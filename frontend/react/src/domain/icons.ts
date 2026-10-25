// Approved SVG paths and sector mapping extracted from the existing UI.
const iconPaths:Record<string,string>={waitlist:'<circle cx="7" cy="6" r="3"/><path d="M2 18v-2a5 5 0 0 1 10 0v2M15 5h6M15 11h6M15 17h6"/>',calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>',grid:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',users:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',settings:'<circle cx="12" cy="12" r="3"/><path d="M19 13.4a2 2 0 0 0 0-2.8l1.6-1.3-1.8-3-2 .7a2 2 0 0 0-2.4-1.4L14 3h-4l-.4 2.6a2 2 0 0 0-2.4 1.4l-2-.7-1.8 3L5 10.6a2 2 0 0 0 0 2.8l-1.6 1.3 1.8 3 2-.7a2 2 0 0 0 2.4 1.4L10 21h4l.4-2.6a2 2 0 0 0 2.4-1.4l2 .7 1.8-3z"/>',bell:'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',scissors:'<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="m8.12 8.12 12.26 12.26M14.8 9.2l5.58-5.58M8.12 15.88l3.3-3.3"/>',arrow:'<path d="M5 12h14m-6-6 6 6-6 6"/>',chevron:'<path d="m9 18 6-6-6-6"/>',back:'<path d="M19 12H5m6 6-6-6 6-6"/>',plus:'<path d="M12 5v14M5 12h14"/>',check:'<path d="m5 12 4 4L19 6"/>',checkcircle:'<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',external:'<path d="M14 4h6v6M10 14 20 4"/><path d="M20 14v6H4V4h6"/>',copy:'<rect x="7" y="7" width="14" height="14" rx="2"/><path d="M17 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h2"/>',trash:'<path d="M4 7h16M10 11v6M14 11v6M6 7l1 14h10l1-14M9 7V4h6v3"/>',menu:'<path d="M4 6h16"/><path d="M4 12h16"/><path d="M4 18h16"/>',x:'<path d="M6 6l12 12M18 6 6 18"/>',mail:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',shop:'<path d="M4 10V21h16V10M3 10l2-7h14l2 7a3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0ZM9 21v-7h6v7"/>',chart:'<path d="M4 20V11M10 20V5M16 20v-9M22 20V8"/>',spark:'<path d="m12 3 1.7 6.3L20 11l-6.3 1.7L12 19l-1.7-6.3L4 11l6.3-1.7L12 3ZM20 19l1 2-2 1-1-2z"/>',heart:'<path d="M20.8 4.8a5.5 5.5 0 0 0-7.8 0L12 5.8l-1-1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.4a5.5 5.5 0 0 0 0-7.8Z"/>',shield:'<path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z"/><path d="m9 12 2 2 4-4"/>',download:'<path d="M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4"/>',info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/>',logout:'<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',search:'<circle cx="10" cy="10" r="7"/><path d="m15 15 6 6"/>',block:'<circle cx="12" cy="12" r="9"/><path d="M6 6l12 12"/>',refresh:'<path d="M20 4v5h-5"/><path d="M20 9a8 8 0 1 0 .2 5"/>',wallet:'<rect x="3" y="6" width="18" height="15" rx="2"/><path d="M3 9V5a2 2 0 0 1 2-2h13M15 13h6v5h-6a2.5 2.5 0 0 1 0-5Z"/>',help:'<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.8 2.8 0 1 1 4.4 2.3C12.7 12.2 12 13 12 14M12 18h.01"/>',globe:'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c-5 4-5 14 0 18M12 3c5 4 5 14 0 18"/>',edit:'<path d="M12 20H4v-8L16 3l5 5-12 12H4M14 5l5 5"/>',lock:'<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',filter:'<path d="M4 7h16M7 12h10M10 17h4"/>',coffee:'<path d="M4 6h13v10a6.5 6.5 0 0 1-13 0V6ZM17 9h3a3 3 0 0 1 0 6h-3M3 21h16"/>'};
Object.assign(iconPaths,{
 grid:'<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>',
 chart:'<path d="M4 3v17a1 1 0 0 0 1 1h16M8 16v-4M13 16V7M18 16v-7"/>',
 spark:'<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M8 3v4M16 3v4M3 11h18m-13 5 3 3 5-5"/>',
 shop:'<path d="M4 10v10a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V10M3 10l2-7h14l2 7M9 21v-7h6v7"/><path d="M3 10a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0"/>',
 refresh:'<path d="M20 4v5h-5"/><path d="M20 9a8 8 0 1 0 .2 5"/>'
});
iconPaths.repeat='<path d="m17 2 4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 0 1-3 3H3"/>';

Object.assign(iconPaths,{
 craft:'<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5z"/>',
 nail:'<path d="M8 12V7a4 4 0 0 1 8 0v5M8 8h8M6 21v-7a6 6 0 0 1 12 0v7"/>',
 eye:'<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12ZM5 4l2 3M12 2v3M19 4l-2 3"/><circle cx="12" cy="12" r="3"/>',
 thread:'<path d="M7 3h10M7 21h10M9 3v18M15 3v18M9 7h6M9 11h6M9 15h6M15 17c7 0 7-8 3-8"/>',
 wellness:'<path d="M12 21C3 17 2 10 4 5c5 0 8 3 8 8 0-5 3-8 8-8 2 5 1 12-8 16ZM12 21V10"/>'
});
Object.assign(iconPaths,{
 nail:'<rect x="7" y="10" width="10" height="11" rx="3"/><path d="M9 10V3h6v7M9 6h6M10 14h4"/>',
 eye:'<path d="M3 10c4 7 14 7 18 0M5 13l-2 3m6-1-1 4m7-4 1 4m3-6 2 3"/>',
 scissors:'<circle cx="6.5" cy="6.5" r="2.7"/><circle cx="6.5" cy="17.5" r="2.7"/><path d="m8.5 8.5 12 12m-12-5 12-12"/>',
 craft:'<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5z"/>',
 thread:'<path d="M7 3h10M7 21h10M9 3v18M15 3v18m-6-3 6-3m-6-2 6-3m-6-2 6-3M15 18h3a3 3 0 0 0 3-3"/>'
});
iconPaths.whatsapp='<path d="M21 11.5a9 9 0 0 1-13.3 7.9L3 21l1.6-4.7A9 9 0 1 1 21 11.5Z"/><path d="M8 7c-2 3 2 7 5 8l2-2-3-1-1 1-2-2 1-1Z"/>';

export const approvedIcons=Object.freeze(iconPaths);
export const icon=(name:string)=>approvedIcons[name]||approvedIcons.info;
export function sectorIcon(sector='',service=''){
 const classify=(text:string)=>{text=String(text).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  if(/unas|manicur|pedicur|nail/.test(text))return 'nail';
  if(/pestanas|cejas|lash|brow/.test(text))return 'eye';
  if(/modista|costura|sastr|arreglo de ropa/.test(text))return 'thread';
  if(/barber|peluquer|cabello|corte|peinado/.test(text))return 'scissors';
  if(/masaj|bienestar|spa|estetic/.test(text))return 'wellness';
  return null;
 };return classify(service)||classify(sector)||'craft';
}
