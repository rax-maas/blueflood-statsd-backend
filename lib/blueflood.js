/*jslint node: true, white: true, sloppy: true */

/*
 * Copyright 2014 Rackspace
 *
 *    Licensed under the Apache License, Version 2.0 (the "License");
 *    you may not use this file except in compliance with the License.
 *    You may obtain a copy of the License at
 *
 *        http://www.apache.org/licenses/LICENSE-2.0
 *
 *    Unless required by applicable law or agreed to in writing, software
 *    distributed under the License is distributed on an "AS IS" BASIS,
 *    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *    See the License for the specific language governing permissions and
 *    limitations under the License.
 */

/*
 Sends data into a running instance of the blueflood system utilizing the HTTP ingestion endpoint.

 specify in the backends section of your statsd conf:

 backends: ['statsd-blueflood-backend'],
 */

var util = require('util');
var StaticTenantBackend = require('./static_tenant_backend').StaticTenantBacked;

var globalBackend = null;
var logAll = false;
var cmendpoint = "https://global.metrics.api.rackspacecloud.com";

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

function loadAuth(bfConfig, logger) {
  var authModule, authClass, auth;
  if (bfConfig.hasOwnProperty('authModule')) {
    authModule = require(bfConfig.authModule);
    authClass = authModule[bfConfig.authClass];
    logger.log('loading auth: ' + bfConfig.authModule + '.' + bfConfig.authClass);
    auth = new authClass(bfConfig.authParams);
  } else {
    logger.log('loading empty auth module')
    authModule = require('./auth');
    authClass = authModule['EmptyAuth'];
    auth = new authClass();
  }
  return auth;
}

/**
 *
 * @param startupTime
 * @param config
 * @param events  an emitter. this is what you need to hook onto.
 * @param logger has a log() method.
 * @returns {boolean}
 */
exports.init = function (startupTime, config, events, logger) {
  var bfConfig = null,
    backendClass = null,
    realLogger,
    endpoint,
    flushIntervalMillis = null,
    auth;
  
  // ensure some kind of logging.
  if (typeof logger !== 'undefined') {
    realLogger = logger;
    moduleLogger = logger;
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
  
  if (config.hasOwnProperty('flushInterval')) {
    flushIntervalMillis = config.flushInterval;
  }
  
  // we're good from here on out.
  
  endpoint = config.blueflood.endpoint || cmendpoint;
  
  auth = loadAuth(config.blueflood, realLogger);
  
  globalBackend = new StaticTenantBackend(bfConfig.tenantId, endpoint, flushIntervalMillis, realLogger, bfConfig.maxjsonsize, auth);
  backendClass = StaticTenantBackend;
  
  // bind here.
  events.on('flush', backendClass.prototype.flush.bind(globalBackend));
  events.on('status', backendClass.prototype.flush.bind(globalBackend));
    
  return true;
}
