import type {InputHTMLAttributes} from 'react';
import type {AppPort} from '../app/port';
import {Icon} from '../ui/Icon';
/** Native checkbox remains the focusable, labelled control; the Lucide mark is presentation only. */
export function CloseoutCheck({port,...props}:Omit<InputHTMLAttributes<HTMLInputElement>,'type'>&{port:AppPort}){
 return <span className="closeout-check"><input {...props} type="checkbox"/><span className="closeout-check-face" aria-hidden="true"><Icon name="check" port={port}/></span></span>;
}
