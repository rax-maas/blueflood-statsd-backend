/*jslint node: true, white: true, sloppy: true */

/*
 Sends data into a running instance of the blueflood system utilizing the HTTP ingestion endpoint.

 specify in the backends section of your statsd conf:

 backends: ['statsd-blueflood-backend'],
 */

var util = require('util');
var StaticTenantBackend = require('./static_tenant_backend').StaticTenantBacked;

var globalBackend = null;
var logAll = false;

function bluefloodConfigOk(conf, logger) {
  if (!conf.hasOwnProperty('tenantId')) {
    logger.log('Missing tenantId', 'LOG_ERR');
    return false;
  }
  
  if (!conf.hasOwnProperty('endpoint')) {
    logger.log('Missing BF API endpoint', 'LOG_ERR');
    return false;
  }
  
  return true;
}

/**
 *
 * @param startupTime
 * @param config
 * @param events  an emitter. this is what you need to hook onto.
 * @returns {boolean}
 */
exports.init = function (startupTime, config, events, logger) {
  var bfConfig = null,
      backendClass = null,
      realLogger,
      endpoint;
  
  // ensure some kind of logging.
  if (typeof logger !== 'undefined') {
    realLogger = logger;
  } else {
    console.log('module logger is not defined')
    realLogger = util;
  }
  
  // ensure there is a blueflood configuration.
  if (!config.hasOwnProperty('blueflood')) {
    realLogger.log('No configuration for Blueflood');
    return false;
  }
  
  // get the blueflood configuration and verify it.
  bfConfig = config.blueflood;
  if (!bluefloodConfigOk(bfConfig, realLogger)) {
    return false;
  }
  
  // we're good from here on out.
  
  endpoint = config.blueflood.endpoint;
  globalBackend = new StaticTenantBackend(bfConfig.tenantId, endpoint, realLogger);
  backendClass = StaticTenantBackend;
  
  // bind here.
  events.on('flush', backendClass.prototype.flush.bind(globalBackend));
  events.on('status', backendClass.prototype.flush.bind(globalBackend));
    
  return true;
  
}
