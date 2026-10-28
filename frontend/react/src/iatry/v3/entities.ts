import type {Values} from './contracts';
import {language} from './intent-catalogue';
/** Entity extraction is independent of the action selected; projecting to a tool must not erase facts. */
export function extractEntities(source:string):Values{
 const s=language(source),out:Values={},duration=s.match(/\b(\d{1,3})\s*(?:minutos|min)\b/),price=s.match(/\$\s*(\d+(?:[.,]\d+)*)/)||s.match(/\b(\d+(?:[.,]\d+)*)\s*(?:pesos|uyu)\b/)||s.match(/(?:cuesta|precio(?: es)?|cobrar)\s+(\d+(?:[.,]\d+)*)\b/);
 if(duration&&Number(duration[1])>=5&&Number(duration[1])<=720)out.duration_min=duration[1];if(price&&Number.isInteger(Number(price[1].replace(/\.(?=\d{3}(?:[.,]|$))/g,'').replace(',','.'))))out.price_uyu=price[1].replace(/\.(?=\d{3}(?:[.,]|$))/g,'').replace(',','.');
 const percentage=s.match(/\b(\d{1,3}(?:[.,]\d+)?)\s*%/);if(percentage&&Number(percentage[1].replace(',','.'))<=100)out.percentage=percentage[1].replace(',','.');
 const name=source.match(/(?:se (?:va a )?llama|nombre(?: es)?|llamalo(?: mejor)?)\s+(.+?)(?=,?\s+(?:y\s+)?(?:dura|cuesta|duracion|precio)\b|$)/i);if(name&&!/^(?:del? |de la |y |del servicio\b)/i.test(name[1].trim()))out.name=name[1].trim();
 return out;
}
