
var util = require('util');

var blueflood_http_client = require('./blueflood_http_client');
var metric_utils = require('./metric_utils');

function TenantParsingBackend(endpoint, prefixStats, log) {
  this.endpoint = endpoint;
  this.log = log || util;
  this.prefixStats = prefixStats;
}

TenantParsingBackend.prototype.flush = function (timestamp, metrics) {
  var tenantMetrics = metric_utils.groupMetricsByTenant(metrics);
  
  Object.keys(tenantMetrics).forEach(function(tenantId) {
    blueflood_http_client.postMetrics(
      this.endpoint,
      this.log,
      timestamp,
      tenantId, 
      tenantMetrics[tenantId].gauges,
      tenantMetrics[tenantId].counters,
      tenantMetrics[tenantId].timers,
      tenantMetrics[tenantId].sets);
  });
}

TenantParsingBackend.prototype.status = function (write) {
  
}

exports.groupMetricsByTenant = groupMetricsByTenant;
exports.TenantParsingBackend = TenantParsingBackend;

