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

function createGlobalName(name, globalPrefix) {
  return globalPrefix ? [globalPrefix, name].join('.') : name;
}

// array of counters.
function extractCounters(metrics, globalPrefix) {
  var counters = [];
  
  Object.keys(metrics.counters).forEach(function(name) {
    var globalName = createGlobalName(name, globalPrefix);
    counters[globalName] = {
      name: globalName,
      value: metrics.counters[name]
    };
  });
  
  Object.keys(metrics.counter_rates).forEach(function(name) {
    var globalName = createGlobalName(name, globalPrefix);
    counters[globalName].rate = metrics.counter_rates[name];
  });
  
  return Object.keys(counters).map(function(name) {
    return counters[name];
  });
}

// array of gauges.
function extractGauges(metrics, globalPrefix) {
  var gauges = [];
  
  Object.keys(metrics.gauges).forEach(function(name) {
    var globalName = createGlobalName(name, globalPrefix);
    gauges.push({
      name: globalName,
      value: metrics.gauges[name]
    });
  });
  
  return gauges;
}

// array of sets
function extractSets(metrics, globalPrefix) {
  var sets = [];
  
  Object.keys(metrics.sets).forEach(function(name) {
    var globalName = createGlobalName(name, globalPrefix);
    sets.push({
      name: globalName,
      values : Object.keys(metrics.sets[name].store)
    });
  });
  
  return sets;
}

function extractTimers(metrics, globalPrefix) {
  var timers = {},
      hasPercentiles = metrics.hasOwnProperty('pctThreshold') && metrics.pctThreshold.length > 0;

  Object.keys(metrics.timers).forEach(function(name) {
    var globalName = createGlobalName(name, globalPrefix);
    if (!metrics.timer_data[name]) return;
    timers[globalName] = {
      name: name,
      count: metrics.timer_data[name].count == null ? 0 : metrics.timer_data[name].count,
      rate: metrics.timer_data[name].count_ps == null ? 0 : metrics.timer_data[name].count_ps,
      min: metrics.timer_data[name].lower == null ? 0 : metrics.timer_data[name].lower,
      max: metrics.timer_data[name].upper == null ? 0 : metrics.timer_data[name].upper,
      sum: metrics.timer_data[name].sum == null ? 0 : metrics.timer_data[name].sum,
      avg: metrics.timer_data[name].mean == null ? 0 : metrics.timer_data[name].mean,
      median: metrics.timer_data[name].median == null ? 0 : metrics.timer_data[name].median,
      std: metrics.timer_data[name].std == null ? 0 : metrics.timer_data[name].std
    };
    if (hasPercentiles) {
      timers[globalName].percentiles = {};
      metrics.pctThreshold.forEach(function(percentile) {
        // ensure we have a valid percentile before including it. I see nulls and partials all the time.
        var percentilesOk = true;
        ['mean_', 'upper_', 'sum_'].forEach(function(label) {
          percentilesOk = percentilesOk
            && metrics.timer_data[name].hasOwnProperty(label + percentile)
            && metrics.timer_data[name][label + percentile] !== null;
        });
        if (percentilesOk) {
          timers[globalName].percentiles[percentile] = {
            avg: metrics.timer_data[name]['mean_' + percentile],
            max: metrics.timer_data[name]['upper_' + percentile],
            sum: metrics.timer_data[name]['sum_' + percentile]
            
          }
        }
      });
    }
    if (metrics.timer_data[name].hasOwnProperty('histogram')) {
      // this timer has a histogram.
      timers[globalName]['histogram'] = metrics.timer_data[name].histogram;
    }
    
  });
  
  return Object.keys(timers).map(function(name) {
    return timers[name];
  });
}

function affixMetrics(tenantMetrics, tenantId) {
  if (!tenantMetrics.hasOwnProperty(tenantId)) {
    tenantMetrics[tenantId] = {
      gauges: [],
      counters: [],
      timers: [],
      sets: []
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
      parts, tenantId, metricName, tenantPlusMetricName;
  
  Object.keys(map).forEach(function(metricType) {
    map[metricType].forEach(function(metric) {
      tenantPlusMetricName = metric.name;
      parts = tenantPlusMetricName.split('.');
      tenantId = parts.shift();
      metricName = parts.join('.');
      // rename the metric.
      metric.name = metricName;
      affixMetrics(tenantMetrics, tenantId);
      tenantMetrics[tenantId][metricType].push(metric);
    });
  });
  
  return tenantMetrics;
}

exports.extractCounters = extractCounters;
exports.extractGauges = extractGauges;
exports.extractSets = extractSets;
exports.extractTimers = extractTimers;
exports.groupMetricsByTenant = groupMetricsByTenant;
