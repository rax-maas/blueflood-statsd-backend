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

function StaticTenantBackend(tenantId, endpoint,apiKey,flushInterval, log) {
  this.tenantId = tenantId;
  this.endpoint = endpoint;
  this.apiKey = apiKey;
  this.log = log || util;
  this.flushInterval = flushInterval;
  var self = this;


  var auth_callback = function(token) {
		if (token === null) {
			console.log("token null omg! error!!!!");
		}
		else {
			console.log("token not null! yayyy!");
			self.token = token;
			this.token = token;
		}
	}

	blueflood_http_client.authenticate(this.tenantId,"89ecb97253191d56c1689c0d019c55b6","corpdev0paxon0",auth_callback);
}

// metrics is unformatted from how statsd delivers.
// keep in mind the timestamp as passed in is seconds-since-epoch.
StaticTenantBackend.prototype.flush = function (timestamp, metrics) {
  console.log(metrics);
  console.log("TOKENNNNNN"+this.token);
  var gauges = metric_utils.extractGauges(metrics),
      counters = metric_utils.extractCounters(metrics),
      timers = metric_utils.extractTimers(metrics),
      sets = metric_utils.extractSets(metrics),
      timestampInMillis = timestamp * 1000;

    if(this.token != null || typeof this.token != 'undefined') {
		blueflood_http_client.postMetrics(this.endpoint, this.log, timestampInMillis, this.tenantId, gauges, counters, timers, sets, this.flushInterval);
	}
}

// callback takes (unk, 'name', key, value) and gets called multiple times.
StaticTenantBackend.prototype.status = function (statusLineCallback) {
  statusLineCallback(null, 'blueflood-statsd-backend', 'type', 'static-tenant=' + this.tenantId);
  statusLineCallback(null, 'blueflood-statsd-backend', 'status', 'not really implemented yet');
}

exports.StaticTenantBacked = StaticTenantBackend;
