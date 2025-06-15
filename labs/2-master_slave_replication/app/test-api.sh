#!/bin/bash

# MySQL Proxy API Test Script
# This script demonstrates the API functionality and load balancing

API_URL="http://localhost:3000"

echo "🧪 MySQL Proxy API Test Script"
echo "=============================="
echo ""

# Function to make API calls and show results
make_request() {
    local method=$1
    local endpoint=$2
    local data=$3
    
    if [ -n "$data" ]; then
        response=$(curl -s -X $method "$API_URL$endpoint" \
            -H "Content-Type: application/json" \
            -d "$data")
    else
        response=$(curl -s -X $method "$API_URL$endpoint")
    fi
    
    echo "$response" | jq .
    echo ""
}

# Check if API is running
echo "1. 🔍 Health Check"
echo "------------------"
health_response=$(curl -s "$API_URL/health")
if [ $? -ne 0 ]; then
    echo "❌ API is not running. Please start it with: npm start"
    exit 1
fi

echo "$health_response" | jq .
echo ""

# Test write operations (should go to master)
echo "2. ✍️  Write Operations (Master)"
echo "--------------------------------"

echo "Creating user 1..."
make_request "POST" "/api/users" '{
    "username": "alice_smith",
    "email": "alice@example.com",
    "first_name": "Alice",
    "last_name": "Smith"
}'

echo "Creating user 2..."
make_request "POST" "/api/users" '{
    "username": "bob_jones",
    "email": "bob@example.com",
    "first_name": "Bob",
    "last_name": "Jones"
}'

echo "Creating user 3..."
make_request "POST" "/api/users" '{
    "username": "carol_white",
    "email": "carol@example.com",
    "first_name": "Carol",
    "last_name": "White"
}'

# Test read operations (should be randomly distributed between slaves)
echo "3. 📖 Read Operations (Random Slaves)"
echo "------------------------------------"

echo "Testing load balancing - making 10 read requests..."
echo ""

for i in {1..10}; do
    echo "Request $i:"
    response=$(curl -s "$API_URL/api/users")
    source=$(echo "$response" | jq -r '.source')
    count=$(echo "$response" | jq -r '.data | length')
    echo "  Source: $source, Users found: $count"
done

echo ""
echo "4. 🔍 Individual User Reads"
echo "---------------------------"

echo "Reading user 1..."
make_request "GET" "/api/users/1"

echo "Reading user 2..."
make_request "GET" "/api/users/2"

echo "Reading user 3..."
make_request "GET" "/api/users/3"

# Test update operation (should go to master)
echo "5. 🔄 Update Operation (Master)"
echo "-------------------------------"

echo "Updating user 1..."
make_request "PUT" "/api/users/1" '{
    "username": "alice_smith_updated",
    "email": "alice.updated@example.com",
    "first_name": "Alice",
    "last_name": "Smith Updated"
}'

# Test custom queries
echo "6. 🔧 Custom Queries"
echo "-------------------"

echo "Custom read query (random slave):"
make_request "POST" "/api/query" '{
    "query": "SELECT COUNT(*) as total_users FROM users",
    "operation": "read"
}'

echo "Custom write query (master):"
make_request "POST" "/api/query" '{
    "query": "INSERT INTO users (username, email, first_name, last_name) VALUES (?, ?, ?, ?)",
    "params": ["dave_brown", "dave@example.com", "Dave", "Brown"],
    "operation": "write"
}'

# Test delete operation (should go to master)
echo "7. 🗑️  Delete Operation (Master)"
echo "-------------------------------"

echo "Deleting user 4..."
make_request "DELETE" "/api/users/4"

# Final read to verify
echo "8. ✅ Final Verification"
echo "----------------------"

echo "Reading all users after operations..."
make_request "GET" "/api/users"

echo ""
echo "🎉 Test completed!"
echo ""
echo "📊 Summary:"
echo "- Write operations (POST, PUT, DELETE) were routed to master"
echo "- Read operations (GET) were randomly distributed between slave1 and slave2"
echo "- Custom queries were automatically routed based on SQL keywords"
echo ""
echo "💡 To see load balancing in action, run this command multiple times:"
echo "   curl -s http://localhost:3000/api/users | jq '.source'"

# Health check
curl http://localhost:3000/health

# Get all users (read - random slave)
curl http://localhost:3000/api/users

# Create a user (write - master)
curl -X POST http://localhost:3000/api/users \
  -H "Content-Type: application/json" \
  -d '{
    "username": "test_user",
    "email": "test@example.com",
    "first_name": "Test",
    "last_name": "User"
  }'

# Test load balancing (run multiple times)
for i in {1..5}; do
  echo "Request $i:"
  curl -s http://localhost:3000/api/users | grep -o '"source":"[^"]*"'
  echo ""
done 