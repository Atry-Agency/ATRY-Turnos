/** A deliberate upward document scroll exits the pinned story; chat-only scrolling never reaches this policy. */
export function cinemaReturnTarget(input:{previousY:number;y:number;top:number;bottom:number;viewport:number;manual:boolean;direct:boolean}):number|null{
 const {previousY,y,top,bottom,viewport,manual,direct}=input,delta=previousY-y;
 if(!manual||direct||delta<1||top>=0||bottom<=0)return null;
 return Math.max(0,y+top-Math.min(delta,viewport));
}
