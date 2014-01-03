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