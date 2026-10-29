import {LiquidAvatar} from '../iatry/v3/LiquidAvatar';
import {useIatryMotionOff} from '../iatry/context';
import './welcome.css';
/** No background requests: the actual checklist is loaded only on the welcome screen. */
export function WelcomeResume(){const off=useIatryMotionOff();return <section className="welcome-resume" aria-label="Continuar bienvenida con IAtry" data-motion-off={off||undefined} data-energy-state="rest"><LiquidAvatar/><div><strong>Lo preparamos juntos.</strong><span>Retomá la configuración de tu negocio con IAtry.</span></div><a className="btn secondary sm" href="#/app/configuracion-inicial">Continuar <span aria-hidden="true">↗</span></a></section>}
