/*jslint node: true, white: true, sloppy: true */

/*
 Sends data into a running instance of the blueflood system utilizing the HTTP ingestion endpoint.

 specify in the backends section of your statsd conf:

 backends: ['statsd-blueflood-backend'],
 */

var util = require('util');
var TenantParsingBackend = require('./tenant_parsing_backend').TenantParsingBackend;
var StaticTenantBackend = require('./static_tenant_backend').StaticTenantBacked;

var globalBackend = null;
var logAll = false;

function DumpingBackend(startupTime, statsdConfig, logger) {
  // configure logging.
  if (typeof logger !== 'undefined') {
    this.log = logger;
    logAll = true;
  } else {
    this.log = util.log.bind(null);
    logAll = false;
  }
}

DumpingBackend.prototype.flush = function (timestamp, metrics) {
  console.log(JSON.stringify(metrics, function(k,v) {return v; }, 2));
  console.log('\n');
}

DumpingBackend.prototype.status = function (write) {
  console.log('STATUS');
  ['lastFlush', 'lastException'].forEach(function(key) {
    write(null, 'console', key, this[key]);
  }, this);
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
  
  if (typeof logger !== 'undefined') {
    console.log('LOGGER IS REAL');
    realLogger = logger;
  } else {
    console.log('ES IST NICHT REAL; ES IST EINE FALSCHUNG')
    realLogger = util;
  }
  
  if (config.hasOwnProperty('blueflood')) {
    bfConfig = config.blueflood;
    endpoint = config.blueflood.endpoint;
    
    if (bfConfig.hasOwnProperty('tenantId')) {
      // static tenant backend.
      globalBackend = new StaticTenantBackend(bfConfig.tenantId, endpoint, realLogger);
      backendClass = StaticTenantBackend;
    } else {
      // tenant is part of metric name.
      globalBackend = new TenantParsingBackend(endpoint, config.prefixStats || 'statsd', realLogger);
      backendClass = TenantParsingBackend;
    }
    
    if (bfConfig.hasOwnProperty('consoleDumpingOnly')) {
      realLogger.log('Blueflood emitting to console only', 'LOG_INFO');
      globalBackend = new DumpingBackend(startupTime, config, logger);
      backendClass = DumpingBackend;
    }
    
    // bind here.
    events.on('flush', backendClass.prototype.flush.bind(globalBackend));
    events.on('status', backendClass.prototype.flush.bind(globalBackend));
    
    return true;
  } else {
    return false;
  }
}
