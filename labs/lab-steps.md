# MySQL Scaling Labs - Objectives and Implementation Guide

## Lab 1: Vertical Scaling (Configuration Optimization)

### Objective
Test and compare MySQL performance before and after configuration optimization on a MacBook Pro with 16GB RAM.

### What to Code/Implement

#### 1. Performance Testing Framework
```javascript
// src/index.js - Main testing application
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

class MySQLPerformanceTester {
  constructor(config) {
    this.config = config;
    this.results = [];
  }

  async connect() {
    this.connection = await mysql.createConnection({
      host: 'localhost',
      port: this.config.port || 3306,
      user: 'root',
      password: 'test_password',
      database: 'testdb'
    });
  }

  async runInsertTest(records = 10000) {
    const startTime = Date.now();
    
    // Create test table
    await this.connection.execute(`
      CREATE TABLE IF NOT EXISTS performance_test (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100),
        email VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Batch insert records
    const batchSize = 1000;
    for (let i = 0; i < records; i += batchSize) {
      const values = [];
      for (let j = 0; j < Math.min(batchSize, records - i); j++) {
        values.push([`user_${i + j}`, `user${i + j}@example.com`]);
      }
      await this.connection.query(
        'INSERT INTO performance_test (name, email) VALUES ?',
        [values]
      );
    }

    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;
    const recordsPerSecond = Math.round(records / duration);

    return {
      test: 'INSERT',
      records,
      duration,
      recordsPerSecond,
      timestamp: new Date().toISOString()
    };
  }

  async runSelectTest() {
    const startTime = Date.now();
    
    // Complex SELECT with JOIN and aggregation
    const [rows] = await this.connection.execute(`
      SELECT 
        COUNT(*) as total_records,
        AVG(LENGTH(name)) as avg_name_length,
        COUNT(DISTINCT email) as unique_emails
      FROM performance_test
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 1 HOUR)
    `);

    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;

    return {
      test: 'SELECT',
      duration,
      result: rows[0],
      timestamp: new Date().toISOString()
    };
  }

  async runUpdateTest(records = 5000) {
    const startTime = Date.now();
    
    // Batch UPDATE operations
    await this.connection.execute(`
      UPDATE performance_test 
      SET name = CONCAT(name, '_updated')
      WHERE id <= ?
    `, [records]);

    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;
    const recordsPerSecond = Math.round(records / duration);

    return {
      test: 'UPDATE',
      records,
      duration,
      recordsPerSecond,
      timestamp: new Date().toISOString()
    };
  }

  async runConcurrentTest(threads = 10, records = 10000) {
    const promises = [];
    for (let i = 0; i < threads; i++) {
      promises.push(this.runInsertTest(records));
    }
    
    const startTime = Date.now();
    const results = await Promise.all(promises);
    const endTime = Date.now();
    
    return {
      test: 'CONCURRENT',
      threads,
      totalRecords: threads * records,
      duration: (endTime - startTime) / 1000,
      individualResults: results,
      timestamp: new Date().toISOString()
    };
  }

  async saveResults(containerName) {
    const filename = `performance_results_${containerName}_${Date.now()}.json`;
    const filepath = path.join(__dirname, '..', 'performance_results', filename);
    
    fs.writeFileSync(filepath, JSON.stringify(this.results, null, 2));
    console.log(`Results saved to: ${filepath}`);
  }
}

// CLI interface
const args = process.argv.slice(2);
const config = {
  container: 'mysql-default',
  port: 3306,
  stress: false,
  concurrent: false,
  threads: 10,
  records: 10000,
  compare: false
};

// Parse command line arguments
args.forEach(arg => {
  if (arg.startsWith('--')) {
    const [key, value] = arg.substring(2).split('=');
    if (key === 'port') {
      config[key] = parseInt(value);
    } else if (key === 'threads' || key === 'records') {
      config[key] = parseInt(value);
    } else if (key === 'stress' || key === 'concurrent' || key === 'compare') {
      config[key] = true;
    } else {
      config[key] = value;
    }
  }
});

module.exports = { MySQLPerformanceTester, config };
```

#### 2. Docker Configuration
```yaml
# docker-compose.yml
version: '3.8'

services:
  mysql-default:
    image: mysql:8.0
    container_name: mysql-default
    environment:
      MYSQL_ROOT_PASSWORD: test_password
      MYSQL_DATABASE: testdb
    ports:
      - "3306:3306"
    volumes:
      - ./mysql/default.cnf:/etc/mysql/conf.d/mysql.cnf
      - mysql_default_data:/var/lib/mysql
    profiles:
      - default

  mysql-optimized:
    image: mysql:8.0
    container_name: mysql-optimized
    environment:
      MYSQL_ROOT_PASSWORD: test_password
      MYSQL_DATABASE: testdb
    ports:
      - "3307:3306"
    volumes:
      - ./mysql/optimized.cnf:/etc/mysql/conf.d/mysql.cnf
      - mysql_optimized_data:/var/lib/mysql
    profiles:
      - optimized

volumes:
  mysql_default_data:
  mysql_optimized_data:
```

#### 3. Configuration Files
```ini
# mysql/default.cnf
[mysqld]
innodb_buffer_pool_size = 128M
max_connections = 151
innodb_io_capacity = 200
sort_buffer_size = 256K
tmp_table_size = 16M
innodb_flush_log_at_trx_commit = 1
innodb_log_file_size = 48M
innodb_log_buffer_size = 16M
thread_cache_size = 9
table_open_cache = 4000
max_allowed_packet = 64M
```

```ini
# mysql/optimized.cnf
[mysqld]
innodb_buffer_pool_size = 6G
max_connections = 200
innodb_io_capacity = 1000
sort_buffer_size = 1M
tmp_table_size = 64M
innodb_flush_log_at_trx_commit = 2
innodb_log_file_size = 128M
innodb_log_buffer_size = 32M
thread_cache_size = 16
table_open_cache = 8000
max_allowed_packet = 128M
```

## Lab 2: Master-Slave Replication

### Objective
Set up and test MySQL master-slave replication with automatic configuration and monitoring.

### What to Code/Implement

#### 1. Automated Setup Script
```bash
#!/bin/bash
# setup-replication.sh

set -e

echo "🚀 Starting MySQL Master-Slave Replication Setup..."

# Start containers
docker-compose up -d

echo "⏳ Waiting for containers to be ready..."
sleep 30

# Wait for MySQL to be ready
wait_for_mysql() {
    local container=$1
    local max_attempts=30
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if docker exec $container mysqladmin ping -h localhost --silent; then
            echo "✅ $container is ready"
            return 0
        fi
        echo "⏳ Waiting for $container... (attempt $attempt/$max_attempts)"
        sleep 2
        attempt=$((attempt + 1))
    done
    
    echo "❌ $container failed to start"
    return 1
}

wait_for_mysql mysql-master
wait_for_mysql mysql-slave1
wait_for_mysql mysql-slave2

# Get master status
echo "📊 Getting master status..."
MASTER_STATUS=$(docker exec mysql-master mysql -uroot -pmasterpassword -e "SHOW MASTER STATUS\G")
LOG_FILE=$(echo "$MASTER_STATUS" | grep "File:" | awk '{print $2}')
LOG_POS=$(echo "$MASTER_STATUS" | grep "Position:" | awk '{print $2}')

echo "📝 Master log file: $LOG_FILE, position: $LOG_POS"

# Configure slaves
configure_slave() {
    local slave_container=$1
    local slave_port=$2
    
    echo "🔧 Configuring $slave_container..."
    
    docker exec $slave_container mysql -uroot -pslavepassword -e "
    STOP SLAVE;
    RESET SLAVE ALL;
    CHANGE MASTER TO
        MASTER_HOST='mysql-master',
        MASTER_USER='replicator',
        MASTER_PASSWORD='replicatorpassword',
        MASTER_LOG_FILE='$LOG_FILE',
        MASTER_LOG_POS=$LOG_POS;
    START SLAVE;
    "
    
    # Verify slave status
    SLAVE_STATUS=$(docker exec $slave_container mysql -uroot -pslavepassword -e "SHOW SLAVE STATUS\G")
    IO_RUNNING=$(echo "$SLAVE_STATUS" | grep "Slave_IO_Running:" | awk '{print $2}')
    SQL_RUNNING=$(echo "$SLAVE_STATUS" | grep "Slave_SQL_Running:" | awk '{print $2}')
    
    if [ "$IO_RUNNING" = "Yes" ] && [ "$SQL_RUNNING" = "Yes" ]; then
        echo "✅ $slave_container replication is running"
    else
        echo "❌ $slave_container replication failed"
        echo "IO Running: $IO_RUNNING"
        echo "SQL Running: $SQL_RUNNING"
        return 1
    fi
}

configure_slave mysql-slave1 3307
configure_slave mysql-slave2 3308

echo "🎉 Master-Slave replication setup complete!"
```

#### 2. Replication Testing Script
```javascript
// test-replication.js
const mysql = require('mysql2/promise');

class ReplicationTester {
  constructor() {
    this.master = null;
    this.slave1 = null;
    this.slave2 = null;
  }

  async connect() {
    this.master = await mysql.createConnection({
      host: 'localhost',
      port: 3306,
      user: 'root',
      password: 'masterpassword',
      database: 'testdb'
    });

    this.slave1 = await mysql.createConnection({
      host: 'localhost',
      port: 3307,
      user: 'root',
      password: 'slavepassword',
      database: 'testdb'
    });

    this.slave2 = await mysql.createConnection({
      host: 'localhost',
      port: 3308,
      user: 'root',
      password: 'slavepassword',
      database: 'testdb'
    });
  }

  async testReplication() {
    console.log('🧪 Testing replication...');

    // Insert data on master
    const testData = {
      username: `test_user_${Date.now()}`,
      email: `test${Date.now()}@example.com`,
      first_name: 'Test',
      last_name: 'User'
    };

    await this.master.execute(
      'INSERT INTO users (username, email, first_name, last_name) VALUES (?, ?, ?, ?)',
      [testData.username, testData.email, testData.first_name, testData.last_name]
    );

    console.log('✅ Data inserted on master');

    // Wait for replication
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Verify on slaves
    const [slave1Result] = await this.slave1.execute(
      'SELECT * FROM users WHERE username = ?',
      [testData.username]
    );

    const [slave2Result] = await this.slave2.execute(
      'SELECT * FROM users WHERE username = ?',
      [testData.username]
    );

    if (slave1Result.length > 0 && slave2Result.length > 0) {
      console.log('✅ Replication verified on both slaves');
      return true;
    } else {
      console.log('❌ Replication failed');
      return false;
    }
  }

  async checkReplicationLag() {
    const [slave1Status] = await this.slave1.execute('SHOW SLAVE STATUS');
    const [slave2Status] = await this.slave2.execute('SHOW SLAVE STATUS');

    const lag1 = slave1Status[0].Seconds_Behind_Master;
    const lag2 = slave2Status[0].Seconds_Behind_Master;

    console.log(`📊 Replication lag - Slave1: ${lag1}s, Slave2: ${lag2}s`);
    return { slave1: lag1, slave2: lag2 };
  }

  async runLoadTest(operations = 100) {
    console.log(`🚀 Running load test with ${operations} operations...`);

    const startTime = Date.now();
    const promises = [];

    for (let i = 0; i < operations; i++) {
      promises.push(
        this.master.execute(
          'INSERT INTO users (username, email, first_name, last_name) VALUES (?, ?, ?, ?)',
          [`load_test_${i}_${Date.now()}`, `load${i}@example.com`, 'Load', 'Test']
        )
      );
    }

    await Promise.all(promises);
    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;

    console.log(`✅ Load test completed in ${duration}s`);
    return { operations, duration, opsPerSecond: Math.round(operations / duration) };
  }
}

module.exports = ReplicationTester;
```

## Lab 3: Active-Active Clustering (MariaDB Galera)

### Objective
Set up and test MariaDB Galera cluster with ProxySQL load balancing.

### What to Code/Implement

#### 1. Galera Cluster Configuration
```yaml
# docker-compose.yml
version: '3.8'

services:
  galera-node1:
    image: mariadb:10.11
    container_name: galera-node1
    environment:
      MYSQL_ROOT_PASSWORD: rootpassword
      MYSQL_DATABASE: testdb
    ports:
      - "3306:3306"
    volumes:
      - ./config/galera.cnf:/etc/mysql/conf.d/galera.cnf
      - galera_node1_data:/var/lib/mysql
    command: --wsrep-new-cluster
    networks:
      - galera_network

  galera-node2:
    image: mariadb:10.11
    container_name: galera-node2
    environment:
      MYSQL_ROOT_PASSWORD: rootpassword
      MYSQL_DATABASE: testdb
    ports:
      - "3307:3306"
    volumes:
      - ./config/galera-node2.cnf:/etc/mysql/conf.d/galera.cnf
      - galera_node2_data:/var/lib/mysql
    depends_on:
      - galera-node1
    networks:
      - galera_network

  galera-node3:
    image: mariadb:10.11
    container_name: galera-node3
    environment:
      MYSQL_ROOT_PASSWORD: rootpassword
      MYSQL_DATABASE: testdb
    ports:
      - "3308:3306"
    volumes:
      - ./config/galera-node3.cnf:/etc/mysql/conf.d/galera.cnf
      - galera_node3_data:/var/lib/mysql
    depends_on:
      - galera-node1
    networks:
      - galera_network

  proxysql:
    image: proxysql/proxysql:2.5
    container_name: proxysql
    ports:
      - "6033:6033"
      - "6032:6032"
    volumes:
      - ./config/proxysql.cnf:/etc/proxysql.cnf
      - proxysql_data:/var/lib/proxysql
    depends_on:
      - galera-node1
      - galera-node2
      - galera-node3
    networks:
      - galera_network

  phpmyadmin:
    image: phpmyadmin/phpmyadmin
    container_name: phpmyadmin
    environment:
      PMA_HOST: proxysql
      PMA_PORT: 6033
      PMA_USER: root
      PMA_PASSWORD: rootpassword
    ports:
      - "8080:80"
    depends_on:
      - proxysql
    networks:
      - galera_network

volumes:
  galera_node1_data:
  galera_node2_data:
  galera_node3_data:
  proxysql_data:

networks:
  galera_network:
    driver: bridge
```

#### 2. Galera Cluster Testing
```javascript
// test-galera-cluster.js
const mysql = require('mysql2/promise');

class GaleraClusterTester {
  constructor() {
    this.nodes = [];
    this.proxyConnection = null;
  }

  async connect() {
    // Connect to all nodes
    this.nodes = await Promise.all([
      mysql.createConnection({
        host: 'localhost',
        port: 3306,
        user: 'root',
        password: 'rootpassword',
        database: 'testdb'
      }),
      mysql.createConnection({
        host: 'localhost',
        port: 3307,
        user: 'root',
        password: 'rootpassword',
        database: 'testdb'
      }),
      mysql.createConnection({
        host: 'localhost',
        port: 3308,
        user: 'root',
        password: 'rootpassword',
        database: 'testdb'
      })
    ]);

    // Connect to ProxySQL
    this.proxyConnection = await mysql.createConnection({
      host: 'localhost',
      port: 6033,
      user: 'root',
      password: 'rootpassword',
      database: 'testdb'
    });
  }

  async checkClusterStatus() {
    console.log('🔍 Checking cluster status...');

    const statusPromises = this.nodes.map(async (node, index) => {
      const [rows] = await node.execute("SHOW STATUS LIKE 'wsrep%'");
      return { node: index + 1, status: rows };
    });

    const results = await Promise.all(statusPromises);

    results.forEach(result => {
      const clusterSize = result.status.find(row => row.Variable_name === 'wsrep_cluster_size');
      const clusterStatus = result.status.find(row => row.Variable_name === 'wsrep_cluster_status');
      const connected = result.status.find(row => row.Variable_name === 'wsrep_connected');

      console.log(`Node ${result.node}:`);
      console.log(`  Cluster Size: ${clusterSize?.Value}`);
      console.log(`  Cluster Status: ${clusterStatus?.Value}`);
      console.log(`  Connected: ${connected?.Value}`);
    });

    return results;
  }

  async testActiveActive() {
    console.log('🧪 Testing active-active functionality...');

    // Write to different nodes
    const testData = [
      { node: 0, data: { name: 'test_from_node1', value: 1 } },
      { node: 1, data: { name: 'test_from_node2', value: 2 } },
      { node: 2, data: { name: 'test_from_node3', value: 3 } }
    ];

    for (const test of testData) {
      await this.nodes[test.node].execute(
        'INSERT INTO test_table (name, value) VALUES (?, ?)',
        [test.data.name, test.data.value]
      );
      console.log(`✅ Data written to node ${test.node + 1}`);
    }

    // Wait for replication
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Verify data on all nodes
    for (let i = 0; i < this.nodes.length; i++) {
      const [rows] = await this.nodes[i].execute('SELECT * FROM test_table ORDER BY id DESC LIMIT 3');
      console.log(`Node ${i + 1} has ${rows.length} records`);
      
      if (rows.length === 3) {
        console.log(`✅ Node ${i + 1} has all replicated data`);
      } else {
        console.log(`❌ Node ${i + 1} missing data`);
      }
    }
  }

  async testLoadBalancing() {
    console.log('⚖️ Testing ProxySQL load balancing...');

    const operations = 50;
    const startTime = Date.now();

    const promises = [];
    for (let i = 0; i < operations; i++) {
      promises.push(
        this.proxyConnection.execute(
          'INSERT INTO test_table (name, value) VALUES (?, ?)',
          [`proxy_test_${i}`, i]
        )
      );
    }

    await Promise.all(promises);
    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;

    console.log(`✅ Load balancing test completed in ${duration}s`);
    console.log(`📊 Operations per second: ${Math.round(operations / duration)}`);

    return { operations, duration, opsPerSecond: Math.round(operations / duration) };
  }

  async testFailover() {
    console.log('🔄 Testing failover scenario...');

    // Stop one node
    console.log('Stopping node 2...');
    // In real scenario, you would stop the container
    // docker stop galera-node2

    // Continue operations through ProxySQL
    const operations = 20;
    const promises = [];
    
    for (let i = 0; i < operations; i++) {
      promises.push(
        this.proxyConnection.execute(
          'INSERT INTO test_table (name, value) VALUES (?, ?)',
          [`failover_test_${i}`, i]
        )
      );
    }

    await Promise.all(promises);
    console.log('✅ Operations continued through remaining nodes');

    // Restart the node
    console.log('Restarting node 2...');
    // docker start galera-node2

    // Wait for rejoin
    await new Promise(resolve => setTimeout(resolve, 10000));

    // Verify cluster status
    await this.checkClusterStatus();
  }
}

module.exports = GaleraClusterTester;
```

## Testing Commands

### Lab 1: Vertical Scaling
```bash
# Start default MySQL
docker-compose --profile default up -d mysql-default

# Run baseline tests
node src/index.js --container=mysql-default

# Stop default, start optimized
docker-compose --profile default down
docker-compose --profile optimized up -d mysql-optimized

# Run optimized tests
node src/index.js --container=mysql-optimized --port=3307

# Run comparison
node src/index.js --compare
```

### Lab 2: Master-Slave Replication
```bash
# Setup replication
./setup-replication.sh

# Test replication
node test-replication.js

# Monitor replication
./monitor-replication.sh
```

### Lab 3: Active-Active Clustering
```bash
# Start cluster
docker-compose up -d

# Test cluster
node test-galera-cluster.js

# Access phpMyAdmin
open http://localhost:8080
```

## Expected Learning Outcomes

1. **Vertical Scaling**: Understand how configuration changes impact performance
2. **Master-Slave**: Learn replication concepts and monitoring
3. **Active-Active**: Experience high availability and load balancing
4. **Performance Testing**: Develop skills in measuring and comparing database performance
5. **Troubleshooting**: Practice identifying and resolving common issues
