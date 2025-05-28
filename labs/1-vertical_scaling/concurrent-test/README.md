# MySQL Performance Testing Suite

A comprehensive Node.js-based performance testing suite designed specifically for MySQL vertical scaling analysis on MacBook Pro M1 with 16GB RAM.

## Features

- 🚀 **Comprehensive Testing**: INSERT, SELECT, UPDATE operations
- ⚡ **Concurrent Operations**: Multi-threaded performance testing
- 💪 **Stress Testing**: High-volume and complex query stress tests
- 📊 **Performance Comparison**: Default vs Optimized MySQL configurations
- 📈 **Detailed Reporting**: JSON results and human-readable summaries
- 🎯 **M1 Optimized**: Specifically tuned for Apple Silicon architecture

## Prerequisites

- Node.js 16+ 
- Docker and Docker Compose
- MySQL containers (default and optimized configurations)

## Installation

```bash
# Clone or navigate to the project directory
cd labs/lab1-mysql-vertical-scale

# Run the installation script
chmod +x install.sh
./install.sh

# Or install manually
npm install
```

## Quick Start

```bash
# Start MySQL containers
docker-compose up -d

# Run comprehensive test suite
chmod +x run-tests.sh
./run-tests.sh
```

## Usage Examples

### Basic Testing

```bash
# Test default MySQL configuration
npm run test:default

# Test optimized MySQL configuration  
npm run test:optimized

# Compare both configurations
npm run test:compare
```

### Advanced Testing

```bash
# Concurrent operations test
npm run test:concurrent

# Stress testing
npm run test:stress

# Custom configuration
node src/index.js --container=mysql-optimized --threads=20 --records=100000
```

### Command Line Options

```bash
node src/index.js [options]

Options:
  -c, --container <name>     MySQL container name (default: mysql-default)
  -h, --host <host>          MySQL host (default: localhost)
  -p, --port <port>          MySQL port (default: 3306)
  -u, --user <user>          MySQL user (default: root)
  -w, --password <password>  MySQL password (default: test_password)
  -d, --database <database>  Database name (default: performance_test)
  -t, --threads <number>     Number of concurrent threads (default: 10)
  -r, --records <number>     Number of records per operation (default: 10000)
  -i, --iterations <number>  Number of test iterations (default: 3)
  --compare                  Compare default vs optimized containers
  --stress                   Run stress test
  --concurrent               Run concurrent operations test
  --output <path>            Output directory for results (default: ./performance_results)
```

## Test Types

### 1. Standard Performance Test
- **INSERT**: Batch inserts with progress tracking
- **SELECT**: Complex queries with various conditions
- **UPDATE**: Batch updates with different patterns

### 2. Concurrent Operations Test
- **Multi-threaded INSERTs**: Parallel insert operations
- **Concurrent SELECTs**: Simultaneous read operations
- **Concurrent UPDATEs**: Parallel update operations
- **Mixed Workload**: Combined INSERT/SELECT/UPDATE operations

### 3. Stress Test
- **High-Volume Inserts**: Continuous insert operations
- **Transaction Stress**: Complex transaction scenarios
- **Complex Query Stress**: Resource-intensive queries

## Performance Metrics

The suite tracks comprehensive performance metrics:

- **Throughput**: Records/operations per second
- **Latency**: Average time per operation
- **Memory Usage**: Heap memory consumption
- **MySQL Metrics**: Buffer pool efficiency, connection stats
- **System Resources**: CPU and memory utilization

## Results and Reporting

Results are saved in multiple formats:

- **JSON Files**: Complete test data for analysis
- **Summary Reports**: Human-readable performance summaries
- **Comparison Tables**: Side-by-side configuration comparisons
- **Performance Graphs**: Visual representation of improvements

### Sample Output Structure 