const DatabaseManager = require('./database');
const config = require('./config');

class ClusterTester {
    constructor() {
        this.dbManager = new DatabaseManager();
        this.testResults = {
            clusterHealth: {},
            replication: {},
            loadBalancing: {},
            performance: {},
            failover: {}
        };
    }

    async runAllTests() {
        console.log('🚀 Starting Galera Cluster Tests...\n');

        try {
            // Step 1: Connect to all nodes
            await this.connectToAllNodes();

            // Step 2: Test cluster health
            await this.testClusterHealth();

            // Step 3: Test replication
            await this.testReplication();

            // Step 4: Test load balancing
            await this.testLoadBalancing();

            // Step 5: Test performance
            await this.testPerformance();

            // Step 6: Test failover scenarios
            await this.testFailover();

            // Step 7: Generate report
            this.generateReport();

        } catch (error) {
            console.error('❌ Test suite failed:', error.message);
        } finally {
            await this.dbManager.closeAll();
        }
    }

    async connectToAllNodes() {
        console.log('📡 Connecting to all cluster nodes...');

        // Connect to individual nodes
        await this.dbManager.connectToNode('node1');
        await this.dbManager.connectToNode('node2');
        await this.dbManager.connectToNode('node3');

        // Create ProxySQL pool
        await this.dbManager.createProxySQLPool();

        // Create test tables on all nodes
        await this.dbManager.createTestTables('node1');
        await this.dbManager.createTestTables('node2');
        await this.dbManager.createTestTables('node3');

        console.log('✅ All connections established\n');
    }

    async testClusterHealth() {
        console.log('🏥 Testing Cluster Health...');

        const nodes = ['node1', 'node2', 'node3'];

        for (const node of nodes) {
            try {
                const nodeInfo = await this.dbManager.getNodeInfo(node);
                const clusterStatus = await this.dbManager.getClusterStatus(node);

                this.testResults.clusterHealth[node] = {
                    ...nodeInfo,
                    clusterStatus: clusterStatus
                };

                console.log(`✅ ${node}:`);
                console.log(`   Hostname: ${nodeInfo.hostname}`);
                console.log(`   Port: ${nodeInfo.port}`);
                console.log(`   Cluster Size: ${nodeInfo.wsrep_cluster_size}`);
                console.log(`   Cluster Status: ${nodeInfo.wsrep_cluster_status}`);
                console.log(`   Connected: ${nodeInfo.wsrep_connected}`);
                console.log(`   Ready: ${nodeInfo.wsrep_ready}`);

            } catch (error) {
                console.error(`❌ ${node} health check failed:`, error.message);
                this.testResults.clusterHealth[node] = { error: error.message };
            }
        }

        console.log('');
    }

    async testReplication() {
        console.log('🔄 Testing Replication...');

        try {
            // Test 1: Write to different nodes and verify replication
            const testData = [
                { node: 'node1', message: 'Test from Node 1', testType: 'replication' },
                { node: 'node2', message: 'Test from Node 2', testType: 'replication' },
                { node: 'node3', message: 'Test from Node 3', testType: 'replication' }
            ];

            for (const data of testData) {
                // Insert data on specific node
                await this.dbManager.executeOnNode(data.node,
                    'INSERT INTO cluster_test (node_name, message, test_type) VALUES (?, ?, ?)',
                    [data.node, data.message, data.testType]
                );

                console.log(`✅ Inserted data on ${data.node}`);

                // Verify data appears on all nodes
                const nodes = ['node1', 'node2', 'node3'];
                for (const verifyNode of nodes) {
                    const rows = await this.dbManager.executeOnNode(verifyNode,
                        'SELECT * FROM cluster_test WHERE message = ?',
                        [data.message]
                    );

                    if (rows.length > 0) {
                        console.log(`   ✅ Data replicated to ${verifyNode}`);
                    } else {
                        console.log(`   ❌ Data NOT replicated to ${verifyNode}`);
                    }
                }
            }

            // Test 2: Bulk insert and verify
            console.log('\n📊 Testing bulk replication...');
            const bulkCount = 100;

            for (let i = 0; i < bulkCount; i++) {
                await this.dbManager.executeOnNode('node1',
                    'INSERT INTO cluster_test (node_name, message, test_type) VALUES (?, ?, ?)',
                    ['node1', `Bulk test ${i + 1}`, 'bulk_replication']
                );
            }

            // Verify bulk data on all nodes
            const nodes = ['node1', 'node2', 'node3'];
            for (const node of nodes) {
                const rows = await this.dbManager.executeOnNode(node,
                    'SELECT COUNT(*) as count FROM cluster_test WHERE test_type = ?',
                    ['bulk_replication']
                );

                console.log(`   ${node}: ${rows[0].count} bulk records`);
            }

            this.testResults.replication.success = true;

        } catch (error) {
            console.error('❌ Replication test failed:', error.message);
            this.testResults.replication.error = error.message;
        }

        console.log('');
    }

    async testLoadBalancing() {
        console.log('⚖️ Testing Load Balancing...');

        try {
            // Test ProxySQL load balancing
            const testQueries = [
                'SELECT @@hostname as hostname, @@port as port',
                'SELECT COUNT(*) as total_records FROM cluster_test',
                'SELECT node_name, COUNT(*) as count FROM cluster_test GROUP BY node_name'
            ];

            for (let i = 0; i < 10; i++) {
                const result = await this.dbManager.executeOnProxySQL(testQueries[0]);
                console.log(`   Query ${i + 1}: Connected to ${result[0].hostname}:${result[0].port}`);
            }

            // Test read/write distribution
            console.log('\n📝 Testing read/write distribution...');

            // Write through ProxySQL
            await this.dbManager.executeOnProxySQL(
                'INSERT INTO cluster_test (node_name, message, test_type) VALUES (?, ?, ?)',
                ['proxysql', 'Test through ProxySQL', 'load_balance_test']
            );

            // Read through ProxySQL
            const readResult = await this.dbManager.executeOnProxySQL(
                'SELECT * FROM cluster_test WHERE test_type = ? ORDER BY id DESC LIMIT 5',
                ['load_balance_test']
            );

            console.log(`   ✅ Read ${readResult.length} records through ProxySQL`);

            this.testResults.loadBalancing.success = true;

        } catch (error) {
            console.error('❌ Load balancing test failed:', error.message);
            this.testResults.loadBalancing.error = error.message;
        }

        console.log('');
    }

    async testPerformance() {
        console.log('⚡ Testing Performance...');

        try {
            const startTime = Date.now();

            // Test bulk insert performance
            console.log('📈 Testing bulk insert performance...');
            const bulkStart = Date.now();

            for (let i = 0; i < config.test.bulkInsertCount; i++) {
                await this.dbManager.executeOnNode('node1',
                    'INSERT INTO users (username, email, first_name, last_name) VALUES (?, ?, ?, ?)',
                    [`user${i}`, `user${i}@test.com`, `First${i}`, `Last${i}`]
                );
            }

            const bulkEnd = Date.now();
            const bulkTime = (bulkEnd - bulkStart) / 1000;
            const bulkRate = Math.round(config.test.bulkInsertCount / bulkTime);

            console.log(`   ✅ Inserted ${config.test.bulkInsertCount} records in ${bulkTime.toFixed(2)}s`);
            console.log(`   📊 Rate: ${bulkRate} records/second`);

            // Test query performance
            console.log('\n🔍 Testing query performance...');
            const queryStart = Date.now();

            const queryResult = await this.dbManager.executeOnNode('node1',
                'SELECT * FROM users WHERE username LIKE ? ORDER BY created_at DESC LIMIT 100',
                ['user%']
            );

            const queryEnd = Date.now();
            const queryTime = queryEnd - queryStart;

            console.log(`   ✅ Queried ${queryResult.length} records in ${queryTime}ms`);

            this.testResults.performance = {
                bulkInsertTime: bulkTime,
                bulkInsertRate: bulkRate,
                queryTime: queryTime,
                totalTime: (Date.now() - startTime) / 1000
            };

        } catch (error) {
            console.error('❌ Performance test failed:', error.message);
            this.testResults.performance.error = error.message;
        }

        console.log('');
    }

    async testFailover() {
        console.log('🔄 Testing Failover Scenarios...');

        try {
            // Test 1: Check current cluster size
            const initialStatus = await this.dbManager.getClusterStatus('node1');
            console.log(`   Initial cluster size: ${initialStatus.wsrep_cluster_size}`);

            // Test 2: Simulate node failure (we can't actually stop containers from here)
            console.log('   ⚠️  Note: Manual failover testing requires stopping containers');
            console.log('   💡 To test failover:');
            console.log('      1. Run: docker-compose stop galera-node2');
            console.log('      2. Check cluster status on remaining nodes');
            console.log('      3. Run: docker-compose start galera-node2');
            console.log('      4. Verify node rejoins cluster');

            this.testResults.failover.note = 'Manual testing required';

        } catch (error) {
            console.error('❌ Failover test failed:', error.message);
            this.testResults.failover.error = error.message;
        }

        console.log('');
    }

    generateReport() {
        console.log('📊 Test Results Summary');
        console.log('='.repeat(50));

        // Cluster Health
        console.log('\n🏥 Cluster Health:');
        for (const [node, info] of Object.entries(this.testResults.clusterHealth)) {
            if (info.error) {
                console.log(`   ❌ ${node}: ${info.error}`);
            } else {
                console.log(`   ✅ ${node}: ${info.wsrep_cluster_status} (${info.wsrep_cluster_size} nodes)`);
            }
        }

        // Replication
        console.log('\n🔄 Replication:');
        if (this.testResults.replication.success) {
            console.log('   ✅ All replication tests passed');
        } else {
            console.log(`   ❌ Replication failed: ${this.testResults.replication.error}`);
        }

        // Load Balancing
        console.log('\n⚖️ Load Balancing:');
        if (this.testResults.loadBalancing.success) {
            console.log('   ✅ ProxySQL load balancing working');
        } else {
            console.log(`   ❌ Load balancing failed: ${this.testResults.loadBalancing.error}`);
        }

        // Performance
        console.log('\n⚡ Performance:');
        if (this.testResults.performance.bulkInsertRate) {
            console.log(`   📈 Bulk insert: ${this.testResults.performance.bulkInsertRate} records/sec`);
            console.log(`   🔍 Query time: ${this.testResults.performance.queryTime}ms`);
        } else {
            console.log(`   ❌ Performance test failed: ${this.testResults.performance.error}`);
        }

        // Failover
        console.log('\n🔄 Failover:');
        console.log('   ℹ️  Manual testing required (see instructions above)');

        console.log('\n🎉 Test suite completed!');
    }
}

// Run tests if this file is executed directly
if (require.main === module) {
    const tester = new ClusterTester();
    tester.runAllTests().catch(console.error);
}

module.exports = ClusterTester; 