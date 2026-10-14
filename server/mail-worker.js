'use strict';
const {connect}=require('./db');const {createWorker}=require('./mail');
const db=connect();const worker=createWorker(db);worker.start({keepAlive:true});console.log('Worker de correo iniciado. Proveedor:',worker.provider);
