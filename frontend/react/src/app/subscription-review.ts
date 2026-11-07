import type {AppPort} from './port';
import {subscriptionLive} from '../subscription/model';
/** A successful refresh alone is insufficient: identity, business and server access must agree. */
export async function reviewSubscriptionAccess(port:Pick<AppPort,'session'|'scope'|'business'|'refreshPermissions'>,businessId:string):Promise<'enabled'|'restricted'|'stale'>{
 const initial=port.session(),session=initial?{...initial}:null;
 await port.refreshPermissions();
 const current=port.session(),scope=port.scope();
 if(!session||current?.userId!==session.userId||current.version!==session.version||scope?.businessId!==businessId)return 'stale';
 return subscriptionLive(port.business())&&scope.accessEnabled===true?'enabled':'restricted';
}
