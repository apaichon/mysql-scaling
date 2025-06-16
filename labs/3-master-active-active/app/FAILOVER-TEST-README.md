# Failover Test Suite

This comprehensive failover test suite simulates various failure scenarios in a MySQL Galera cluster with ProxySQL load balancing to test cluster resilience and recovery capabilities.

## Overview

The failover test suite tests the following scenarios:

1. **Connection Failures** - Simulates nodes that can't connect
2. **Data Load Failures** - Tests behavior when nodes can't load data
3. **Cluster Recovery** - Verifies cluster recovery mechanisms
4. **ProxySQL Failover** - Tests load balancer behavior during failures
5. **Performance Under Failure** - Measures performance during failure conditions

## Test Scenarios

### 1. Connection Failures
- **Node Connection Simulation**: Attempts to connect to invalid ports to simulate node failures
- **Cluster Behavior Analysis**: Tests how remaining nodes handle operations when one node is unreachable
- **Data Replication Verification**: Ensures data is properly replicated between remaining nodes

### 2. Data Load Failures
- **Large Data Load**: Attempts to insert 10,000 records to test capacity limits
- **Corrupted Data Handling**: Tests SQL injection attempts and oversized data
- **Concurrent Load Testing**: Simulates 20 concurrent connections with 50 operations each

### 3. Cluster Recovery
- **Connection Pool Recovery**: Tests pool exhaustion and recovery
- **Query Timeout Recovery**: Simulates long-running queries and timeout handling
- **Transaction Rollback Recovery**: Tests transaction rollback mechanisms

### 4. ProxySQL Failover
- **Read Distribution**: Tests how ProxySQL distributes reads during node failures
- **Write Routing**: Verifies write operations through ProxySQL during failures
- **Connection Failover**: Tests connection management during failures

### 5. Performance Under Failure
- **Read Performance**: Measures read throughput during failure conditions
- **Write Performance**: Measures write throughput during failure conditions
- **Mixed Workload**: Tests combined read/write performance under stress

## Usage

### Prerequisites
- MySQL Galera cluster running (nodes on ports 3306, 3307, 3308)
- ProxySQL running on port 6033
- Node.js and npm installed

### Running the Tests

```bash
# Run the complete failover test suite
node run-failover-test.js

# Or run directly
node failover-test.js
```

### Expected Output

The test suite provides detailed output including:

```
🔄 Starting Comprehensive Failover Tests...

📊 Establishing Baseline Cluster State...
   ✅ Initial cluster size: 3
   ✅ Initial cluster status: Primary

🔌 Testing Connection Failures...
🧪 Testing connection failure simulation for node1...
   ✅ node1 connection failure simulated in 1234ms
   📋 Error: connect ECONNREFUSED 127.0.0.1:9999

📊 Testing Data Load Failures...
   📈 Testing large data load failure...
     📊 Inserted 1000 records, cluster size: 3
   ✅ Successfully inserted 10000 records in 45.23s

⚖️ Testing ProxySQL Failover Behavior...
   🧪 Testing ProxySQL behavior with backend failures...
     📋 Read distribution during node failure...
       📊 Read distribution:
         galera-node1:3306: 8 queries
         galera-node2:3307: 6 queries
         galera-node3:3308: 6 queries

📊 Comprehensive Failover Test Results
============================================================

🔌 Connection Failures:
   ✅ node1: Failed in 1234ms
      Error: connect ECONNREFUSED 127.0.0.1:9999

📊 Data Load Failures:
   ✅ largeDataLoad: 10000 records in 45.23s
      Rate: 221 records/sec

⚡ Performance Under Failure:
   📖 Read Performance: 45 reads/sec (48/50 successful)
   ✍️ Write Performance: 89 writes/sec (95/100 successful)
```

## Configuration

The test suite uses the configuration from `config.js`. Key settings:

```javascript
// Test configuration
test: {
    bulkInsertCount: 1000,        // Number of records for bulk tests
    concurrentConnections: 10,    // Concurrent connections for load testing
    testDuration: 30,             // Test duration in seconds
    operationDelay: 100           // Delay between operations in milliseconds
}
```

## Test Results Interpretation

### Success Indicators
- ✅ Connection failures are properly detected
- ✅ Cluster continues operating with remaining nodes
- ✅ Data replication works between healthy nodes
- ✅ ProxySQL properly routes traffic
- ✅ Performance remains acceptable under failure conditions

### Warning Signs
- ❌ Cluster size decreases unexpectedly
- ❌ Data not replicating between nodes
- ❌ High failure rates in performance tests
- ❌ ProxySQL not routing traffic properly

## Troubleshooting

### Common Issues

1. **Connection Refused Errors**
   - Ensure all MySQL nodes are running
   - Check port configurations in `config.js`
   - Verify network connectivity

2. **ProxySQL Connection Issues**
   - Ensure ProxySQL is running on port 6033
   - Check ProxySQL user credentials
   - Verify backend server configurations

3. **Cluster Health Issues**
   - Check Galera cluster status: `SHOW STATUS LIKE 'wsrep%'`
   - Verify all nodes are in Primary state
   - Check for network partitions

### Debug Mode

To enable more detailed logging, modify the logging level in `config.js`:

```javascript
logging: {
    level: 'debug',  // Change from 'info' to 'debug'
    format: 'detailed'
}
```

## Integration with Monitoring

The test results can be integrated with monitoring systems:

- **Prometheus Metrics**: Export test results as metrics
- **Grafana Dashboards**: Create dashboards for failover test results
- **Alerting**: Set up alerts based on test failure rates
- **Logging**: Send test results to centralized logging systems

## Best Practices

1. **Regular Testing**: Run failover tests regularly (daily/weekly)
2. **Baseline Establishment**: Always establish baseline before testing
3. **Gradual Testing**: Start with small tests and increase load gradually
4. **Monitoring**: Monitor cluster health during tests
5. **Documentation**: Document any failures and recovery procedures

## Customization

You can customize the test suite by:

1. **Adding New Test Scenarios**: Extend the `FailoverTester` class
2. **Modifying Test Parameters**: Adjust values in `config.js`
3. **Adding Custom Metrics**: Implement additional performance measurements
4. **Integration with CI/CD**: Add to automated testing pipelines

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review cluster logs for detailed error information
3. Verify all prerequisites are met
4. Test individual components separately 