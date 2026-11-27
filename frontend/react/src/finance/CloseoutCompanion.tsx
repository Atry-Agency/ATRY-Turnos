import '../iatry/iatry.css';
import '../iatry/v3/v3.css';
import {LiquidAvatar} from '../iatry/v3/LiquidAvatar';
/** IAtry's existing visual states mirror the actual closeout state; never a simulated success. */
export function CloseoutCompanion({state='rest',title='Cerremos la caja',message='IAtry · Vamos paso a paso'}:{state?:'rest'|'interaction'|'preparation'|'confirmation'|'error'|'success';title?:string;message?:string}){return <span className="iatry-v3 closeout-identity" data-energy-state={state}><LiquidAvatar/><span className="closeout-identity-copy"><span>{title}</span><small aria-hidden="true">{message}</small></span></span>}
