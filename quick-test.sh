#!/bin/bash

# Quick curl tests for the optimized server

BASE_URL="http://localhost:5000"

echo "🧪 Quick Server Test"
echo "==================="

# Test if server is running
echo "🔍 Testing server availability..."
if curl -s --connect-timeout 5 "$BASE_URL/" > /dev/null; then
    echo "✅ Server is running"
else
    echo "❌ Server not responding"
    exit 1
fi

# Test health endpoint
echo ""
echo "🏥 Health check:"
curl -s "$BASE_URL/health" | jq '.' 2>/dev/null || curl -s "$BASE_URL/health"

# Test response time
echo ""
echo "⏱️  Response time test:"
time_result=$(curl -w "%{time_total}" -s -o /dev/null "$BASE_URL/test")
echo "Response time: ${time_result}s"

# Test memory usage
echo ""
echo "📊 Memory usage:"
memory=$(curl -s "$BASE_URL/health" | jq -r '.memory.heapUsed // "N/A"' 2>/dev/null)
echo "Heap usage: ${memory}MB"

# Test conversation endpoints (basic check)
echo ""
echo "🗨️  Conversation endpoints:"
echo "GET /conversations - $(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/conversations")"

echo ""
echo "✅ Quick tests completed!"