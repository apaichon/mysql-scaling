#!/bin/bash

echo "🚀 Installing MySQL Performance Testing Suite"
echo "=============================================="

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 16+ first."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 16 ]; then
    echo "❌ Node.js version 16+ is required. Current version: $(node -v)"
    exit 1
fi

echo "✅ Node.js $(node -v) detected"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

if [ $? -eq 0 ]; then
    echo "✅ Dependencies installed successfully"
else
    echo "❌ Failed to install dependencies"
    exit 1
fi

# Create necessary directories
echo "📁 Creating directories..."
mkdir -p performance_results
mkdir -p src/lib

echo "✅ Installation completed!"
echo ""
echo "Usage Examples:"
echo "==============="
echo "npm run test:default          # Test default MySQL container"
echo "npm run test:optimized        # Test optimized MySQL container"
echo "npm run test:compare          # Compare both containers"
echo "npm run test:concurrent       # Run concurrent operations test"
echo "npm run test:stress           # Run stress test"
echo ""
echo "Custom usage:"
echo "node src/index.js --container=mysql-default --threads=20 --records=50000 