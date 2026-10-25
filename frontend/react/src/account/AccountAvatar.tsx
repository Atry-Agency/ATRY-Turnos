import {initials} from '../domain/format';
export function AccountAvatar({user,kind='avatar'}:{user:{name:string;platform_admin:number|boolean};kind?:string}){return <span className={kind+' account-avatar'+(user.platform_admin?' account-avatar--atry':'')}>{user.platform_admin?<img src="./assets/brand/atry.png" alt="Logo de Atry Agency"/>:initials(user.name||'Usuario')}</span>}
