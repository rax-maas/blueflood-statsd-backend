
var fs = require('fs');
var metric_utils = require('../lib/metric_utils');

var parsedObj;

function checkSameCounter(assert, counter, longName) {
  assert.strictEqual(parsedObj.counters[longName], counter.value);
  assert.strictEqual(parsedObj.counter_rates[longName], counter.rate);  
}

function checkSameGauge(assert, gauge, longName) {
  assert.strictEqual(parsedObj.gauges[longName], gauge.value);
}

function checkSameTimer(assert, timer, longName) {
  assert.strictEqual(parsedObj.timer_data[longName].count, timer.count);
  assert.strictEqual(parsedObj.timer_data[longName].count_ps, timer.rate);
  assert.strictEqual(parsedObj.timer_data[longName].lower, timer.min);
  assert.strictEqual(parsedObj.timer_data[longName].upper, timer.max);
  assert.strictEqual(parsedObj.timer_data[longName].mean, timer.avg);
  assert.strictEqual(parsedObj.timer_data[longName].median, timer.median);
  assert.strictEqual(parsedObj.timer_data[longName].std, timer.std);
  assert.ok(parsedObj.hasOwnProperty('pctThreshold') && parsedObj.pctThreshold.length > 0);
  parsedObj.pctThreshold.forEach(function(percentile) {
    assert.strictEqual(parsedObj.timer_data[longName][percentile], timer.percentiles[percentile]);
  });
}

function checkSameSet(assert, set, longName) {
  var values = Object.keys(parsedObj.sets[longName].store);
  values.sort();
  set.values.sort();
  assert.ok(values.length > 0);
  assert.deepEqual(values, set.values);
}

exports['setUp'] = function(test, assert) {
  parsedObj = JSON.parse(fs.readFileSync('tests/metrics_bundle.json'));
  assert.ok(parsedObj);
  test.finish();
}

exports['test_counters'] = function(test, assert) {
  var counters = metric_utils.extractCounters(parsedObj),
      names = ['internal.bad_lines_seen', 'internal.packets_received', '3333333.C1s', '3333333.C200ms', '4444444.C10s', '3333333.C29s'],
      visitCount = 0;
  
  assert.strictEqual(6, Object.keys(counters).length);
  assert.strictEqual(0, visitCount);
  
  // ensure all the values were copied across.
  names.forEach(function(key) {
    checkSameCounter(assert, counters[key], key);
    visitCount += 1;
  });
  
  assert.strictEqual(6, visitCount);
  
  test.finish();
}

exports['test_gauges'] = function(test, assert) {
  var gauges = metric_utils.extractGauges(parsedObj),
      names = ['3333333.G1s', '4444444.G200ms', '3333333.G10s', 'internal.timestamp_lag'],
      visitCount = 0;
  
  assert.strictEqual(4, Object.keys(gauges).length);
  assert.strictEqual(0, visitCount);
  
  names.forEach(function(key) {
    checkSameGauge(assert, gauges[key], key);
    visitCount += 1;
  });
  
  assert.strictEqual(4, visitCount);
  
  test.finish();
}

exports['test_sets'] = function(test, assert) {
  var sets = metric_utils.extractSets(parsedObj),
      names = ['4444444.S1s', '3333333.S500ms'],
      visitCount = 0;
  
  assert.strictEqual(2, Object.keys(sets).length);
  assert.strictEqual(0, visitCount);
  
  names.forEach(function(key) {
    checkSameSet(assert, sets[key], key);
    visitCount += 1;
  });
  
  assert.strictEqual(2, visitCount);
  
  test.finish();
}

exports['test_timers'] = function(test, assert) {
  var timers = metric_utils.extractTimers(parsedObj),
      names = ['4444444.T1s',  '3333333.T200ms', '3333333.T10s', '3333333.T29s'],
      visitCount = 0,
      percentileCount = 0;
  
  assert.ok(parsedObj.hasOwnProperty('pctThreshold'));
  assert.strictEqual(5, parsedObj.pctThreshold.length);
  assert.strictEqual(4, Object.keys(timers).length);
  assert.strictEqual(0, visitCount);
  
  names.forEach(function(key) {
    assert.ok(timers[key].hasOwnProperty('percentiles'));
    assert.strictEqual(parsedObj.pctThreshold.length, Object.keys(timers[key].percentiles).length);
    parsedObj.pctThreshold.forEach(function(percentile) {
      assert.strictEqual(parsedObj.timer_data[key][percentile], timers[key].percentiles[percentile]);
      percentileCount += 1;
    });
    checkSameTimer(assert, timers[key], key);
    visitCount += 1;
  });
  
  assert.strictEqual(visitCount, 4);
  assert.strictEqual(percentileCount, 4 * 5); // num_timers * num_percentiles_per_timer
  
  test.finish();
}

exports['test_grouping_by_parsed_tenant'] = function(test, assert) {
  var tenantMap = metric_utils.groupMetricsByTenant(parsedObj),
      tenants = ['3333333', '4444444', 'internal'];
  
  assert.strictEqual(3, Object.keys(tenantMap).length);
  tenants.forEach(function(tenantId) {
    assert.ok(tenantMap.hasOwnProperty(tenantId));
  });
  
  assert.ok(tenantMap['3333333'].counters.hasOwnProperty('C1s'));
  assert.ok(tenantMap['3333333'].counters.hasOwnProperty('C200ms'));
  assert.ok(tenantMap['3333333'].counters.hasOwnProperty('C29s'));
  assert.ok(tenantMap['4444444'].counters.hasOwnProperty('C10s'));
  assert.ok(tenantMap['internal'].counters.hasOwnProperty('bad_lines_seen'));
  assert.ok(tenantMap['internal'].counters.hasOwnProperty('packets_received'));
  
  checkSameCounter(assert, tenantMap['3333333'].counters['C1s'], '3333333.C1s');
  checkSameCounter(assert, tenantMap['3333333'].counters['C200ms'], '3333333.C200ms');
  checkSameCounter(assert, tenantMap['3333333'].counters['C29s'], '3333333.C29s');
  checkSameCounter(assert, tenantMap['4444444'].counters['C10s'], '4444444.C10s');
  checkSameCounter(assert, tenantMap['internal'].counters['bad_lines_seen'], 'internal.bad_lines_seen');
  checkSameCounter(assert, tenantMap['internal'].counters['packets_received'], 'internal.packets_received');
  
  assert.ok(tenantMap['3333333'].gauges.hasOwnProperty('G1s'));
  assert.ok(tenantMap['3333333'].gauges.hasOwnProperty('G10s'));
  assert.ok(tenantMap['4444444'].gauges.hasOwnProperty('G200ms'));
  assert.ok(tenantMap['internal'].gauges.hasOwnProperty('timestamp_lag'));
  
  checkSameGauge(assert, tenantMap['3333333'].gauges['G1s'], '3333333.G1s');
  checkSameGauge(assert, tenantMap['3333333'].gauges['G10s'], '3333333.G10s');
  checkSameGauge(assert, tenantMap['4444444'].gauges['G200ms'], '4444444.G200ms');
  checkSameGauge(assert, tenantMap['internal'].gauges['timestamp_lag'], 'internal.timestamp_lag');
  
  assert.ok(tenantMap['4444444'].timers.hasOwnProperty('T1s'));
  assert.ok(tenantMap['3333333'].timers.hasOwnProperty('T200ms'));
  assert.ok(tenantMap['3333333'].timers.hasOwnProperty('T10s'));
  assert.ok(tenantMap['3333333'].timers.hasOwnProperty('T29s'));
  
  checkSameTimer(assert, tenantMap['4444444'].timers['T1s'], '4444444.T1s');
  checkSameTimer(assert, tenantMap['3333333'].timers['T200ms'], '3333333.T200ms');
  checkSameTimer(assert, tenantMap['3333333'].timers['T10s'], '3333333.T10s');
  checkSameTimer(assert, tenantMap['3333333'].timers['T29s'], '3333333.T29s');
  
  assert.ok(tenantMap['4444444'].sets.hasOwnProperty('S1s'));
  assert.ok(tenantMap['3333333'].sets.hasOwnProperty('S500ms'));
  
  checkSameSet(assert, tenantMap['4444444'].sets['S1s'], '4444444.S1s');
  checkSameSet(assert, tenantMap['3333333'].sets['S500ms'], '3333333.S500ms');
  
  test.finish();
  
  
}