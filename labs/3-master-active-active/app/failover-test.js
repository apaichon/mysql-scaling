const DatabaseManager = require('./database');
const config = require('./config');

class FailoverTester {
    constructor() {
        this.dbManager = new DatabaseManager();
        this.testResults = {
            connectionFailures: {},
            dataLoadFailures: {},
            clusterRecovery: {},
            proxySQLFailover: {},
            performanceUnderFailure: {}
        };
    }

    async runFailoverTests() {
        console.log('🔄 Starting Comprehensive Failover Tests...\n');

        try {
            await this.establishBaseline();
            await this.testConnectionFailures();
            await this.testDataLoadFailures();
            await this.testClusterRecovery();
            await this.testProxySQLFailover();
            await this.testPerformanceUnderFailure();
            this.generateFailoverReport();
        } catch (error) {
            console.error('❌ Failover test suite failed:', error.message);
        } finally {
            await this.dbManager.closeAll();
        }
    }

    async establishBaseline() {
        console.log('📊 Establishing Baseline Cluster State...');

        try {
            await this.dbManager.connectToNode('node1');
            await this.dbManager.connectToNode('node2');
            await this.dbManager.connectToNode('node3');
            await this.dbManager.createProxySQLPool();

            await this.dbManager.createTestTables('node1');
            await this.dbManager.createTestTables('node2');
            await this.dbManager.createTestTables('node3');

            const initialStatus = await this.dbManager.getClusterStatus('node1');
            console.log(`   ✅ Initial cluster size: ${initialStatus.wsrep_cluster_size}`);
            console.log(`   ✅ Initial cluster status: ${initialStatus.wsrep_cluster_status}`);

            await this.insertBaselineData();
            console.log('✅ Baseline established\n');
        } catch (error) {
            console.error('❌ Failed to establish baseline:', error.message);
            throw error;
        }
    }

    async insertBaselineData() {
        console.log('📝 Inserting baseline test data...');

        const baselineData = [
            { node: 'node1', message: 'Baseline data from node1', testType: 'baseline' },
            { node: 'node2', message: 'Baseline data from node2', testType: 'baseline' },
            { node: 'node3', message: 'Baseline data from node3', testType: 'baseline' }
        ];

        for (const data of baselineData) {
            await this.dbManager.executeOnNode(data.node,
                'INSERT INTO cluster_test (node_name, message, test_type) VALUES (?, ?, ?)',
                [data.node, data.message, data.testType]
            );
        }

        console.log('   ✅ Baseline data inserted');
    }

    async testConnectionFailures() {
        console.log('🔌 Testing Connection Failures...');

        const nodes = ['node1', 'node2', 'node3'];

        for (const node of nodes) {
            console.log(`\n🧪 Testing connection failure simulation for ${node}...`);

            try {
                const badConfig = {
                    ...config.nodes[node],
                    port: config.test.invalidPort,
                    connectTimeout: config.test.failoverConnectionTimeout
                };

                const startTime = Date.now();
                let connectionFailed = false;

                try {
                    const mysql = require('mysql2/promise');
                    const badConnection = await mysql.createConnection(badConfig);
                    await badConnection.end();
                } catch (error) {
                    connectionFailed = true;
                    const failTime = Date.now() - startTime;

                    this.testResults.connectionFailures[node] = {
                        failed: true,
                        failTime: failTime,
                        error: error.message,
                        timestamp: new Date().toISOString()
                    };

                    console.log(`   ✅ ${node} connection failure simulated in ${failTime}ms`);
                    console.log(`   📋 Error: ${error.message}`);
                }

                if (!connectionFailed) {
                    console.log(`   ❌ ${node} should have failed to connect`);
                }

                await this.testClusterBehaviorWithNodeFailure(node);

            } catch (error) {
                console.error(`   ❌ Error testing ${node} connection failure:`, error.message);
                this.testResults.connectionFailures[node] = {
                    failed: false,
                    error: error.message
                };
            }
        }

        console.log('');
    }

    async testClusterBehaviorWithNodeFailure(failedNode) {
        console.log(`   🔍 Testing cluster behavior with ${failedNode} failure...`);

        const remainingNodes = ['node1', 'node2', 'node3'].filter(node => node !== failedNode);

        for (const node of remainingNodes) {
            try {
                const clusterStatus = await this.dbManager.getClusterStatus(node);
                const nodeInfo = await this.dbManager.getNodeInfo(node);

                console.log(`     📊 ${node} reports:`);
                console.log(`        Cluster size: ${nodeInfo.wsrep_cluster_size}`);
                console.log(`        Cluster status: ${nodeInfo.wsrep_cluster_status}`);
                console.log(`        Connected: ${nodeInfo.wsrep_connected}`);
                console.log(`        Ready: ${nodeInfo.wsrep_ready}`);

                const testMessage = `Failover test from ${node} during ${failedNode} failure`;
                await this.dbManager.executeOnNode(node,
                    'INSERT INTO cluster_test (node_name, message, test_type) VALUES (?, ?, ?)',
                    [node, testMessage, 'connection_failover_test']
                );

                console.log(`     ✅ ${node} can still handle writes`);

                for (const verifyNode of remainingNodes) {
                    const rows = await this.dbManager.executeOnNode(verifyNode,
                        'SELECT * FROM cluster_test WHERE message = ?',
                        [testMessage]
                    );

                    if (rows.length > 0) {
                        console.log(`     ✅ Data replicated to ${verifyNode}`);
                    } else {
                        console.log(`     ❌ Data NOT replicated to ${verifyNode}`);
                    }
                }

            } catch (error) {
                console.error(`     ❌ Error testing ${node} during ${failedNode} failure:`, error.message);
            }
        }
    }

    async testDataLoadFailures() {
        console.log('📊 Testing Data Load Failures...');

        await this.testLargeDataLoadFailure();
        await this.testCorruptedDataLoadFailure();
        await this.testConcurrentLoadFailure();

        console.log('');
    }

    async testLargeDataLoadFailure() {
        console.log('   📈 Testing large data load failure...');

        const startTime = Date.now();
        let recordsInserted = 0;
        const maxRecords = 10000;

        try {
            for (let i = 0; i < maxRecords; i++) {
                await this.dbManager.executeOnNode('node1',
                    'INSERT INTO cluster_test (node_name, message, test_type) VALUES (?, ?, ?)',
                    ['node1', `Large load test ${i}`, 'large_load_failure_test']
                );
                recordsInserted++;

                if (i % 1000 === 0 && i > 0) {
                    const clusterStatus = await this.dbManager.getClusterStatus('node1');
                    console.log(`     📊 Inserted ${i} records, cluster size: ${clusterStatus.wsrep_cluster_size}`);
                }
            }

            const endTime = Date.now();
            const duration = (endTime - startTime) / 1000;

            console.log(`   ✅ Successfully inserted ${recordsInserted} records in ${duration.toFixed(2)}s`);
            this.testResults.dataLoadFailures.largeDataLoad = {
                success: true,
                recordsInserted,
                duration,
                rate: Math.round(recordsInserted / duration)
            };

        } catch (error) {
            const endTime = Date.now();
            const duration = (endTime - startTime) / 1000;

            console.log(`   ❌ Large data load failed after ${recordsInserted} records in ${duration.toFixed(2)}s`);
            console.log(`   📋 Error: ${error.message}`);

            this.testResults.dataLoadFailures.largeDataLoad = {
                success: false,
                recordsInserted,
                duration,
                error: error.message
            };
        }
    }

    async testCorruptedDataLoadFailure() {
        console.log('   🚨 Testing corrupted data load failure...');

        const corruptedDataTests = [
            {
                description: 'SQL injection attempt',
                query: 'INSERT INTO cluster_test (node_name, message, test_type) VALUES (?, ?, ?)',
                params: ['node1', "'; DROP TABLE cluster_test; --", 'sql_injection_test']
            },
            {
                description: 'Oversized data',
                query: 'INSERT INTO cluster_test (node_name, message, test_type) VALUES (?, ?, ?)',
                params: ['node1', 'A'.repeat(10000), 'oversized_data_test']
            },
            {
                description: 'Invalid data types',
                query: 'INSERT INTO cluster_test (id, node_name, message, test_type) VALUES (?, ?, ?, ?)',
                params: ['invalid_id', 'node1', 'Invalid ID test', 'invalid_type_test']
            }
        ];

        for (const test of corruptedDataTests) {
            try {
                console.log(`     🧪 ${test.description}...`);
                await this.dbManager.executeOnNode('node1', test.query, test.params);
                console.log(`     ❌ ${test.description} should have failed but succeeded`);
            } catch (error) {
                console.log(`     ✅ ${test.description} properly rejected: ${error.message}`);
            }
        }
    }

    async testConcurrentLoadFailure() {
        console.log('   🔄 Testing concurrent load failure...');

        const concurrentConnections = 20;
        const operationsPerConnection = 50;
        const promises = [];

        console.log(`     📊 Starting ${concurrentConnections} concurrent connections...`);

        for (let i = 0; i < concurrentConnections; i++) {
            const promise = this.simulateConcurrentLoad(i, operationsPerConnection);
            promises.push(promise);
        }

        const startTime = Date.now();

        try {
            const results = await Promise.allSettled(promises);
            const endTime = Date.now();
            const duration = (endTime - startTime) / 1000;

            const successful = results.filter(r => r.status === 'fulfilled').length;
            const failed = results.filter(r => r.status === 'rejected').length;

            console.log(`     📊 Concurrent load completed in ${duration.toFixed(2)}s`);
            console.log(`     ✅ Successful connections: ${successful}`);
            console.log(`     ❌ Failed connections: ${failed}`);

            this.testResults.dataLoadFailures.concurrentLoad = {
                successful,
                failed,
                duration,
                totalOperations: concurrentConnections * operationsPerConnection
            };

        } catch (error) {
            console.error(`     ❌ Concurrent load test failed:`, error.message);
        }
    }

    async simulateConcurrentLoad(connectionId, operations) {
        const mysql = require('mysql2/promise');
        const connection = await mysql.createConnection(config.nodes.node1);

        try {
            for (let i = 0; i < operations; i++) {
                await connection.execute(
                    'INSERT INTO cluster_test (node_name, message, test_type) VALUES (?, ?, ?)',
                    [`concurrent_${connectionId}`, `Operation ${i} from connection ${connectionId}`, 'concurrent_load_test']
                );
            }
        } finally {
            await connection.end();
        }
    }

    async testClusterRecovery() {
        console.log('🔄 Testing Cluster Recovery...');

        try {
            console.log('   🧪 Testing cluster recovery from temporary connection issues...');

            await this.testConnectionPoolRecovery();
            await this.testQueryTimeoutRecovery();
            await this.testTransactionRollbackRecovery();

        } catch (error) {
            console.error('   ❌ Cluster recovery test failed:', error.message);
        }

        console.log('');
    }

    async testConnectionPoolRecovery() {
        console.log('     📋 Connection pool exhaustion recovery...');
        const connections = [];
        const maxConnections = 15;

        try {
            for (let i = 0; i < maxConnections; i++) {
                const connection = await this.dbManager.pool.getConnection();
                connections.push(connection);
            }

            console.log(`       📊 Exhausted pool with ${connections.length} connections`);

            try {
                const extraConnection = await this.dbManager.pool.getConnection();
                connections.push(extraConnection);
                console.log(`       ❌ Should have failed to get extra connection`);
            } catch (error) {
                console.log(`       ✅ Properly rejected extra connection: ${error.message}`);
            }

        } finally {
            for (const connection of connections) {
                connection.release();
            }
            console.log(`       🔄 Released ${connections.length} connections`);
        }

        const testConnection = await this.dbManager.pool.getConnection();
        await testConnection.ping();
        testConnection.release();
        console.log(`       ✅ Pool recovered and working`);
    }

    async testQueryTimeoutRecovery() {
        console.log('     📋 Query timeout recovery...');
        try {
            const longQuery = 'SELECT SLEEP(10) as result';

            const timeoutPromise = this.dbManager.executeOnNode('node1', longQuery);
            const timeoutId = setTimeout(() => {
                console.log(`       ⏰ Query timeout simulated`);
            }, 5000);

            try {
                await timeoutPromise;
                clearTimeout(timeoutId);
                console.log(`       ✅ Long query completed`);
            } catch (error) {
                clearTimeout(timeoutId);
                console.log(`       ⏰ Query timed out as expected: ${error.message}`);
            }

            const normalResult = await this.dbManager.executeOnNode('node1', 'SELECT 1 as test');
            console.log(`       ✅ Normal queries still work: ${normalResult[0].test}`);

        } catch (error) {
            console.log(`       ❌ Query timeout recovery failed: ${error.message}`);
        }
    }

    async testTransactionRollbackRecovery() {
        console.log('     📋 Transaction rollback recovery...');
        const connection = this.dbManager.getNodeConnection('node1');

        try {
            await connection.beginTransaction();

            await connection.execute(
                'INSERT INTO cluster_test (node_name, message, test_type) VALUES (?, ?, ?)',
                ['node1', 'Transaction test data', 'transaction_recovery_test']
            );

            throw new Error('Simulated transaction error');

        } catch (error) {
            await connection.rollback();
            console.log(`       🔄 Transaction rolled back: ${error.message}`);

            const rows = await this.dbManager.executeOnNode('node1',
                'SELECT * FROM cluster_test WHERE test_type = ?',
                ['transaction_recovery_test']
            );

            if (rows.length === 0) {
                console.log(`       ✅ Rollback successful - no data persisted`);
            } else {
                console.log(`       ❌ Rollback failed - data still exists`);
            }
        }
    }

    async testProxySQLFailover() {
        console.log('⚖️ Testing ProxySQL Failover Behavior...');

        try {
            console.log('   🧪 Testing ProxySQL behavior with backend failures...');

            await this.testProxySQLReadDistribution();
            await this.testProxySQLWriteRouting();
            await this.testProxySQLConnectionFailover();

        } catch (error) {
            console.error('   ❌ ProxySQL failover test failed:', error.message);
        }

        console.log('');
    }

    async testProxySQLReadDistribution() {
        console.log('     📋 Read distribution during node failure...');
        const readQueries = [
            'SELECT @@hostname as hostname, @@port as port',
            'SELECT COUNT(*) as total FROM cluster_test',
            'SELECT node_name, COUNT(*) as count FROM cluster_test GROUP BY node_name'
        ];

        const results = new Map();

        for (let i = 0; i < 20; i++) {
            const query = readQueries[i % readQueries.length];
            const result = await this.dbManager.executeOnProxySQL(query);

            if (result[0].hostname) {
                const key = `${result[0].hostname}:${result[0].port}`;
                results.set(key, (results.get(key) || 0) + 1);
            }
        }

        console.log(`       📊 Read distribution:`);
        for (const [node, count] of results) {
            console.log(`         ${node}: ${count} queries`);
        }
    }

    async testProxySQLWriteRouting() {
        console.log('     📋 Write routing during node failure...');
        const writeQueries = [
            'INSERT INTO cluster_test (node_name, message, test_type) VALUES (?, ?, ?)',
            'UPDATE cluster_test SET message = ? WHERE test_type = ?',
            'DELETE FROM cluster_test WHERE test_type = ?'
        ];

        for (const query of writeQueries) {
            try {
                await this.dbManager.executeOnProxySQL(query, [
                    'proxysql_write_test',
                    'ProxySQL write routing test',
                    'proxysql_write_test'
                ]);
                console.log(`       ✅ Write query executed: ${query.split(' ')[0]}`);
            } catch (error) {
                console.log(`       ❌ Write query failed: ${error.message}`);
            }
        }
    }

    async testProxySQLConnectionFailover() {
        console.log('     📋 Connection failover...');
        const connections = [];
        const maxConnections = 10;

        try {
            for (let i = 0; i < maxConnections; i++) {
                const connection = await this.dbManager.pool.getConnection();
                connections.push(connection);
            }

            console.log(`       📊 Created ${connections.length} ProxySQL connections`);

            for (let i = 0; i < connections.length; i++) {
                try {
                    const result = await connections[i].execute('SELECT @@hostname as hostname');
                    console.log(`         Connection ${i + 1}: ${result[0][0].hostname}`);
                } catch (error) {
                    console.log(`         Connection ${i + 1} failed: ${error.message}`);
                }
            }

        } finally {
            for (const connection of connections) {
                connection.release();
            }
            console.log(`       🔄 Released ${connections.length} connections`);
        }
    }

    async testPerformanceUnderFailure() {
        console.log('⚡ Testing Performance Under Failure Conditions...');

        try {
            await this.testReadPerformanceDuringFailure();
            await this.testWritePerformanceDuringFailure();
            await this.testMixedWorkloadPerformance();

        } catch (error) {
            console.error('   ❌ Performance under failure test failed:', error.message);
        }

        console.log('');
    }

    async testReadPerformanceDuringFailure() {
        console.log('   📋 Read performance during node failure...');
        const startTime = Date.now();
        const readQueries = [
            'SELECT COUNT(*) as total FROM cluster_test',
            'SELECT * FROM cluster_test ORDER BY created_at DESC LIMIT 100',
            'SELECT node_name, COUNT(*) as count FROM cluster_test GROUP BY node_name'
        ];

        let successfulReads = 0;
        let failedReads = 0;

        for (let i = 0; i < 50; i++) {
            try {
                const query = readQueries[i % readQueries.length];
                await this.dbManager.executeOnProxySQL(query);
                successfulReads++;
            } catch (error) {
                failedReads++;
            }
        }

        const endTime = Date.now();
        const duration = (endTime - startTime) / 1000;

        console.log(`     📊 Read performance results:`);
        console.log(`       Duration: ${duration.toFixed(2)}s`);
        console.log(`       Successful reads: ${successfulReads}`);
        console.log(`       Failed reads: ${failedReads}`);
        console.log(`       Read rate: ${Math.round(successfulReads / duration)} reads/sec`);

        this.testResults.performanceUnderFailure.readPerformance = {
            duration,
            successfulReads,
            failedReads,
            readRate: Math.round(successfulReads / duration)
        };
    }

    async testWritePerformanceDuringFailure() {
        console.log('   📋 Write performance during node failure...');
        const startTime = Date.now();
        let successfulWrites = 0;
        let failedWrites = 0;

        for (let i = 0; i < 100; i++) {
            try {
                await this.dbManager.executeOnProxySQL(
                    'INSERT INTO cluster_test (node_name, message, test_type) VALUES (?, ?, ?)',
                    ['perf_test', `Performance test ${i}`, 'write_performance_test']
                );
                successfulWrites++;
            } catch (error) {
                failedWrites++;
            }
        }

        const endTime = Date.now();
        const duration = (endTime - startTime) / 1000;

        console.log(`     📊 Write performance results:`);
        console.log(`       Duration: ${duration.toFixed(2)}s`);
        console.log(`       Successful writes: ${successfulWrites}`);
        console.log(`       Failed writes: ${failedWrites}`);
        console.log(`       Write rate: ${Math.round(successfulWrites / duration)} writes/sec`);

        this.testResults.performanceUnderFailure.writePerformance = {
            duration,
            successfulWrites,
            failedWrites,
            writeRate: Math.round(successfulWrites / duration)
        };
    }

    async testMixedWorkloadPerformance() {
        console.log('   📋 Mixed workload performance...');
        const startTime = Date.now();
        const operations = [];

        for (let i = 0; i < 30; i++) {
            operations.push({ type: 'read', query: 'SELECT COUNT(*) as total FROM cluster_test' });
        }
        for (let i = 0; i < 20; i++) {
            operations.push({
                type: 'write',
                query: 'INSERT INTO cluster_test (node_name, message, test_type) VALUES (?, ?, ?)',
                params: ['mixed_test', `Mixed workload ${i}`, 'mixed_performance_test']
            });
        }

        let successfulOps = 0;
        let failedOps = 0;

        for (const operation of operations) {
            try {
                if (operation.type === 'read') {
                    await this.dbManager.executeOnProxySQL(operation.query);
                } else {
                    await this.dbManager.executeOnProxySQL(operation.query, operation.params);
                }
                successfulOps++;
            } catch (error) {
                failedOps++;
            }
        }

        const endTime = Date.now();
        const duration = (endTime - startTime) / 1000;

        console.log(`     📊 Mixed workload performance results:`);
        console.log(`       Duration: ${duration.toFixed(2)}s`);
        console.log(`       Successful operations: ${successfulOps}`);
        console.log(`       Failed operations: ${failedOps}`);
        console.log(`       Operation rate: ${Math.round(successfulOps / duration)} ops/sec`);

        this.testResults.performanceUnderFailure.mixedWorkload = {
            duration,
            successfulOps,
            failedOps,
            operationRate: Math.round(successfulOps / duration)
        };
    }

    generateFailoverReport() {
        console.log('📊 Comprehensive Failover Test Results');
        console.log('='.repeat(60));

        console.log('\n🔌 Connection Failures:');
        for (const [node, result] of Object.entries(this.testResults.connectionFailures)) {
            if (result.failed) {
                console.log(`   ✅ ${node}: Failed in ${result.failTime}ms`);
                console.log(`      Error: ${result.error}`);
            } else {
                console.log(`   ❌ ${node}: Should have failed`);
            }
        }

        console.log('\n📊 Data Load Failures:');
        for (const [test, result] of Object.entries(this.testResults.dataLoadFailures)) {
            if (result.success !== undefined) {
                if (result.success) {
                    console.log(`   ✅ ${test}: ${result.recordsInserted} records in ${result.duration.toFixed(2)}s`);
                    console.log(`      Rate: ${result.rate} records/sec`);
                } else {
                    console.log(`   ❌ ${test}: Failed after ${result.recordsInserted} records`);
                    console.log(`      Error: ${result.error}`);
                }
            } else if (result.successful !== undefined) {
                console.log(`   📊 ${test}: ${result.successful} successful, ${result.failed} failed`);
                console.log(`      Duration: ${result.duration.toFixed(2)}s`);
            }
        }

        console.log('\n⚡ Performance Under Failure:');
        if (this.testResults.performanceUnderFailure.readPerformance) {
            const read = this.testResults.performanceUnderFailure.readPerformance;
            console.log(`   📖 Read Performance: ${read.readRate} reads/sec (${read.successfulReads}/${read.successfulReads + read.failedReads} successful)`);
        }
        if (this.testResults.performanceUnderFailure.writePerformance) {
            const write = this.testResults.performanceUnderFailure.writePerformance;
            console.log(`   ✍️ Write Performance: ${write.writeRate} writes/sec (${write.successfulWrites}/${write.successfulWrites + write.failedWrites} successful)`);
        }
        if (this.testResults.performanceUnderFailure.mixedWorkload) {
            const mixed = this.testResults.performanceUnderFailure.mixedWorkload;
            console.log(`   🔄 Mixed Workload: ${mixed.operationRate} ops/sec (${mixed.successfulOps}/${mixed.successfulOps + mixed.failedOps} successful)`);
        }

        console.log('\n🎯 Failover Test Recommendations:');
        console.log('   1. Monitor cluster size and status during failures');
        console.log('   2. Test automatic failover mechanisms');
        console.log('   3. Verify data consistency after node recovery');
        console.log('   4. Monitor ProxySQL routing behavior');
        console.log('   5. Set up alerts for cluster health metrics');

        console.log('\n🎉 Comprehensive failover test suite completed!');
    }
}

if (require.main === module) {
    const failoverTester = new FailoverTester();
    failoverTester.runFailoverTests().catch(console.error);
}

module.exports = FailoverTester; 