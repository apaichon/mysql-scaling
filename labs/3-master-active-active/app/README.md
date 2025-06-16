# MySQL Galera Cluster with ProxySQL Load Balancing

This application provides comprehensive testing and monitoring capabilities for a MySQL Galera cluster with ProxySQL load balancing.

## Overview

The application includes:
- **Cluster Health Monitoring**: Real-time cluster status and health checks
- **Load Testing**: Performance testing with concurrent connections
- **Failover Testing**: Comprehensive failover scenario testing
- **Replication Testing**: Data replication verification across nodes
- **ProxySQL Integration**: Load balancer testing and monitoring

## Files

### Core Application
- `index.js` - Main application entry point
- `database.js` - Database connection and query management
- `config.js` - Configuration settings
- `package.json` - Node.js dependencies

### Testing Suites
- `test-cluster.js` - Comprehensive cluster testing suite
- `load-test.js` - Load testing with concurrent connections
- `failover-test.js` - Advanced failover testing (requires full cluster)
- `simple-failover-test.js` - Simplified failover testing (works with partial cluster)
- `test-fix.js` - Quick cluster health check

### Documentation
- `README.md` - This file
- `FAILOVER-TEST-README.md` - Detailed failover test documentation

## Quick Start

### Prerequisites
- MySQL Galera cluster running (nodes on ports 3306, 3307, 3308)
- ProxySQL running on port 6033
- Node.js and npm installed

### Installation
```bash
npm install
```

### Running Tests

#### 1. Quick Health Check
```bash
node test-fix.js
```

#### 2. Simple Failover Test (Recommended)
```bash
node simple-failover-test.js
```

#### 3. Comprehensive Cluster Test
```bash
node test-cluster.js
```

#### 4. Load Testing
```bash
node load-test.js
```

#### 5. Advanced Failover Test (requires full cluster)
```bash
node failover-test.js
```

## Failover Testing

The failover test suite simulates various failure scenarios:

### Connection Failures
- **Invalid Port**: Tests connection to non-existent ports
- **Invalid Host**: Tests connection to unreachable hosts
- **Invalid Credentials**: Tests authentication failures

### Data Load Failures
- **Large Data Load**: Tests capacity limits with bulk inserts
- **Corrupted Data**: Tests SQL injection and oversized data handling
- **Concurrent Load**: Tests behavior under high concurrency

### Cluster Recovery
- **Connection Pool Recovery**: Tests pool exhaustion and recovery
- **Query Timeout Recovery**: Tests long-running query handling
- **Transaction Rollback Recovery**: Tests transaction rollback mechanisms

### ProxySQL Failover
- **Read Distribution**: Tests load balancer read distribution
- **Write Routing**: Tests write operation routing
- **Connection Failover**: Tests connection management

### Performance Under Failure
- **Read Performance**: Measures read throughput during failures
- **Write Performance**: Measures write throughput during failures
- **Mixed Workload**: Tests combined read/write performance

## Configuration

Edit `config.js` to customize:
- Database connection settings
- Test parameters (record counts, timeouts, etc.)
- Logging levels

## Expected Output

### Successful Failover Test
```
🔄 Starting Simple Failover Tests...

🔍 Discovering Available Nodes...
   ✅ Available nodes: node1, node3

🔌 Testing Connection Failures...
   ✅ node1_invalid_port: Failed in 2ms
   ✅ node1_invalid_host: Failed in 5002ms
   ✅ node1_invalid_credentials: Failed in 10ms

📊 Data Load Failures:
   ✅ largeDataLoad: 1000 records in 0.39s
   📊 concurrentLoad: 5 successful, 0 failed

⚡ Performance Under Failure:
   📖 Read Performance: 2222 reads/sec (20/20 successful)
   ✍️ Write Performance: 1923 writes/sec (50/50 successful)

🎉 Simple failover test suite completed!
```

## Troubleshooting

### Common Issues

1. **Connection Refused Errors**
   - Ensure MySQL nodes are running
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

Enable detailed logging in `config.js`:
```javascript
logging: {
    level: 'debug',
    format: 'detailed'
}
```

## Best Practices

1. **Regular Testing**: Run failover tests regularly (daily/weekly)
2. **Baseline Establishment**: Always establish baseline before testing
3. **Gradual Testing**: Start with simple tests and increase complexity
4. **Monitoring**: Monitor cluster health during tests
5. **Documentation**: Document any failures and recovery procedures

## Integration

The test results can be integrated with:
- **Prometheus Metrics**: Export test results as metrics
- **Grafana Dashboards**: Create dashboards for test results
- **Alerting**: Set up alerts based on test failure rates
- **CI/CD**: Add to automated testing pipelines

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review cluster logs for detailed error information
3. Verify all prerequisites are met
4. Test individual components separately
5. Check the `FAILOVER-TEST-README.md` for detailed failover testing information 