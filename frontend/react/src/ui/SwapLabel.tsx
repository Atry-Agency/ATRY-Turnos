/** Stable geometry for an action's optional hover copy; callers provide its accessible name. */
export function SwapLabel({primary='Probar sin cuenta',secondary='Explorá la demo',className='cta-swap'}:{primary?:string;secondary?:string;className?:string}={}){return <span className={className} aria-hidden="true"><span>{primary}</span><span>{secondary}</span></span>}
