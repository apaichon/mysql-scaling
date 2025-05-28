#!/bin/bash

echo "🧪 MySQL Performance Testing Suite"
echo "=================================="

# Ensure Docker containers are running
echo "🐳 Checking Docker containers..."
if ! docker ps | grep -q mysql-default; then
    echo "❌ mysql-default container is not running"
    echo "Please start containers with: docker-compose up -d"
    exit 1
fi

if ! docker ps | grep -q mysql-optimized; then
    echo "❌ mysql-optimized container is not running"
    echo "Please start containers with: docker-compose up -d"
    exit 1
fi

echo "✅ Docker containers are running"

# Wait for MySQL to be ready
echo "⏳ Waiting for MySQL containers to be ready..."
sleep 10

# Run comprehensive test suite
echo "🚀 Starting comprehensive performance tests..."

echo ""
echo "1️⃣  Testing Default MySQL Configuration..."
npm run test:default

echo ""
echo "2️⃣  Testing Optimized MySQL Configuration..."
npm run test:optimized

echo ""
echo "3️⃣  Running Comparison Analysis..."
npm run test:compare

echo ""
echo "4️⃣  Running Concurrent Operations Test..."
npm run test:concurrent

echo ""
echo "5️⃣  Running Stress Test..."
npm run test:stress

echo ""
echo "✅ All tests completed!"
echo "📊 Check the performance_results directory for detailed reports" 