import {lucideGlyphs} from './icon-library/glyphs';
/** Semantic aliases preserve existing navigation and FeaturePort contracts. */
export const iconAliases:Readonly<Record<string,string>>=Object.freeze({
  "phone": "phone",
  "messages": "messages-square",
  "waitlist": "list-ordered",
  "calendar": "calendar-days",
  "grid": "house",
  "users": "users-round",
  "clock": "clock",
  "settings": "settings",
  "bell": "bell",
  "scissors": "scissors",
  "arrow": "arrow-right",
  "chevron": "chevron-right",
  "back": "arrow-left",
  "plus": "plus",
  "check": "check",
  "checkcircle": "circle-check",
  "external": "external-link",
  "copy": "copy",
  "trash": "trash",
  "menu": "menu",
  "x": "x",
  "mail": "mail",
  "shop": "store",
  "chart": "chart-column",
  "spark": "calendar-check-2",
  "heart": "heart",
  "shield": "shield-check",
  "download": "download",
  "info": "info",
  "logout": "log-out",
  "search": "search",
  "block": "ban",
  "refresh": "refresh-cw",
  "wallet": "wallet",
  "help": "circle-question-mark",
  "globe": "globe",
  "edit": "square-pen",
  "lock": "lock-keyhole",
  "filter": "list-filter",
  "coffee": "coffee",
  "store": "store",
  "eye-open": "eye",
  "eye-off": "eye-off",
  "palette": "palette",
  "hairdryer": "hairdryer",
  "repeat": "repeat-2",
  "craft": "layout-grid",
  "nail": "paintbrush-vertical",
  "eye": "eye-closed",
  "thread": "spool",
  "wellness": "leaf"
});
export const approvedIcons:Readonly<Record<string,string>>=Object.freeze({...Object.fromEntries(Object.entries(iconAliases).map(([name,source])=>[name,lucideGlyphs[source]])),whatsapp:"<path d=\"M21 11.5a9 9 0 0 1-13.3 7.9L3 21l1.6-4.7A9 9 0 1 1 21 11.5Z\"/><path d=\"M8 7c-2 3 2 7 5 8l2-2-3-1-1 1-2-2 1-1Z\"/>"});
export const icon=(name:string)=>approvedIcons[name]||lucideGlyphs[name]||approvedIcons.info;
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
