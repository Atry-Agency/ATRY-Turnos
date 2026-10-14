'use strict';
function scheduleFor(db,staffId,day){const exception=db.prepare('SELECT * FROM schedule_exceptions WHERE staff_id=? AND day=?').get(staffId,day);if(exception)return exception.closed?null:{start_min:exception.start_min,end_min:exception.end_min};const weekday=new Date(day+'T12:00:00Z').getUTCDay();return db.prepare('SELECT * FROM working_hours WHERE staff_id=? AND weekday=?').get(staffId,weekday)||null;}
function requiredResources(db,serviceId){return db.prepare('SELECT r.* FROM service_resources sr JOIN resources r ON r.id=sr.resource_id WHERE sr.service_id=?').all(serviceId);}
module.exports={scheduleFor,requiredResources};
