
function extractCounters(metrics) {
  var counters = {};
  
  Object.keys(metrics.counters).forEach(function(name) {
    counters[name] = {
      value: metrics.counters[name]
    };
  });
  
  Object.keys(metrics.counter_rates).forEach(function(name) {
    counters[name].rate = metrics.counter_rates[name];
  });
  
  return counters;
}

function extractGauges(metrics) {
  var gauges = {};
  
  Object.keys(metrics.gauges).forEach(function(name) {
    gauges[name] = {
      value: metrics.gauges[name]
    }
  });
  
  return gauges;
}

function extractSets(metrics) {
  var sets = {};
  
  Object.keys(metrics.sets).forEach(function(name) {
    sets[name] = {
      values : Object.keys(metrics.sets[name].store)
    };
  });
  
  return sets;
}

function extractTimers(metrics) {
  var timers = {},
      hasPercentiles = metrics.hasOwnProperty('pctThreshold') && metrics.pctThreshold.length > 0;
  
  Object.keys(metrics.timers).forEach(function(name) {
    timers[name] = {
      count: metrics.timer_data[name].count,
      rate: metrics.timer_data[name].count_ps,
      min: metrics.timer_data[name].lower,
      max: metrics.timer_data[name].upper,
      sum: metrics.timer_data[name].sum,
      avg: metrics.timer_data[name].mean,
      median: metrics.timer_data[name].median,
      std: metrics.timer_data[name].std
    };
    if (hasPercentiles) {
      timers[name].percentiles = {};
      Object.keys(metrics.pctThreshold).forEach(function(percentile) {
        timers[name].percentiles[percentile] = metrics.timer_data[name][percentile];
      });
    }
    
  });
  
  return timers;
}

function affixMetrics(tenantMetrics, tenantId) {
  if (!tenantMetrics.hasOwnProperty(tenantId)) {
    tenantMetrics[tenantId] = {
      gauges: {},
      counters: {},
      timers: {},
      sets: {}
    };
  }
}

function groupMetricsByTenant(metrics) {
  var map = {
      'gauges': extractGauges(metrics),
      'counters': extractCounters(metrics),
      'timers': extractTimers(metrics),
      'sets': extractSets(metrics)
    },
      tenantMetrics = {},
      parts, tenantId, metricName;
  
  Object.keys(map).forEach(function(metricType) {
    Object.keys(map[metricType]).forEach(function(tenantPlusMetricName) {
      parts = tenantPlusMetricName.split('.');
      tenantId = parts.shift();
      metricName = parts.join('.');
      affixMetrics(tenantMetrics, tenantId);
      tenantMetrics[tenantId][metricType][metricName] = map[metricType][tenantPlusMetricName];
    });
  });
  
  return tenantMetrics;
}

exports.extractCounters = extractCounters;
exports.extractGauges = extractGauges;
exports.extractSets = extractSets;
exports.extractTimers = extractTimers;
exports.groupMetricsByTenant = groupMetricsByTenant;