'use strict';
// Experimental route seam. Loaded only by the isolated React preview, never index.html/SW.
(()=>{let identity=null,sessionVersion=0;window.ATRY_SERVICES_PORT={
 scope(){if(identity!==state.me){identity=state.me;sessionVersion++;}return state.me?.user&&state.business?{sessionVersion,userId:state.me.user.id,businessId:state.business.id,role:state.business.role,sector:state.business.sector||'',accessEnabled:state.entitlements?.access_enabled===true}:null;},
 request:(route,options)=>api(route,options),
 publish(scope,catalog){const now=this.scope();if(!now||now.sessionVersion!==scope.sessionVersion||now.userId!==scope.userId||now.businessId!==scope.businessId||now.role!==scope.role||now.accessEnabled!==scope.accessEnabled)return;state.services=structuredClone(catalog.services);state.staffList=structuredClone(catalog.staff);},
 createHost(){state.dialog=null;setScreen('<div data-react-services-root></div>','Servicios');return document.querySelector('[data-react-services-root]');},
 icon:name=>iconPaths[name]||iconPaths.info,
 serviceIcon:(sector,name)=>sectorIcon(sector,name),
 notify:(message,error)=>toast(message,error)
};})();
