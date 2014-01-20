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

var fs = require('fs');
var metric_utils = require('../lib/metric_utils');
var http_client = require('../lib/blueflood_http_client');

var parsedObj;

function checkSameCounter(assert, counter, longName) {
  // if the counter doesn't exist, it will be null.
  assert.ok(counter);
  assert.strictEqual(parsedObj.counters[longName], counter.value);
  assert.strictEqual(parsedObj.counter_rates[longName], counter.rate);  
}

function checkSameGauge(assert, gauge, longName) {
  assert.ok(gauge);
  assert.strictEqual(parsedObj.gauges[longName], gauge.value);
}

function checkSameTimer(assert, timer, longName) {
  var foundPercentiles = false;
  assert.ok(timer);
  assert.strictEqual(parsedObj.timer_data[longName].count, timer.count);
  assert.strictEqual(parsedObj.timer_data[longName].count_ps, timer.rate);
  assert.strictEqual(parsedObj.timer_data[longName].lower, timer.min);
  assert.strictEqual(parsedObj.timer_data[longName].upper, timer.max);
  assert.strictEqual(parsedObj.timer_data[longName].mean, timer.avg);
  assert.strictEqual(parsedObj.timer_data[longName].median, timer.median);
  assert.strictEqual(parsedObj.timer_data[longName].std, timer.std);
  assert.ok(parsedObj.hasOwnProperty('pctThreshold') && parsedObj.pctThreshold.length > 0);
  assert.ok(timer.hasOwnProperty('percentiles'));
  // there should be one for each of pctThreshold, except for 999, which usually gets cut for being incomplete.
  assert.ok(parsedObj.pctThreshold.length - Object.keys(timer.percentiles).length <= 1);
  
  Object.keys(timer.percentiles).forEach(function(percentile) {
    assert.strictEqual(parsedObj.timer_data[longName]['mean_' + percentile], timer.percentiles[percentile].avg);
    assert.strictEqual(parsedObj.timer_data[longName]['upper_' + percentile], timer.percentiles[percentile].max);
    assert.strictEqual(parsedObj.timer_data[longName]['sum_' + percentile], timer.percentiles[percentile].sum);
    foundPercentiles = true;
  });
  assert.ok(foundPercentiles);
}

function checkSameSet(assert, set, longName) {
  assert.ok(set);
  var values = Object.keys(parsedObj.sets[longName].store);
  values.sort();
  set.values.sort();
  assert.ok(values.length > 0);
  assert.deepEqual(values, set.values);
}

function arrayReduce(dict, element) {
  dict[element.name] = element;
  return dict;
}

exports['setUp'] = function(test, assert) {
  parsedObj = JSON.parse(fs.readFileSync('tests/metrics_bundle.json'));
  assert.ok(parsedObj);
  test.finish();
}

exports['test_counters'] = function(test, assert) {
  var counters = metric_utils.extractCounters(parsedObj),
      names = ['internal.bad_lines_seen', 'internal.packets_received', '3333333.C1s', '3333333.C200ms', '4444444.C10s', '3333333.C29s'],
      visitCount = 0,
      counterDict = counters.reduce(arrayReduce, {});
  
  assert.strictEqual(6, counters.length);
  assert.strictEqual(0, visitCount);
  
  // ensure all the values were copied across.
  names.forEach(function(key) {
    checkSameCounter(assert, counterDict[key], key);
    visitCount += 1;
  });
  
  assert.strictEqual(6, visitCount);
  
  test.finish();
}

exports['test_gauges'] = function(test, assert) {
  var gauges = metric_utils.extractGauges(parsedObj),
      names = ['3333333.G1s', '4444444.G200ms', '3333333.G10s', 'internal.timestamp_lag'],
      visitCount = 0,
      gaugeDict = gauges.reduce(arrayReduce, {});
  
  assert.strictEqual(4, gauges.length);
  assert.strictEqual(0, visitCount);
  
  names.forEach(function(key) {
    checkSameGauge(assert, gaugeDict[key], key);
    visitCount += 1;
  });
  
  assert.strictEqual(4, visitCount);
  
  test.finish();
}

exports['test_sets'] = function(test, assert) {
  var sets = metric_utils.extractSets(parsedObj),
      names = ['4444444.S1s', '3333333.S500ms'],
      visitCount = 0,
      setDict = sets.reduce(arrayReduce, {});
  
  assert.strictEqual(2, sets.length);
  assert.strictEqual(0, visitCount);
  
  names.forEach(function(key) {
    checkSameSet(assert, setDict[key], key);
    visitCount += 1;
  });
  
  assert.strictEqual(2, visitCount);
  
  test.finish();
}

exports['test_timers'] = function(test, assert) {
  var timers = metric_utils.extractTimers(parsedObj),
      names = ['4444444.T1s',  '3333333.T200ms', '3333333.T10s', '3333333.T29s'],
      visitCount = 0,
      timerDict = timers.reduce(arrayReduce, {});
  
  assert.ok(parsedObj.hasOwnProperty('pctThreshold'));
  assert.strictEqual(5, parsedObj.pctThreshold.length);
  assert.strictEqual(4, timers.length);
  assert.strictEqual(0, visitCount);
  
  names.forEach(function(key) {
    checkSameTimer(assert, timerDict[key], key);
    visitCount += 1;
  });
  
  assert.strictEqual(visitCount, 4);
  
  test.finish();
}

function elementWithName(name) {
  return function(a, b) {
    if (a && a.hasOwnProperty('name') && a.name === name) {
      return a;
    } else if (b && b.hasOwnProperty('name') && b.name === name) {
      return b;
    } else {
      return null;
    }
  }
}

function countMetrics(json) {
  var obj = JSON.parse(json),
      count = 0;
  count += obj.gauges.length;
  count += obj.counters.length;
  count += obj.timers.length;
  count += obj.sets.length;
  return count;
}

exports['test_grouping_by_parsed_tenant'] = function(test, assert) {
  var tenantMap = metric_utils.groupMetricsByTenant(parsedObj),
      tenants = ['3333333', '4444444', 'internal'];
  
  assert.strictEqual(3, Object.keys(tenantMap).length);
  tenants.forEach(function(tenantId) {
    assert.ok(tenantMap.hasOwnProperty(tenantId));
  });
  
  checkSameCounter(assert, tenantMap['3333333'].counters.reduce(elementWithName('C1s')), '3333333.C1s');
  checkSameCounter(assert, tenantMap['3333333'].counters.reduce(elementWithName('C200ms')), '3333333.C200ms');
  checkSameCounter(assert, tenantMap['3333333'].counters.reduce(elementWithName('C29s')), '3333333.C29s');
  checkSameCounter(assert, tenantMap['4444444'].counters.reduce(elementWithName('C10s')), '4444444.C10s');
  checkSameCounter(assert, tenantMap['internal'].counters.reduce(elementWithName('bad_lines_seen')), 'internal.bad_lines_seen');
  checkSameCounter(assert, tenantMap['internal'].counters.reduce(elementWithName('packets_received')), 'internal.packets_received');
  
  checkSameGauge(assert, tenantMap['3333333'].gauges.reduce(elementWithName('G1s')), '3333333.G1s');
  checkSameGauge(assert, tenantMap['3333333'].gauges.reduce(elementWithName('G10s')), '3333333.G10s');
  checkSameGauge(assert, tenantMap['4444444'].gauges.reduce(elementWithName('G200ms')), '4444444.G200ms');
  checkSameGauge(assert, tenantMap['internal'].gauges.reduce(elementWithName('timestamp_lag')), 'internal.timestamp_lag');
  
  checkSameTimer(assert, tenantMap['4444444'].timers.reduce(elementWithName('T1s')), '4444444.T1s');
  checkSameTimer(assert, tenantMap['3333333'].timers.reduce(elementWithName('T200ms')), '3333333.T200ms');
  checkSameTimer(assert, tenantMap['3333333'].timers.reduce(elementWithName('T10s')), '3333333.T10s');
  checkSameTimer(assert, tenantMap['3333333'].timers.reduce(elementWithName('T29s')), '3333333.T29s');
  
  checkSameSet(assert, tenantMap['4444444'].sets.reduce(elementWithName('S1s')), '4444444.S1s');
  checkSameSet(assert, tenantMap['3333333'].sets.reduce(elementWithName('S500ms')), '3333333.S500ms');
  
  test.finish();
}

exports['test_specific_histogram_extraction'] = function(test, assert) {
  // 4444444.T1s should only have four bins.
  var tenantInfo = metric_utils.groupMetricsByTenant(parsedObj)['4444444'],
      timer;
  
  assert.ok(tenantInfo.hasOwnProperty('timers'));
  
  timer = tenantInfo.timers.reduce(elementWithName('T1s'));
  
  assert.ok(timer);
  assert.ok(timer.hasOwnProperty('histogram'));
  assert.deepEqual(['bin_100', 'bin_250', 'bin_500', 'bin_inf'], Object.keys(timer.histogram));
  
  test.finish();
}

exports['test_specific_histogram_exclusion'] = function(test, assert) {
  // 3333333.T10s should have no histogram.
  var tenantInfo = metric_utils.groupMetricsByTenant(parsedObj)['3333333'],
      timer;
  
  assert.ok(tenantInfo.hasOwnProperty('timers'));
  
  timer = tenantInfo.timers.reduce(elementWithName('T10s'));
  
  assert.ok(timer);
  assert.ok(!timer.hasOwnProperty('histogram'));
  
  test.finish();
}

exports['test_catch_all_histogram_extraction'] = function(test, assert) {
  // '3333333.T200ms', '3333333.T29s' should have 11 bins.
  var tenantInfo = metric_utils.groupMetricsByTenant(parsedObj)['3333333'],
      timers = ['T200ms', 'T29s'],
      visitCount = 0,
      timer;
  
  assert.ok(tenantInfo.hasOwnProperty('timers'));
  
  timers.forEach(function(timerName) {
    timer = tenantInfo.timers.reduce(elementWithName(timerName));
    assert.ok(timer);
    assert.ok(timer.hasOwnProperty('histogram'));
    assert.strictEqual(11, Object.keys(timer.histogram).length);
    visitCount += 1;
  });
  
  assert.strictEqual(2, visitCount);
  
  test.finish();
}

// tests that metrics payloads get broken up into acceptable sizes.
exports['test_bundling'] = function(test, assert) {
  var gauges = metric_utils.extractGauges(parsedObj),
      counters = metric_utils.extractCounters(parsedObj),
      timers = metric_utils.extractTimers(parsedObj),
      sets = metric_utils.extractSets(parsedObj),
      jsonArray = http_client.buildPayloadsUnsafe('11111111', 22222222, gauges, counters, timers, sets, 15000, 200),
      actualMetricCount = 0;
  
  // it should have been broken up into 12 bundles.
  assert.strictEqual(14, jsonArray.length);
  
  // ensure that we have the expected number of metrics.
  jsonArray.forEach(function(json) {
    actualMetricCount += countMetrics(json);
  });
  
  assert.ok(actualMetricCount > 1);
  assert.strictEqual(gauges.length + counters.length + timers.length + sets.length, actualMetricCount);
  
  test.finish();
}