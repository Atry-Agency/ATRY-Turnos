'use strict';
async function openPayment(dialog,name){const row=dialog.locator('.closeout-bookings article').filter({hasText:name}),editor=row.locator('.closeout-payment-editor');await editor.waitFor({state:'attached'});if((await editor.getAttribute('open'))===null)await editor.locator(':scope > summary').click();}
async function openViewOptions(dialog){const options=dialog.locator('.closeout-view-options');if(await options.count()&&(await options.getAttribute('open'))===null)await options.locator(':scope > summary').click();}
module.exports={openPayment,openViewOptions};
