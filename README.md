# Blueflood StatsD Backend

Assumed endpoint is http://host:port/v1.0/:tenantId/experimental/metrics/ingest_bundle.

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

