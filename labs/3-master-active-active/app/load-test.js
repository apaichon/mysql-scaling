const DatabaseManager = require('./database');
const config = require('./config');

class LoadTester {
    constructor() {
        this.dbManager = new DatabaseManager();
        this.results = {
            concurrentWrites: {},
            concurrentReads: {},
            mixedLoad: {},
            connectionPool: {}
        };
    }

    async runLoadTests() {
        console.log('🚀 Starting Galera Cluster Load Tests...\n');

        try {
            // Connect to cluster
            await this.connectToCluster();

            // Run different load tests
            await this.testConcurrentWrites();
            await this.testConcurrentReads();
            await this.testMixedLoad();
            await this.testConnectionPool();

            // Generate report
            this.generateReport();

        } catch (error) {
            console.error('❌ Load test failed:', error.message);
        } finally {
            await this.dbManager.closeAll();
        }
    }

    async connectToCluster() {
        console.log('📡 Connecting to Galera Cluster...');

        await this.dbManager.connectToNode('node1');
        await this.dbManager.connectToNode('node2');
        await this.dbManager.connectToNode('node3');
        await this.dbManager.createProxySQLPool();

        // Create load test tables
        await this.createLoadTestTables();

        console.log('✅ Connected to cluster\n');
    }

    async createLoadTestTables() {
        const createTableQuery = `
      CREATE TABLE IF NOT EXISTS load_test (
        id INT PRIMARY KEY AUTO_INCREMENT,
        test_id VARCHAR(50) NOT NULL,
        node_name VARCHAR(50) NOT NULL,
        operation_type VARCHAR(20) NOT NULL,
        data_value TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_test_id (test_id),
        INDEX idx_node_name (node_name),
        INDEX idx_operation_type (operation_type),
        INDEX idx_created_at (created_at)
      ) ENGINE=InnoDB
    `;

        await this.dbManager.executeOnNode('node1', createTableQuery);
        console.log('✅ Load test tables created');
    }

    async testConcurrentWrites() {
        console.log('📝 Testing Concurrent Writes...');

        const concurrentConnections = config.test.concurrentConnections;
        const writeCount = 100;
        const testId = `concurrent_write_${Date.now()}`;

        console.log(`   Running ${concurrentConnections} concurrent connections`);
        console.log(`   Each connection will write ${writeCount} records`);

        const startTime = Date.now();
        const promises = [];

        // Create concurrent write operations
        for (let i = 0; i < concurrentConnections; i++) {
            const promise = this.writeRecords(testId, `conn_${i}`, writeCount);
            promises.push(promise);
        }

        // Wait for all writes to complete
        const results = await Promise.allSettled(promises);

        const endTime = Date.now();
        const totalTime = (endTime - startTime) / 1000;
        const totalWrites = concurrentConnections * writeCount;
        const writeRate = Math.round(totalWrites / totalTime);

        // Count successful writes
        const successfulWrites = results.filter(r => r.status === 'fulfilled').length;
        const failedWrites = results.filter(r => r.status === 'rejected').length;

        console.log(`   ✅ Completed in ${totalTime.toFixed(2)}s`);
        console.log(`   📊 Write rate: ${writeRate} records/second`);
        console.log(`   ✅ Successful connections: ${successfulWrites}`);
        console.log(`   ❌ Failed connections: ${failedWrites}`);

        this.results.concurrentWrites = {
            totalTime,
            totalWrites,
            writeRate,
            successfulConnections: successfulWrites,
            failedConnections: failedWrites
        };

        console.log('');
    }

    async testConcurrentReads() {
        console.log('🔍 Testing Concurrent Reads...');

        const concurrentConnections = config.test.concurrentConnections;
        const readCount = 50;
        const testId = `concurrent_read_${Date.now()}`;

        // First, insert some test data
        console.log('   Inserting test data...');
        for (let i = 0; i < 1000; i++) {
            await this.dbManager.executeOnNode('node1',
                'INSERT INTO load_test (test_id, node_name, operation_type, data_value) VALUES (?, ?, ?, ?)',
                [testId, 'node1', 'write', `data_${i}`]
            );
        }

        console.log(`   Running ${concurrentConnections} concurrent read connections`);
        console.log(`   Each connection will perform ${readCount} reads`);

        const startTime = Date.now();
        const promises = [];

        // Create concurrent read operations
        for (let i = 0; i < concurrentConnections; i++) {
            const promise = this.readRecords(testId, `conn_${i}`, readCount);
            promises.push(promise);
        }

        // Wait for all reads to complete
        const results = await Promise.allSettled(promises);

        const endTime = Date.now();
        const totalTime = (endTime - startTime) / 1000;
        const totalReads = concurrentConnections * readCount;
        const readRate = Math.round(totalReads / totalTime);

        // Count successful reads
        const successfulReads = results.filter(r => r.status === 'fulfilled').length;
        const failedReads = results.filter(r => r.status === 'rejected').length;

        console.log(`   ✅ Completed in ${totalTime.toFixed(2)}s`);
        console.log(`   📊 Read rate: ${readRate} queries/second`);
        console.log(`   ✅ Successful connections: ${successfulReads}`);
        console.log(`   ❌ Failed connections: ${failedReads}`);

        this.results.concurrentReads = {
            totalTime,
            totalReads,
            readRate,
            successfulConnections: successfulReads,
            failedConnections: failedReads
        };

        console.log('');
    }

    async testMixedLoad() {
        console.log('🔄 Testing Mixed Load (Reads + Writes)...');

        const concurrentConnections = config.test.concurrentConnections;
        const operationsPerConnection = 30;
        const testId = `mixed_load_${Date.now()}`;

        console.log(`   Running ${concurrentConnections} concurrent connections`);
        console.log(`   Each connection will perform ${operationsPerConnection} mixed operations`);

        const startTime = Date.now();
        const promises = [];

        // Create mixed load operations
        for (let i = 0; i < concurrentConnections; i++) {
            const promise = this.mixedOperations(testId, `conn_${i}`, operationsPerConnection);
            promises.push(promise);
        }

        // Wait for all operations to complete
        const results = await Promise.allSettled(promises);

        const endTime = Date.now();
        const totalTime = (endTime - startTime) / 1000;
        const totalOperations = concurrentConnections * operationsPerConnection;
        const operationRate = Math.round(totalOperations / totalTime);

        // Count successful operations
        const successfulOperations = results.filter(r => r.status === 'fulfilled').length;
        const failedOperations = results.filter(r => r.status === 'rejected').length;

        console.log(`   ✅ Completed in ${totalTime.toFixed(2)}s`);
        console.log(`   📊 Operation rate: ${operationRate} operations/second`);
        console.log(`   ✅ Successful connections: ${successfulOperations}`);
        console.log(`   ❌ Failed connections: ${failedOperations}`);

        this.results.mixedLoad = {
            totalTime,
            totalOperations,
            operationRate,
            successfulConnections: successfulOperations,
            failedConnections: failedOperations
        };

        console.log('');
    }

    async testConnectionPool() {
        console.log('🏊 Testing Connection Pool Performance...');

        // Use the existing ProxySQL pool instead of creating new ones
        if (!this.dbManager.getProxySQLPool()) {
            console.log('   ⚠️  ProxySQL pool not available, skipping pool tests');
            return;
        }

        const testId = `pool_test_${Date.now()}`;
        const pool = this.dbManager.getProxySQLPool();

        console.log('   Testing ProxySQL pool performance...');

        const startTime = Date.now();
        const promises = [];
        const concurrentConnections = 20; // Test with 20 concurrent connections

        // Test concurrent operations with the existing pool
        for (let i = 0; i < concurrentConnections; i++) {
            const promise = this.testPoolConnectionSafe(pool, testId, i);
            promises.push(promise);
        }

        const results = await Promise.allSettled(promises);
        const endTime = Date.now();
        const totalTime = (endTime - startTime) / 1000;

        const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
        const failed = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success)).length;

        console.log(`   ✅ Completed in ${totalTime.toFixed(2)}s`);
        console.log(`   📊 Success: ${successful}, Failed: ${failed}`);
        console.log(`   📈 Rate: ${Math.round(concurrentConnections / totalTime)} operations/sec`);

        console.log('');
    }

    async testPoolConnectionSafe(pool, testId, connectionId) {
        let connection;
        try {
            // Get connection from pool using promise-based approach
            connection = await pool.getConnection();

            // Perform operations
            await connection.execute(
                'INSERT INTO load_test (test_id, node_name, operation_type, data_value) VALUES (?, ?, ?, ?)',
                [testId, `pool_${connectionId}`, 'pool_test', `pool_data_${connectionId}_${Date.now()}`]
            );

            const result = await connection.execute(
                'SELECT COUNT(*) as count FROM load_test WHERE test_id = ?',
                [testId]
            );

            return { success: true, connectionId, count: result[0][0].count };

        } catch (error) {
            return { success: false, connectionId, error: error.message };
        } finally {
            // Always release the connection back to the pool
            if (connection) {
                try {
                    connection.release();
                } catch (releaseError) {
                    // Ignore release errors to avoid callback issues
                }
            }
        }
    }

    async writeRecords(testId, connectionId, count) {
        const nodeName = `conn_${connectionId}`;

        for (let i = 0; i < count; i++) {
            await this.dbManager.executeOnNode('node1',
                'INSERT INTO load_test (test_id, node_name, operation_type, data_value) VALUES (?, ?, ?, ?)',
                [testId, nodeName, 'write', `data_${i}_${Date.now()}`]
            );

            // Small delay to simulate real-world scenario
            await this.sleep(config.test.operationDelay);
        }
    }

    async readRecords(testId, connectionId, count) {
        const nodeName = `conn_${connectionId}`;

        for (let i = 0; i < count; i++) {
            await this.dbManager.executeOnNode('node2',
                'SELECT COUNT(*) as count FROM load_test WHERE test_id = ?',
                [testId]
            );

            // Small delay to simulate real-world scenario
            await this.sleep(config.test.operationDelay);
        }
    }

    async mixedOperations(testId, connectionId, count) {
        const nodeName = `conn_${connectionId}`;

        for (let i = 0; i < count; i++) {
            if (i % 3 === 0) {
                // Write operation
                await this.dbManager.executeOnNode('node1',
                    'INSERT INTO load_test (test_id, node_name, operation_type, data_value) VALUES (?, ?, ?, ?)',
                    [testId, nodeName, 'write', `mixed_data_${i}`]
                );
            } else {
                // Read operation
                await this.dbManager.executeOnNode('node3',
                    'SELECT COUNT(*) as count FROM load_test WHERE test_id = ?',
                    [testId]
                );
            }

            // Small delay
            await this.sleep(config.test.operationDelay);
        }
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    generateReport() {
        console.log('📊 Load Test Results Summary');
        console.log('='.repeat(50));

        // Concurrent Writes
        console.log('\n📝 Concurrent Writes:');
        if (this.results.concurrentWrites.writeRate) {
            console.log(`   📈 Write rate: ${this.results.concurrentWrites.writeRate} records/sec`);
            console.log(`   ⏱️  Total time: ${this.results.concurrentWrites.totalTime.toFixed(2)}s`);
            console.log(`   ✅ Success rate: ${this.results.concurrentWrites.successfulConnections}/${config.test.concurrentConnections}`);
        }

        // Concurrent Reads
        console.log('\n🔍 Concurrent Reads:');
        if (this.results.concurrentReads.readRate) {
            console.log(`   📈 Read rate: ${this.results.concurrentReads.readRate} queries/sec`);
            console.log(`   ⏱️  Total time: ${this.results.concurrentReads.totalTime.toFixed(2)}s`);
            console.log(`   ✅ Success rate: ${this.results.concurrentReads.successfulConnections}/${config.test.concurrentConnections}`);
        }

        // Mixed Load
        console.log('\n🔄 Mixed Load:');
        if (this.results.mixedLoad.operationRate) {
            console.log(`   📈 Operation rate: ${this.results.mixedLoad.operationRate} ops/sec`);
            console.log(`   ⏱️  Total time: ${this.results.mixedLoad.totalTime.toFixed(2)}s`);
            console.log(`   ✅ Success rate: ${this.results.mixedLoad.successfulConnections}/${config.test.concurrentConnections}`);
        }

        console.log('\n🎉 Load testing completed!');
    }
}

// Run load tests if this file is executed directly
if (require.main === module) {
    const loadTester = new LoadTester();
    loadTester.runLoadTests().catch(console.error);
}

module.exports = LoadTester;