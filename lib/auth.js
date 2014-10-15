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

var http = require('http');
var request = require('request');

function EmptyAuth() { }

// callback(err,...);
EmptyAuth.prototype.authenticate = function(callback) {
  callback(null);
}

EmptyAuth.prototype.getToken = function() {
  return '';
}

// This works against the Rackspace identity service, but could be modified easily to work against just about any
// Openstack identity service.
function RaxAuth(obj) {
  this.raxusername = obj.raxusername;
  this.raxapikey = obj.raxapikey;
  this.url = obj.url || 'https://identity.api.rackspacecloud.com/v2.0/tokens';
  this.token = '';
}

RaxAuth.prototype.authenticate = function(callback) {
  var self = this,
      authstring = JSON.stringify({
        "auth": {
          "RAX-KSKEY:apiKeyCredentials": {
            "username": self.raxusername,
            "apiKey": self.raxapikey
          }
        }
      });
  
  request.post({
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': authstring.length
    },
    url:self.url,
    body: authstring
  }, function(err, response, body) {
    // this is the callback to the POST.
    if (err) {
      callback(err,  null);
    } else if (response.statusCode !== 200) {
      callback(new Error('unexpected HTTP response from auth: ' + response.statusCode), null);
    } else {
      // send back the token.
      self.token = JSON.parse(body).access.token.id;
      callback(null, self.token);
    }
  });
}

RaxAuth.prototype.getToken = function() {
  return this.token;
}

exports.EmptyAuth = EmptyAuth;
exports.RaxAuth = RaxAuth;

