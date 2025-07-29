#!/bin/bash

# Numina Server Performance Test Suite
# Tests optimized vs standard server performance

BASE_URL="http://localhost:5000"
RESULTS_FILE="perf-results.txt"

echo "🚀 Numina Server Performance Test Suite" | tee $RESULTS_FILE
echo "=======================================" | tee -a $RESULTS_FILE
echo "Started at: $(date)" | tee -a $RESULTS_FILE
echo "" | tee -a $RESULTS_FILE

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to test endpoint performance
test_endpoint() {
    local name=$1
    local url=$2
    local method=${3:-GET}
    local data=${4:-""}
    local headers=${5:-""}
    
    echo -e "${BLUE}Testing: $name${NC}"
    echo "Testing: $name" >> $RESULTS_FILE
    
    if [ "$method" = "POST" ] && [ -n "$data" ]; then
        # POST with data
        result=$(curl -w "@curl-format.txt" -s -X POST \
            -H "Content-Type: application/json" \
            $headers \
            -d "$data" \
            "$url" 2>/dev/null)
    else
        # GET request
        result=$(curl -w "@curl-format.txt" -s "$url" 2>/dev/null)
    fi
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Success${NC}"
        echo "$result" | tail -1 >> $RESULTS_FILE
    else
        echo -e "${RED}❌ Failed${NC}"
        echo "FAILED" >> $RESULTS_FILE
    fi
    
    echo "" >> $RESULTS_FILE
}

# Function to test memory usage
test_memory() {
    echo -e "${YELLOW}📊 Memory Usage Test${NC}"
    echo "Memory Usage Test" >> $RESULTS_FILE
    
    # Make multiple requests to test memory pressure
    for i in {1..20}; do
        curl -s "$BASE_URL/health" > /dev/null &
    done
    wait
    
    # Get memory usage
    memory_result=$(curl -s "$BASE_URL/health" | jq -r '.memory.heapUsed // "N/A"')
    echo "Memory after 20 concurrent requests: ${memory_result}MB" | tee -a $RESULTS_FILE
    echo "" >> $RESULTS_FILE
}

# Function to test conversation deletion performance
test_conversation_deletion() {
    echo -e "${YELLOW}🗑️ Conversation Deletion Performance${NC}"
    echo "Conversation Deletion Performance" >> $RESULTS_FILE
    
    # Test health endpoint first
    echo "Testing health endpoint..."
    test_endpoint "Health Check" "$BASE_URL/health"
    
    # Note: These would require authentication in real scenario
    echo "Note: Conversation deletion tests require authentication" >> $RESULTS_FILE
    echo "Skipping for now - would need JWT token setup" >> $RESULTS_FILE
    echo "" >> $RESULTS_FILE
}

# Create curl format file for timing
cat > curl-format.txt << 'EOF'
{
  "time_namelookup": %{time_namelookup},
  "time_connect": %{time_connect},
  "time_appconnect": %{time_appconnect},
  "time_pretransfer": %{time_pretransfer},
  "time_redirect": %{time_redirect},
  "time_starttransfer": %{time_starttransfer},
  "time_total": %{time_total},
  "speed_download": %{speed_download},
  "speed_upload": %{speed_upload},
  "size_download": %{size_download},
  "size_upload": %{size_upload},
  "http_code": %{http_code}
}
EOF

# Check if server is running
echo "🔍 Checking if server is running..."
if ! curl -s "$BASE_URL/health" > /dev/null; then
    echo -e "${RED}❌ Server not running on $BASE_URL${NC}"
    echo "Please start the server first with:"
    echo "  node src/server-optimized.js"
    exit 1
fi

echo -e "${GREEN}✅ Server is running${NC}"
echo ""

# Run performance tests
echo "🏃 Running Performance Tests..."
echo ""

# Basic endpoint tests
test_endpoint "Root Endpoint" "$BASE_URL/"
test_endpoint "Health Endpoint" "$BASE_URL/health"  
test_endpoint "Test Endpoint" "$BASE_URL/test"

# Memory testing
test_memory

# Conversation deletion tests
test_conversation_deletion

# Load testing
echo -e "${YELLOW}⚡ Load Testing (10 concurrent requests)${NC}"
echo "Load Testing" >> $RESULTS_FILE

start_time=$(date +%s.%N)
for i in {1..10}; do
    curl -s "$BASE_URL/test" > /dev/null &
done
wait
end_time=$(date +%s.%N)

load_duration=$(echo "$end_time - $start_time" | bc)
echo "10 concurrent requests completed in: ${load_duration}s" | tee -a $RESULTS_FILE
echo "" >> $RESULTS_FILE

# Response time percentiles
echo -e "${YELLOW}📈 Response Time Analysis${NC}"
echo "Response Time Analysis" >> $RESULTS_FILE

echo "Running 50 requests for statistical analysis..."
times=()
for i in {1..50}; do
    time_total=$(curl -w "%{time_total}" -s -o /dev/null "$BASE_URL/test")
    times+=($time_total)
done

# Sort times and calculate percentiles
IFS=$'\n' sorted=($(sort -n <<<"${times[*]}"))
p50_index=$((25))  # 50th percentile (median)
p95_index=$((47))  # 95th percentile
p99_index=$((49))  # 99th percentile

echo "Response time P50: ${sorted[$p50_index]}s" | tee -a $RESULTS_FILE
echo "Response time P95: ${sorted[$p95_index]}s" | tee -a $RESULTS_FILE  
echo "Response time P99: ${sorted[$p99_index]}s" | tee -a $RESULTS_FILE
echo "" >> $RESULTS_FILE

# Final memory check
final_memory=$(curl -s "$BASE_URL/health" | jq -r '.memory.heapUsed // "N/A"')
echo "Final memory usage: ${final_memory}MB" | tee -a $RESULTS_FILE

# Cleanup
rm -f curl-format.txt

echo "" | tee -a $RESULTS_FILE
echo "=======================================" | tee -a $RESULTS_FILE
echo "Test completed at: $(date)" | tee -a $RESULTS_FILE
echo -e "${GREEN}📊 Results saved to: $RESULTS_FILE${NC}"

# Show summary
echo ""
echo -e "${BLUE}📋 Performance Summary:${NC}"
echo -e "  • Health check: $(curl -s "$BASE_URL/health" | jq -r '.status // "unknown"')"
echo -e "  • Memory usage: ${final_memory}MB"
echo -e "  • Response P95: ${sorted[$p95_index]}s"
echo -e "  • Database: $(curl -s "$BASE_URL/health" | jq -r '.database // "unknown"')"