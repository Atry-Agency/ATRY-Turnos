import type {ReactNode} from 'react';
import './chat.css';
/** Shared by the commercial story and the real assistant. No timers, transport or success inference. */
export function ChatBubble({speaker='assistant',children,className=''}:{speaker?:'assistant'|'user';children:ReactNode;className?:string}){
 return <div className={'iatry-conversation-message '+className} data-speaker={speaker}><span className="iatry-conversation-speaker">{speaker==='user'?'Vos':'IAtry'}</span>{children}</div>;
}
