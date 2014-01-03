#!/bin/sh

echo running tests

if [ ! $TEST_FILES ]; then
    TEST_FILES=$(find tests -type f -name "test_*.js" -print0 | tr "\0" " " | sed '$s/.$//')
fi

NODE_PATH=lib NODE_ENV=testing node_modules/whiskey/bin/whiskey \
  --tests "${TEST_FILES}" \
  --real-time \
  --report-timing \
  --timeout 40000 \
  --sequential
 