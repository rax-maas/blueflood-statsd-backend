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

var test = require('tape');

var metric_utils = require('../lib/metric_utils');
var http_client = require('../lib/blueflood_http_client');

var parsedObj;

function checkSameCounter(t, counter, longName) {
  // if the counter doesn't exist, it will be null.
  t.ok(counter, 'The counter exists.');
  t.equal(parsedObj.counters[longName], counter.value, 'The counter has the expected value.');
  t.equal(parsedObj.counter_rates[longName], counter.rate, 'The counter has the expected rate.');
}

function checkSameGauge(t, gauge, longName) {
  t.ok(gauge, 'The gauge exists.');
  t.equal(parsedObj.gauges[longName], gauge.value, 'The gauge has the expected value.');
}

function checkSameTimer(t, timer, longName) {
  var foundPercentiles = false;
  t.ok(timer, 'The timer exists.');
  t.equal(parsedObj.timer_data[longName].count, timer.count, 'The timer count has the expected value.');
  t.equal(parsedObj.timer_data[longName].count_ps, timer.rate, 'The timer rate has the expected value.');
  t.equal(parsedObj.timer_data[longName].lower, timer.min, 'The timer min has the expected value.');
  t.equal(parsedObj.timer_data[longName].upper, timer.max, 'The timer max has the expected value.');
  t.equal(parsedObj.timer_data[longName].mean, timer.avg, 'The timer avg has the expected value.');
  t.equal(parsedObj.timer_data[longName].median, timer.median, 'The timer median has the expected value.');
  t.equal(parsedObj.timer_data[longName].std, timer.std, 'The timer std has the expected value.');
  t.ok(parsedObj.hasOwnProperty('pctThreshold') && parsedObj.pctThreshold.length > 0, 'The fixture has a pctThreshold.');
  t.ok(timer.hasOwnProperty('percentiles'), 'The timer has percentiles.');
  // there should be one for each of pctThreshold, except for 999, which usually gets cut for being incomplete.
  t.ok(parsedObj.pctThreshold.length - Object.keys(timer.percentiles).length <= 1, 'The timer has the expected percentiles');

  Object.keys(timer.percentiles).forEach(function(percentile) {
    t.equal(parsedObj.timer_data[longName]['mean_' + percentile], timer.percentiles[percentile].avg, 'This percentile had the expected avg.');
    t.equal(parsedObj.timer_data[longName]['upper_' + percentile], timer.percentiles[percentile].max, 'This percentile had the expected max.');
    t.equal(parsedObj.timer_data[longName]['sum_' + percentile], timer.percentiles[percentile].sum, 'This percentile had the expected sum.');
    foundPercentiles = true;
  });
  t.ok(foundPercentiles, 'Percentiles were found.');
}

function checkSameSet(t, set, longName) {
  t.ok(set, 'The set exists.');
  var values = Object.keys(parsedObj.sets[longName].store);
  values.sort();
  set.values.sort();
  t.ok(values.length > 0, 'The set had at least 1 value.');
  t.deepEqual(values, set.values, 'The set had the expected values.');
}

function arrayReduce(dict, element) {
  dict[element.name] = element;
  return dict;
}

test('setUp', function(t) {
  parsedObj = require('./metrics_bundle.json');
  t.ok(parsedObj, 'The fixture was properly loaded.');
  t.end();
});

test('counters', function(t) {
  var counters = metric_utils.extractCounters(parsedObj),
      names = ['internal.bad_lines_seen', 'internal.packets_received', '3333333.C1s', '3333333.C200ms', '4444444.C10s', '3333333.C29s'],
      visitCount = 0,
      counterDict = counters.reduce(arrayReduce, {});

  t.equal(6, counters.length, 'There are 6 counters.');
  t.equal(0, visitCount, 'The visit count is 0.');

  // ensure all the values were copied across.
  names.forEach(function(key) {
    checkSameCounter(t, counterDict[key], key);
    visitCount += 1;
  });

  t.equal(6, visitCount, 'Each counter was represented.');

  t.end();
});

test('gauges', function(t) {
  var gauges = metric_utils.extractGauges(parsedObj),
      names = ['3333333.G1s', '4444444.G200ms', '3333333.G10s', 'internal.timestamp_lag'],
      visitCount = 0,
      gaugeDict = gauges.reduce(arrayReduce, {});

  t.equal(4, gauges.length, 'There are 4 counters.');
  t.equal(0, visitCount, 'The visit count is 0.');

  names.forEach(function(key) {
    checkSameGauge(t, gaugeDict[key], key);
    visitCount += 1;
  });

  t.equal(4, visitCount, 'Each gauage was checked.');

  t.end();
});

test('sets', function(t) {
  var sets = metric_utils.extractSets(parsedObj),
      names = ['4444444.S1s', '3333333.S500ms'],
      visitCount = 0,
      setDict = sets.reduce(arrayReduce, {});

  t.strictEqual(2, sets.length, 'There are 2 sets.');
  t.strictEqual(0, visitCount, 'The visit count is 0.');

  names.forEach(function(key) {
    checkSameSet(t, setDict[key], key);
    visitCount += 1;
  });

  t.strictEqual(2, visitCount, 'Each set was checked.');

  t.end();
});

test('timers', function(t) {
  var timers = metric_utils.extractTimers(parsedObj),
      names = ['4444444.T1s',  '3333333.T200ms', '3333333.T10s', '3333333.T29s'],
      visitCount = 0,
      timerDict = timers.reduce(arrayReduce, {});

  t.ok(parsedObj.hasOwnProperty('pctThreshold'), 'Our fixture has thresholds.');
  t.equal(5, parsedObj.pctThreshold.length, 'The fixture has 5 thresholds.');
  t.equal(4, timers.length, 'There are 4 timers.');
  t.equal(0, visitCount, 'The visit count is 0.');

  names.forEach(function(key) {
    checkSameTimer(t, timerDict[key], key);
    visitCount += 1;
  });

  t.equal(visitCount, 4, 'Each timer was checked.');

  t.end();
});

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

test('grouping by parsed tenant', function(t) {
  var tenantMap = metric_utils.groupMetricsByTenant(parsedObj),
      tenants = ['3333333', '4444444', 'internal'];

  t.equal(3, Object.keys(tenantMap).length, 'The fixture has 3 tenants.');
  tenants.forEach(function(tenantId) {
    t.ok(tenantMap.hasOwnProperty(tenantId), 'The fixture has the tenants we expect.');
  });

  checkSameCounter(t, tenantMap['3333333'].counters.reduce(elementWithName('C1s')), '3333333.C1s');
  checkSameCounter(t, tenantMap['3333333'].counters.reduce(elementWithName('C200ms')), '3333333.C200ms');
  checkSameCounter(t, tenantMap['3333333'].counters.reduce(elementWithName('C29s')), '3333333.C29s');
  checkSameCounter(t, tenantMap['4444444'].counters.reduce(elementWithName('C10s')), '4444444.C10s');
  checkSameCounter(t, tenantMap['internal'].counters.reduce(elementWithName('bad_lines_seen')), 'internal.bad_lines_seen');
  checkSameCounter(t, tenantMap['internal'].counters.reduce(elementWithName('packets_received')), 'internal.packets_received');

  checkSameGauge(t, tenantMap['3333333'].gauges.reduce(elementWithName('G1s')), '3333333.G1s');
  checkSameGauge(t, tenantMap['3333333'].gauges.reduce(elementWithName('G10s')), '3333333.G10s');
  checkSameGauge(t, tenantMap['4444444'].gauges.reduce(elementWithName('G200ms')), '4444444.G200ms');
  checkSameGauge(t, tenantMap['internal'].gauges.reduce(elementWithName('timestamp_lag')), 'internal.timestamp_lag');

  checkSameTimer(t, tenantMap['4444444'].timers.reduce(elementWithName('T1s')), '4444444.T1s');
  checkSameTimer(t, tenantMap['3333333'].timers.reduce(elementWithName('T200ms')), '3333333.T200ms');
  checkSameTimer(t, tenantMap['3333333'].timers.reduce(elementWithName('T10s')), '3333333.T10s');
  checkSameTimer(t, tenantMap['3333333'].timers.reduce(elementWithName('T29s')), '3333333.T29s');

  checkSameSet(t, tenantMap['4444444'].sets.reduce(elementWithName('S1s')), '4444444.S1s');
  checkSameSet(t, tenantMap['3333333'].sets.reduce(elementWithName('S500ms')), '3333333.S500ms');

  t.end();
});

test('specific histogram extraction', function(t) {
  // 4444444.T1s should only have four bins.
  var tenantInfo = metric_utils.groupMetricsByTenant(parsedObj)['4444444'],
      timer;

  t.ok(tenantInfo.hasOwnProperty('timers'), 'The fixture has timers for the tenant.');

  timer = tenantInfo.timers.reduce(elementWithName('T1s'));

  t.ok(timer, 'The timer exists.');
  t.ok(timer.hasOwnProperty('histogram'), 'The timer has a histogram.');
  t.deepEqual(['bin_100', 'bin_250', 'bin_500', 'bin_inf'], Object.keys(timer.histogram), 'The histogram has the expected bins.');

  t.end();
});

test('specific histogram exclusion', function(t) {
  // 3333333.T10s should have no histogram.
  var tenantInfo = metric_utils.groupMetricsByTenant(parsedObj)['3333333'],
      timer;

  t.ok(tenantInfo.hasOwnProperty('timers'), 'The fixture has timers.');

  timer = tenantInfo.timers.reduce(elementWithName('T10s'));

  t.ok(timer, 'The timer exists.');
  t.ok(!timer.hasOwnProperty('histogram'), 'The timer does not have a histogram');

  t.end();
});

test('catch all histogram extraction', function(t) {
  // '3333333.T200ms', '3333333.T29s' should have 11 bins.
  var tenantInfo = metric_utils.groupMetricsByTenant(parsedObj)['3333333'],
      timers = ['T200ms', 'T29s'],
      visitCount = 0,
      timer;

  t.ok(tenantInfo.hasOwnProperty('timers'), 'The fixture has timers.');

  timers.forEach(function(timerName) {
    timer = tenantInfo.timers.reduce(elementWithName(timerName));
    t.ok(timer, 'The timer exists.');
    t.ok(timer.hasOwnProperty('histogram'), 'The timer has a histogram.');
    t.equal(11, Object.keys(timer.histogram).length, 'The histogram has 11 bins.');
    visitCount += 1;
  });

  t.equal(2, visitCount, 'Each timer was checked.');

  t.end();
});

// tests that metrics payloads get broken up into acceptable sizes.
test('bundling', function(t) {
  var gauges = metric_utils.extractGauges(parsedObj),
      counters = metric_utils.extractCounters(parsedObj),
      timers = metric_utils.extractTimers(parsedObj),
      sets = metric_utils.extractSets(parsedObj),
      maxPayloadSize = 600,
      jsonArray = http_client.buildPayloadsUnsafe('11111111', 22222222, gauges, counters, timers, sets, 15000, maxPayloadSize),
      actualMetricCount = 0;

  // it should have been broken up into 6 bundles.
  t.equal(6, jsonArray.length, 'The payload was broken into 6 bundles.');

  // ensure that we have the expected number of metrics.
  jsonArray.forEach(function(json) {
    payloadLength = json.length;
    if(payloadLength == 643){
      // This test case is validating one case where just one metric is of size 529
      // and when this only one metric is added to the empty payload (size = 114), total size (643) goes beyond max (600)
      // and even though it's bigger than max, it will be sent to Blueflood.
      t.ok(payloadLength > maxPayloadSize, 'Only one payload of size ' + payloadLength + ' is bigger than max limit.');
    }
    else {
      t.ok(payloadLength <= maxPayloadSize, 'Payload of size ' + payloadLength + ' should be less than or equal to max limit.');
    }
    actualMetricCount += countMetrics(json);
  });

  t.ok(actualMetricCount > 1, 'We have more than 1 metric.');
  t.equal(gauges.length + counters.length + timers.length + sets.length, actualMetricCount, 'All of the bundles had the expected total metrics.');

  t.end();
});
