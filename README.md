# Blueflood StatsD Backend

This is a [statsD backend](https://github.com/etsy/statsd/wiki/Backends) that will send metrics aggregated in statsD
to an instance of Blueflood.

## Blueflood Configuration

The Blueflood statsD endpoint is still a work in progress.  
You can track its [progress on github](https://github.com/rackerlabs/blueflood/pull/201).

Assumed endpoint is http://host:port/v1.0/:tenantId/experimental/metrics/statsd.

## StatsD Configuration

Your [statsD configuration file](https://github.com/etsy/statsd/blob/master/exampleConfig.js) will need a `blueflood`
section similar to the way you would have one for graphite or the console if you were using those backends.

Here are the values that are currently honored:

* `tenantId`: (required) This tenantId will be used to publish metrics to Blueflood.
* `endpoint`: (required) The location of the API. e.g.: 'http://metrics.example.com:8080' 

Example configuration:

    static tenant - tenant is specified in the `blueflood` part of the statsD configuration.  Here is an example:
      "blueflood": {
      "tenantId": "333333",
      "endpoint": "http://127.0.0.1:19000"
    },


## Payload format

Payloads sent to Blueflood are currently formatted like this:

    {
      "tenantId": "xxxxxxxx",
      "timestamp": 111111111,
      
      "gauges": [
        { 
          "name": "gauge_name",
          "value": 42
        },
        { 
          "name", "another_gauge",
          "value": 4343
        }
      ],
      
      "counters": [
        {
          "name": "counter_name",
          "value": 32,
          "rate": 2.32
        },
        {
          "name": "another_counter",
          "value": 4424,
          "rate": 52.1
        }
      ],
      
      "timers": [
        {
          "name": "timer_name",
          "count": 32,
          "rate": 2.3,
          "min": 1,
          "max": 5,
          "sum": 21,
          "avg": 2.1,
          "median": 3,
          "std": 1.01,
          "percentiles": {
            "999": 1.22222,
            "98": 1.11111
          },
          "histogram": {
            "bin_50": 0,
            "bin_100": 0,
            "bin_inf": 0
          }
        }
      ],
      
      "sets": [
        {
          "name": "set_name",
          "values": ["foo", "bar", "baz"]
        },
        {
          "name": "another_set",
          "values": ["boo", "far", "zab"]
        }
      ]
    }

## License

This code is licensed under the Apache 2.0 open source license.
