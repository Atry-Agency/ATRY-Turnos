import {resultPositions} from './conversation-context';
import {normalizeLanguage,ordinalChoice} from './language';
/** Deictic phrases are never record names. This resolver does not fetch or manufacture IDs. */
export function isContextReference(text:string){const s=normalizeLanguage(text);return resultPositions(s).length>0&&/^(?:(?:el|la|al|del|numero|nro)\s+|#\s*)?(?:[a-z]+|\d+[ºª°]?)[.! ]*$/.test(s)||/^(?:(?:ese|esa|eso)(?: mismo| misma)?(?: que .+)?|el anterior|el ultimo|el que (?:agregue|cree|anadi).+|el servicio del que hablabamos|el segundo|el primero|el tercero)[.! ]*$/.test(s);}
export {ordinalChoice};
