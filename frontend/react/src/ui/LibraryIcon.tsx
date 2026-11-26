import type {CSSProperties} from 'react';
import {lucideGlyphs} from '../domain/icon-library/glyphs';
import './icons.css';
/** Decorative, local official SVGs. Labels belong to the enclosing control. */
export function LibraryIcon({name,className='',style,motion,markup}:{name:string;className?:string;style?:CSSProperties;motion?:'confirm'|'spin';markup?:string}){
 return <svg className={className} data-icon={name} data-icon-motion={motion} style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" dangerouslySetInnerHTML={{__html:markup??lucideGlyphs[name]??lucideGlyphs.info}}/>;
}
