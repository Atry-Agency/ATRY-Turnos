import {useEffect,useRef,useState} from 'react';
import type {FeaturePort} from '../services/contracts';
import {registrationCountryKey,registrationSuggestion,type VisitorCountry} from '../domain/visitor-country';
import './country-field.css';
export function CountryField({disabled=false,port,suggestCountry=false}:{disabled?:boolean;port?:Pick<FeaturePort,'request'>;suggestCountry?:boolean}){
 const initial=useRef<VisitorCountry>(suggestCountry?registrationSuggestion():'UY'),touched=useRef(false);
 const [ready,setReady]=useState(()=>typeof window!=='undefined'&&window.ATRY_CONFIG?.paRegistrationEnabled===true);
 const [country,setCountry]=useState<VisitorCountry>(()=>initial.current==='PA'&&window.ATRY_CONFIG?.paRegistrationEnabled===true?'PA':'UY');
 useEffect(()=>{let live=true;if(port)void port.request('/api/config').then(raw=>{const c=raw as {regional_contract?:number;pa_registration_enabled?:boolean};if(!live||c.regional_contract!==1)return;const enabled=c.pa_registration_enabled===true;setReady(enabled);setCountry(current=>!enabled&&current==='PA'?'UY':!touched.current&&enabled?initial.current:current)}).catch(()=>{if(live){setReady(false);setCountry('UY')}});return()=>{live=false}},[port]);
 function choose(value:VisitorCountry){touched.current=true;setCountry(value);if(suggestCountry)try{localStorage.setItem(registrationCountryKey,value)}catch{/* No storage is required to choose a country. */}}
 return <label className="country-field"><span>País del negocio</span><span className="country-field-control"><select name="country" value={country} onChange={e=>choose(e.target.value as VisitorCountry)} disabled={disabled} required aria-description="Define la moneda y zona horaria del negocio. No se puede cambiar una vez creado."><option value="UY">Uruguay · UYU</option><option value="PA" disabled={!ready}>Panamá · USD{ready?'':' · no disponible'}</option></select><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 10 4 4 4-4"/></svg></span></label>
}
