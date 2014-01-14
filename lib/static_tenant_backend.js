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

var util = require('util');
var blueflood_http_client = require('./blueflood_http_client');
var metric_utils = require('./metric_utils');

function StaticTenantBackend(tenantId, endpoint, log) {
  this.tenantId = tenantId;
  this.endpoint = endpoint;
  this.log = log || util;
}

// metrics is unformatted from how statsd delivers.
StaticTenantBackend.prototype.flush = function (timestamp, metrics) {
  var gauges = metric_utils.extractGauges(metrics),
      counters = metric_utils.extractCounters(metrics),
      timers = metric_utils.extractTimers(metrics),
      sets = metric_utils.extractSets(metrics);
  
  blueflood_http_client.postMetrics(this.endpoint, this.log, timestamp, this.tenantId, gauges, counters, timers, sets);
}

// callback takes (unk, 'name', key, value) and gets called multiple times.
StaticTenantBackend.prototype.status = function (statusLineCallback) {
  statusLineCallback(null, 'blueflood-statsd-backend', 'type', 'static-tenant=' + this.tenantId);
  statusLineCallback(null, 'blueflood-statsd-backend', 'status', 'not really implemented yet');
}

exports.StaticTenantBacked = StaticTenantBackend;