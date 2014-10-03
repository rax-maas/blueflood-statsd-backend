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

var url = require('url');
var http = require('http');
var request = require('request');

var https = require('https');
var fs = require('fs');

var ERR = 'LOG_ERR';
var MAX_JSON_SIZE = 1048576;
var MAX_RETRIES = 5;
var RETRY_DELAY_SECS = 5;

var auth_token = null;
var userAgent = constructUserAgent();

/**
 * posts raw data to a connection. Retries up to MAX_RETRIES times.
 * @param {Object} options HTTP options, including headers..
 * @param {Object} transport http or https module to send data on.
 * @param {String} payload JSON being sent to endpoint.
 * @param {Object} log logging object.
 * @param retry
 */
function postRaw(options, transport, payload, log, retry,username,apiKey) {
  // back out if we've retried too many times.
  if (retry >= MAX_RETRIES) {
    if (log) {
      log.log('Exceeded retries; failed to send to Blueflood: ' + payload, ERR);
    }
    return;
  }
  
  var request = transport.request(options, function(response) {
    response.on('data', function(data) {
      if (response.statusCode == 401) {
        var reauth_callback = function (token) {
          if(token != null || typeof token != 'undefined') {
            var headers =  {
              'Content-Length': payload.length,
              'Content-Type': 'application/json',
              'User-Agent': userAgent,
              'x-auth-token':token
            } 
        
          authtoken = token
          options.headers = headers
          setTimeout(postRaw.bind(null, options, transport, payload, log, retry + 1), RETRY_DELAY_SECS * 1000);
        }
        else {
          var error = new Error('Reauthentication failed. Cannot send metrics to cloud metrics - check raxusername and raxapikey');
          var message = JSON.stringify(error, ['stack', 'message'], 2)
          console.error(message)
        }
      }
      authenticate(this.tenantId,username,apiKey,reauth_callback);
    }

    if (Math.floor(response.statusCode / 100) === 5) {
      // 5xx back from BF. ouch. retry?
      if (log) {
        log.log(response.statusCode + ' RETRIES: ' + (MAX_RETRIES-retry) + ' PAYLOAD:' + data, ERR);
      }
      setTimeout(postRaw.bind(null, options, transport, payload, log, retry + 1), RETRY_DELAY_SECS * 1000);
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
    setTimeout(postRaw.bind(null, options, transport, payload, log, Math.max(4, retry + 1)), RETRY_DELAY_SECS * 1000);
  });
}

function authenticate(tenantid,username,apikey,callback) {
  token = null;
  console.log(apikey);
  console.log(username);

  authjson = {
    "auth": {
      "RAX-KSKEY:apiKeyCredentials": {
        "username": username,
        "apiKey": apikey
      }
    }
  }

  authstring = JSON.stringify(authjson);

  request.post({
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': authstring.length
    },
    url:  'https://identity.api.rackspacecloud.com/v2.0/tokens',
    body: authstring
  }, function(error, response, body){
    if (!error && response.statusCode == 200) {    
      var result = JSON.parse(body);
      token = result.access.token.id;
      console.log("Token: "+token);
      callback(token);
    }
    else {
      var message = JSON.stringify(error, ['stack', 'message'], 2);
      console.error(message);
    }
  });
}

/**
 * The Blueflood HTTP endpoint has a maximum allowable body size, currently 1MB (reflected in MAX_JSON_SIZE here).
 * Note that if any single metric is bigger than max || MAX_JSON_SIZE, it will be included (by itself).
 * @param {string} tenantId tenant ID to use in constructed payloads.
 * @param {Number} timestamp timestamp to use in constructed payloads.
 * @param {Array} gauges Gauge objects to place into payloads.
 * @param {Array} counters Counter objects to place into payloads.
 * @param {Array} timers Timer objects to place into payloads.
 * @param {Array} sets Set objects to place into payloads.
 * @param {Number} flushInterval (optional) expected interval that metrics are flushed in. null is ok.
 * @param {Number} max Maximum size per payload (will default to MAX_JSON_SIZE).
 * @returns {Array} An array of JSON payload strings, ready to POST.
 */
function buildPayloads(tenantId, timestamp, gauges, counters, timers, sets, flushInterval, max) {
  var payloads = [],
      basePayload = {
  tenantId: tenantId,
  timestamp: timestamp,
  flushInterval: flushInterval,
  gauges: [],
  counters: [],
  timers: [],
  sets: []
      },
      basePayloadLength = JSON.stringify(basePayload).length,
      curJsonSize = basePayloadLength,
      payloadObj = {gauges: gauges, counters: counters, timers: timers, sets:sets},
      objLength,
      realMax = max || MAX_JSON_SIZE;
  
  Object.keys(payloadObj).forEach(function(label) {

    payloadObj[label].forEach(function(metric) {
      objLength = JSON.stringify(metric).length;
      // if objLength > realMax, we will end up sending a bundle that is too large. we'll let the client deal with
      // that. there isn't much we can do about it.
      if (curJsonSize + objLength > realMax) {
        // send and start over.
        payloads.push(JSON.stringify(basePayload));
        basePayload = {
          tenantId: tenantId,
          timestamp: timestamp,
          flushInterval: flushInterval,
          gauges: [],
          counters: [],
          timers: [],
          sets: []
        }
        curJsonSize = basePayloadLength;
      }
      basePayload[label].push(metric);
      curJsonSize += objLength;
    });
  });
  
  payloads.push(JSON.stringify(basePayload));
  
  return payloads;
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
 * @param {Number} flushInterval (optional) flush interval as configured in statsD.
 */
function postMetrics(
  endpoint, log, timestamp,
  tenantId, gauges, counters, timers, sets, flushInterval, username, apiKey) {
  console.log("Posting metrics to blueflood");

  var postmetrics = function(token) { 
    auth_token = token;
    var payloads = buildPayloads(tenantId, timestamp, gauges, counters, timers, sets, flushInterval, MAX_JSON_SIZE),
        host = url.parse(endpoint),
        options = {
    host: host.hostname,
    port: host.port || 443,
    path: '/v2.0/' + tenantId + '/ingest/aggregated',
    method: 'POST',
    headers: {
            'Content-Length': 0,
            'Content-Type': 'application/json',
            'User-Agent': userAgent,
            'x-auth-token':auth_token
    }
  },
        transport = http;
  
    // check https
    if (host.protocol.match(/https/)) {
      transport = https;
    }
  
    payloads.forEach(function(payload) {
      // kinda hacky, but hey...
      options.headers['Content-Length'] = payload.length;
      postRaw(options, transport, payload, log, 0,username,apiKey);
    });
  }

  if (auth_token === null || typeof auth_token === 'undefined') {
    authenticate(this.tenantId,username,apiKey,postmetrics);
  }
  else {
    postmetrics(auth_token);   
  } 
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

exports.authenticate = authenticate;
exports.postMetrics = postMetrics;
exports.postRaw = postRaw;
exports.buildPayloadsUnsafe = buildPayloads;
