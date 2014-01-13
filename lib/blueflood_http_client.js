var url = require('url');
var http = require('http');
var https = require('https');
var fs = require('fs');

var ERR = 'LOG_ERR';

var maxRetries = 5;
var retryDelaySecs = 5;
var userAgent = constructUserAgent();

/**
 * posts raw data to a connection. Retries up to maxRetries times.
 * @param {Object} options HTTP options, including headers..
 * @param {Object} transport http or https module to send data on.
 * @param {String} payload JSON being sent to endpoint.
 * @param {Object} log logging object.
 * @param retry
 */
function postRaw(options, transport, payload, log, retry) {
  // back out if we've retried too many times.
  if (retry >= maxRetries) {
    if (log) {
      log.log('Exceeded retries; failed to send to Blueflood: ' + payload, ERR);
    }
    return;
  }
  
  var request = transport.request(options, function(response) {
    response.on('data', function(data) {
      
      if (Math.floor(response.statusCode / 100) === 5) {
        // 5xx back from BF. ouch. retry?
        if (log) {
          log.log(response.statusCode + ' RETRIES: ' + (maxRetries-retry) + ' PAYLOAD:' + data, ERR);
        }
        setTimeout(postRaw.bind(null, options, transport, payload, log, retry + 1), retryDelaySecs * 1000);
      }
      
      if (Math.floor(response.statusCode / 100) === 4) {
        // 4xx back from BF. clients fault.
        if (log) {
          log.log(response.statusCode + ' ' + data, ERR);
        }
      }
      
      // else gonna assume it was good.
    });
  });
  
  request.setTimeout(10000, function(_request) {
    // log this crap.
    request.end();
  });
  
  request.write(payload);
  request.end();
  
  request.on('error', function(err) {
    // retry once, don't keep going if it fails again.
    if (log) {
      log.log('Request error: ' + JSON.stringify(err), ERR);
    }
    setTimeout(postRaw.bind(null, options, transport, payload, log, Math.max(4, retry + 1)), retryDelaySecs * 1000);
  });
}

/**
 * Takes metrics objects and posts them to an endpoint.
 * @param {String} endpoint http[s]://host:port.
 * @param {Object} log logging object.
 * @param {Number} timestamp seconds since epoch.
 * @param {String} tenantId tenant ID to post as.
 * @param {Object} gauges array of gauge objects.
 * @param {Object} counters array of counter objects.
 * @param {Object} timers array of timer objects.
 * @param {Object} sets array of set objects.
 */
function postMetrics(
  endpoint, log, timestamp,
  tenantId, gauges, counters, timers, sets) {
  
  var payload = JSON.stringify({
    tenantId: tenantId,
    timestamp: timestamp,
    gauges: gauges,
    counters: counters,
    timers: timers,
    sets: sets
  }),
      host = url.parse(endpoint),
      options = {
        host: host.hostname,
        port: host.port || 443,
        path: '/v1.0/' + tenantId + '/experimental/metrics/statsd',
        method: 'POST',
        headers: {
          'Content-Length': payload.length,
          'Content-Type': 'application/json',
          'User-Agent': userAgent
        }
      },
      transport = http;
  
  // check https
  if (host.protocol.match(/https/)) {
    transport = https;
  }
  
  postRaw(options, transport, payload, log, 0);
}

function constructUserAgent() {
  // get the version out of the package.json.
  var version = 'unknown';
  
  try {
    version = JSON.parse(fs.readFileSync(__dirname + '/../package.json', 'UTF-8')).version;
  } catch (err) {
    // ugh.
  }
  
  return 'blueflood-statsd-backend/' + version + ' (node.js)';
}

exports.postMetrics = postMetrics;
exports.postRaw = postRaw;
