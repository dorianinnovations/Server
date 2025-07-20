#!/bin/bash

# BRUTAL STRESS TEST FOR NUMINA SERVER
# This will hammer every endpoint with concurrent requests to test performance

SERVER="http://localhost:5000"
CONCURRENT=20
REQUESTS=100

echo "🔥 STARTING BRUTAL STRESS TEST ON NUMINA SERVER"
echo "================================================"
echo "Target: $SERVER"
echo "Concurrent connections: $CONCURRENT"
echo "Total requests per endpoint: $REQUESTS"
echo ""

# Test 1: Health endpoint spam
echo "Test 1: Health endpoint bombardment..."
time curl -s -o /dev/null -w "Health: %{time_total}s %{http_code}\n" \
  $(for i in $(seq 1 $CONCURRENT); do echo "$SERVER/health &"; done)
wait

# Test 2: Multiple concurrent health checks
echo -e "\nTest 2: Concurrent health checks..."
for i in $(seq 1 $CONCURRENT); do
  curl -s -w "Health $i: %{time_total}s %{http_code}\n" "$SERVER/health" &
done
wait

# Test 3: Large payload test (if we had auth)
echo -e "\nTest 3: Large data test..."
LARGE_JSON=$(printf '{"message":"%*s"}' 10000 | tr ' ' 'x')
curl -X POST -H "Content-Type: application/json" \
  -d "$LARGE_JSON" \
  -w "Large payload: %{time_total}s %{http_code}\n" \
  "$SERVER/health" 2>/dev/null

# Test 4: Rapid fire requests
echo -e "\nTest 4: Rapid fire requests..."
start_time=$(date +%s.%N)
for i in $(seq 1 50); do
  curl -s -o /dev/null "$SERVER/health" &
  if (( i % 10 == 0 )); then
    wait
  fi
done
wait
end_time=$(date +%s.%N)
duration=$(echo "$end_time - $start_time" | bc)
echo "50 rapid requests completed in: ${duration}s"

# Test 5: Memory stress test
echo -e "\nTest 5: Memory stress test..."
for i in $(seq 1 30); do
  curl -s -o /dev/null "$SERVER/health" &
  curl -s -o /dev/null "$SERVER/docs" &
  curl -s -o /dev/null "$SERVER/" &
done
wait

# Test 6: Server resource monitoring during stress
echo -e "\nTest 6: Server resource check..."
ps aux | grep "node src/server.js" | grep -v grep | awk '{print "CPU: " $3 "%, Memory: " $4 "%, RSS: " $6 "KB"}'

# Test 7: Connection flood test
echo -e "\nTest 7: Connection flood test..."
for i in $(seq 1 100); do
  timeout 1 curl -s -o /dev/null "$SERVER/health" &
  if (( i % 20 == 0 )); then
    echo "Connections: $i/100"
    wait
  fi
done
wait

# Test 8: Different endpoints stress
echo -e "\nTest 8: Multi-endpoint stress..."
for i in $(seq 1 10); do
  curl -s -o /dev/null -w "Health: %{time_total}s " "$SERVER/health" &
  curl -s -o /dev/null -w "Root: %{time_total}s " "$SERVER/" &
  curl -s -o /dev/null -w "Docs: %{time_total}s\n" "$SERVER/docs" &
done
wait

# Test 9: Keep-alive stress
echo -e "\nTest 9: Keep-alive connection test..."
curl -s -H "Connection: keep-alive" \
  -w "Keep-alive: %{time_total}s %{http_code}\n" \
  "$SERVER/health" "$SERVER/health" "$SERVER/health"

# Test 10: Final server health check
echo -e "\nTest 10: Final server status..."
curl -s -w "Final check: %{time_total}s %{http_code}\n" "$SERVER/health" | jq '.'

echo ""
echo "🎯 STRESS TEST COMPLETED!"
echo "Check server logs for any errors or performance issues."
echo "If server is still responding, optimizations are working! 🚀"