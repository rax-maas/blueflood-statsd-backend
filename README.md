# Blueflood StatsD Backend

Assumed endpoint is http://host:port/v1.0/:tenantId/experimental/metrics/statsd.

There are two ways of using this backend:
1. static tenant - tenant is specified in the `blueflood` part of the statsD configuration.  Here is an example:
    "blueflood": {
      "tenantId": "333333",
      "endpoint": "http://127.0.0.1:19000"
    },
2. parsing tenant - if `tenantId` is not specified in the blueflood part of the statsD configuration, then the backend
   assumes that the `tenantId` will be the first part of the metric name (up until the first dot).
   In this case, the single bundle that comes from statsD will be split up into multiple bundles and sent to Blueflood
   in batches.

Payloads are currently formatted like this:

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

