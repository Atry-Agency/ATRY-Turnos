/** Linguistic safety only. Never grants a capability or chooses a record. */
export function nonOperationalCitation(text:string){return /\bcita(?:s)? (?:textual(?:es)?|bibliografica(?:s)?|literaria(?:s)?|de (?:un libro|una pelicula|un autor))\b|\b(?:citame|cita) (?:una frase|un texto|un autor)\b/.test(text);}
export function vagueTimeQuestion(text:string){
 if(/\b(?:ahorita|mas tarde|en un rato|al rato)\b/.test(text))return '¿Qué día y horario exactos querés usar?';
 if(/\b(?:a las?|desde|hasta) (?:[1-9]|1[0-2]|una|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce)(?::[0-5]\d)?\b/.test(text)&&!/(?:\bam\b|\bpm\b|(?:de|por) la manana|(?:de|por) la tarde|(?:de|por) la noche|madrugada)/.test(text))return '¿A qué hora exactamente: de mañana o de tarde?';
 return '';
}
