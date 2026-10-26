import type {ReactNode} from 'react';
import {AnimatePresence,LazyMotion,domAnimation,m} from 'motion/react';
// Loaded on demand. Ordinary navigation and the resting dock do not import Motion.
export function AnimatedPanel({expanded,off,children}:{expanded:boolean;off:boolean;children:ReactNode}){
 return <LazyMotion features={domAnimation} strict><AnimatePresence>{expanded&&<m.div key="panel" id="iatry-v2-panel" className="iatry-v2-panel" initial={off?false:{opacity:0,y:8,scale:.985}} animate={{opacity:1,y:0,scale:1}} exit={{opacity:0,y:4}} transition={{duration:off?0:.24}}>{children}</m.div>}</AnimatePresence></LazyMotion>;
}
