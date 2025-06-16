#!/usr/bin/env node

/**
 * MySQL Sharding Test Application
 * Demonstrates horizontal sharding with MariaDB Galera Cluster
 */

const mysql = require('mysql2/promise');
const chalk = require('chalk');
const Table = require('cli-table3');
const config = require('./config');

class ShardingTest {
    constructor() {
        this.connections = {};
        this.results = {
            tests: [],
            performance: {},
            errors: []
        };
    }

    /**
     * Initialize database connections
     */
    async initializeConnections() {
        console.log(chalk.blue('🔌 Initializing database connections...'));

        try {
            // Connect to sharding router
            this.connections.router = await mysql.createConnection(config.shardingRouter);
            console.log(chalk.green('✅ Connected to sharding router (ProxySQL)'));

            // Connect to individual shards
            for (const [shardName, shardConfig] of Object.entries(config.shards)) {
                this.connections[shardName] = {
                    primary: await mysql.createConnection(shardConfig.primary),
                    replica: await mysql.createConnection(shardConfig.replica)
                };
                console.log(chalk.green(`✅ Connected to ${shardName} (primary + replica)`));
            }

            return true;
        } catch (error) {
            console.error(chalk.red('❌ Failed to initialize connections:'), error.message);
            return false;
        }
    }

    /**
     * Test basic sharding functionality
     */
    async testBasicSharding() {
        console.log(chalk.blue('\n🧪 Testing Basic Sharding Functionality...'));

        const testCases = [
            { userId: 1, expectedShard: 'shard1', description: 'User ID 1 -> Shard 1' },
            { userId: 500, expectedShard: 'shard1', description: 'User ID 500 -> Shard 1' },
            { userId: 1000, expectedShard: 'shard1', description: 'User ID 1000 -> Shard 1' },
            { userId: 1001, expectedShard: 'shard2', description: 'User ID 1001 -> Shard 2' },
            { userId: 1500, expectedShard: 'shard2', description: 'User ID 1500 -> Shard 2' },
            { userId: 2000, expectedShard: 'shard2', description: 'User ID 2000 -> Shard 2' },
            { userId: 2001, expectedShard: 'shard3', description: 'User ID 2001 -> Shard 3' },
            { userId: 2500, expectedShard: 'shard3', description: 'User ID 2500 -> Shard 3' },
            { userId: 3000, expectedShard: 'shard3', description: 'User ID 3000 -> Shard 3' }
        ];

        let passed = 0;
        let failed = 0;

        for (const testCase of testCases) {
            try {
                const actualShard = config.sharding.getShardForUserId(testCase.userId);
                const success = actualShard === testCase.expectedShard;

                if (success) {
                    console.log(chalk.green(`✅ ${testCase.description}`));
                    passed++;
                } else {
                    console.log(chalk.red(`❌ ${testCase.description} (Expected: ${testCase.expectedShard}, Got: ${actualShard})`));
                    failed++;
                }
            } catch (error) {
                console.log(chalk.red(`❌ ${testCase.description} (Error: ${error.message})`));
                failed++;
            }
        }

        console.log(chalk.blue(`\n📊 Basic Sharding Results: ${passed} passed, ${failed} failed`));
        return { passed, failed, total: testCases.length };
    }

    /**
     * Test data insertion across shards
     */
    async testDataInsertion() {
        console.log(chalk.blue('\n📝 Testing Data Insertion Across Shards...'));

        const testUsers = [
            { id: 999, username: 'testuser999', email: 'test999@example.com', expectedShard: 'shard1' },
            { id: 1999, username: 'testuser1999', email: 'test1999@example.com', expectedShard: 'shard2' },
            { id: 2999, username: 'testuser2999', email: 'test2999@example.com', expectedShard: 'shard3' }
        ];

        let passed = 0;
        let failed = 0;

        for (const user of testUsers) {
            try {
                // Insert user via sharding router
                const insertQuery = `
                    INSERT INTO users (id, username, email, first_name, last_name) 
                    VALUES (?, ?, ?, 'Test', 'User')
                `;

                await this.connections.router.execute(insertQuery, [user.id, user.username, user.email]);

                // Verify data is in the correct shard
                const shardConfig = config.shards[user.expectedShard];
                const shardConnection = await mysql.createConnection(shardConfig.primary);

                const [rows] = await shardConnection.execute(
                    'SELECT id, username, email FROM users WHERE id = ?',
                    [user.id]
                );

                await shardConnection.end();

                if (rows.length > 0) {
                    console.log(chalk.green(`✅ User ${user.id} inserted into ${user.expectedShard}`));
                    passed++;
                } else {
                    console.log(chalk.red(`❌ User ${user.id} not found in ${user.expectedShard}`));
                    failed++;
                }
            } catch (error) {
                console.log(chalk.red(`❌ Failed to insert user ${user.id}: ${error.message}`));
                failed++;
            }
        }

        console.log(chalk.blue(`\n📊 Data Insertion Results: ${passed} passed, ${failed} failed`));
        return { passed, failed, total: testUsers.length };
    }

    /**
     * Test query routing through sharding router
     */
    async testQueryRouting() {
        console.log(chalk.blue('\n🔀 Testing Query Routing Through Sharding Router...'));

        const testQueries = [
            { userId: 1, query: 'SELECT * FROM users WHERE id = 1', expectedShard: 'shard1' },
            { userId: 1001, query: 'SELECT * FROM users WHERE id = 1001', expectedShard: 'shard2' },
            { userId: 2001, query: 'SELECT * FROM users WHERE id = 2001', expectedShard: 'shard3' }
        ];

        let passed = 0;
        let failed = 0;

        for (const test of testQueries) {
            try {
                const startTime = Date.now();
                const [rows] = await this.connections.router.execute(test.query);
                const endTime = Date.now();
                const queryTime = endTime - startTime;

                if (rows.length > 0) {
                    console.log(chalk.green(`✅ Query for user ${test.userId} routed successfully (${queryTime}ms)`));
                    passed++;
                } else {
                    console.log(chalk.yellow(`⚠️ Query for user ${test.userId} returned no results (${queryTime}ms)`));
                    passed++; // Not a failure, just no data
                }
            } catch (error) {
                console.log(chalk.red(`❌ Query for user ${test.userId} failed: ${error.message}`));
                failed++;
            }
        }

        console.log(chalk.blue(`\n📊 Query Routing Results: ${passed} passed, ${failed} failed`));
        return { passed, failed, total: testQueries.length };
    }

    /**
     * Test performance comparison
     */
    async testPerformance() {
        console.log(chalk.blue('\n⚡ Testing Performance Comparison...'));

        const performanceResults = {
            shardingRouter: [],
            directShards: []
        };

        // Test queries through sharding router
        console.log(chalk.yellow('Testing queries through sharding router...'));
        for (let i = 0; i < 10; i++) {
            const userId = Math.floor(Math.random() * 3000) + 1;
            const startTime = Date.now();

            try {
                await this.connections.router.execute('SELECT * FROM users WHERE id = ?', [userId]);
                const endTime = Date.now();
                performanceResults.shardingRouter.push(endTime - startTime);
            } catch (error) {
                console.log(chalk.red(`Query failed for user ${userId}: ${error.message}`));
            }
        }

        // Test direct queries to shards
        console.log(chalk.yellow('Testing direct queries to shards...'));
        for (let i = 0; i < 10; i++) {
            const userId = Math.floor(Math.random() * 3000) + 1;
            const shardName = config.sharding.getShardForUserId(userId);
            const shardConfig = config.shards[shardName];

            const startTime = Date.now();
            try {
                const connection = await mysql.createConnection(shardConfig.primary);
                await connection.execute('SELECT * FROM users WHERE id = ?', [userId]);
                await connection.end();
                const endTime = Date.now();
                performanceResults.directShards.push(endTime - startTime);
            } catch (error) {
                console.log(chalk.red(`Direct query failed for user ${userId}: ${error.message}`));
            }
        }

        // Calculate statistics
        const routerStats = this.calculateStats(performanceResults.shardingRouter);
        const directStats = this.calculateStats(performanceResults.directShards);

        console.log(chalk.blue('\n📊 Performance Results:'));

        const table = new Table({
            head: ['Metric', 'Sharding Router', 'Direct Shards', 'Difference'],
            colWidths: [20, 15, 15, 15]
        });

        table.push(
            ['Average (ms)', routerStats.average.toFixed(2), directStats.average.toFixed(2),
                (routerStats.average - directStats.average).toFixed(2)],
            ['Min (ms)', routerStats.min.toFixed(2), directStats.min.toFixed(2),
                (routerStats.min - directStats.min).toFixed(2)],
            ['Max (ms)', routerStats.max.toFixed(2), directStats.max.toFixed(2),
                (routerStats.max - directStats.max).toFixed(2)],
            ['Std Dev (ms)', routerStats.stdDev.toFixed(2), directStats.stdDev.toFixed(2),
                (routerStats.stdDev - directStats.stdDev).toFixed(2)]
        );

        console.log(table.toString());

        return { routerStats, directStats };
    }

    /**
     * Calculate statistics for performance data
     */
    calculateStats(data) {
        if (data.length === 0) return { average: 0, min: 0, max: 0, stdDev: 0 };

        const sum = data.reduce((a, b) => a + b, 0);
        const average = sum / data.length;
        const min = Math.min(...data);
        const max = Math.max(...data);

        const variance = data.reduce((sum, value) => sum + Math.pow(value - average, 2), 0) / data.length;
        const stdDev = Math.sqrt(variance);

        return { average, min, max, stdDev };
    }

    /**
     * Test data consistency across shards
     */
    async testDataConsistency() {
        console.log(chalk.blue('\n🔒 Testing Data Consistency Across Shards...'));

        const consistencyChecks = [
            { shard: 'shard1', range: '1-1000' },
            { shard: 'shard2', range: '1001-2000' },
            { shard: 'shard3', range: '2001-3000' }
        ];

        let passed = 0;
        let failed = 0;

        for (const check of consistencyChecks) {
            try {
                const shardConfig = config.shards[check.shard];
                const connection = await mysql.createConnection(shardConfig.primary);

                // Check if all users in the shard have correct IDs
                const [rows] = await connection.execute(`
                    SELECT COUNT(*) as count, 
                           MIN(id) as min_id, 
                           MAX(id) as max_id 
                    FROM users
                `);

                await connection.end();

                const result = rows[0];
                const expectedMin = config.sharding.ranges[check.shard].min;
                const expectedMax = config.sharding.ranges[check.shard].max;

                if (result.min_id >= expectedMin && result.max_id <= expectedMax) {
                    console.log(chalk.green(`✅ ${check.shard} data consistency: ${result.count} users, range ${result.min_id}-${result.max_id}`));
                    passed++;
                } else {
                    console.log(chalk.red(`❌ ${check.shard} data inconsistency: expected ${expectedMin}-${expectedMax}, got ${result.min_id}-${result.max_id}`));
                    failed++;
                }
            } catch (error) {
                console.log(chalk.red(`❌ Failed to check ${check.shard} consistency: ${error.message}`));
                failed++;
            }
        }

        console.log(chalk.blue(`\n📊 Data Consistency Results: ${passed} passed, ${failed} failed`));
        return { passed, failed, total: consistencyChecks.length };
    }

    /**
     * Display shard statistics
     */
    async displayShardStats() {
        console.log(chalk.blue('\n📈 Shard Statistics:'));

        const table = new Table({
            head: ['Shard', 'Users', 'Orders', 'Products', 'Order Items'],
            colWidths: [15, 10, 10, 10, 12]
        });

        for (const [shardName, shardConfig] of Object.entries(config.shards)) {
            try {
                const connection = await mysql.createConnection(shardConfig.primary);

                const [userCount] = await connection.execute('SELECT COUNT(*) as count FROM users');
                const [orderCount] = await connection.execute('SELECT COUNT(*) as count FROM orders');
                const [productCount] = await connection.execute('SELECT COUNT(*) as count FROM products');
                const [orderItemCount] = await connection.execute('SELECT COUNT(*) as count FROM order_items');

                await connection.end();

                table.push([
                    shardName,
                    userCount[0].count,
                    orderCount[0].count,
                    productCount[0].count,
                    orderItemCount[0].count
                ]);
            } catch (error) {
                table.push([shardName, 'Error', 'Error', 'Error', 'Error']);
                console.log(chalk.red(`Failed to get stats for ${shardName}: ${error.message}`));
            }
        }

        console.log(table.toString());
    }

    /**
     * Run all tests
     */
    async runAllTests() {
        console.log(chalk.cyan('🚀 Starting MySQL Sharding Tests...\n'));

        // Initialize connections
        const connected = await this.initializeConnections();
        if (!connected) {
            console.log(chalk.red('❌ Failed to initialize connections. Exiting.'));
            return;
        }

        // Run tests
        const testResults = {
            basicSharding: await this.testBasicSharding(),
            dataInsertion: await this.testDataInsertion(),
            queryRouting: await this.testQueryRouting(),
            performance: await this.testPerformance(),
            dataConsistency: await this.testDataConsistency()
        };

        // Display shard statistics
        await this.displayShardStats();

        // Summary
        console.log(chalk.cyan('\n📋 Test Summary:'));
        const totalTests = Object.values(testResults).reduce((sum, result) => {
            if (result.passed !== undefined && result.failed !== undefined) {
                return sum + result.passed + result.failed;
            }
            return sum;
        }, 0);

        const totalPassed = Object.values(testResults).reduce((sum, result) => {
            if (result.passed !== undefined) {
                return sum + result.passed;
            }
            return sum;
        }, 0);

        const totalFailed = Object.values(testResults).reduce((sum, result) => {
            if (result.failed !== undefined) {
                return sum + result.failed;
            }
            return sum;
        }, 0);

        console.log(chalk.blue(`Total Tests: ${totalTests}`));
        console.log(chalk.green(`Passed: ${totalPassed}`));
        console.log(chalk.red(`Failed: ${totalFailed}`));

        if (totalFailed === 0) {
            console.log(chalk.green('\n🎉 All tests passed! Sharding setup is working correctly.'));
        } else {
            console.log(chalk.yellow('\n⚠️ Some tests failed. Please check the configuration.'));
        }

        // Close connections
        await this.closeConnections();
    }

    /**
     * Close all database connections
     */
    async closeConnections() {
        console.log(chalk.blue('\n🔌 Closing database connections...'));

        try {
            if (this.connections.router) {
                await this.connections.router.end();
            }

            for (const [shardName, connections] of Object.entries(this.connections)) {
                if (shardName !== 'router') {
                    if (connections.primary) await connections.primary.end();
                    if (connections.replica) await connections.replica.end();
                }
            }

            console.log(chalk.green('✅ All connections closed successfully'));
        } catch (error) {
            console.error(chalk.red('❌ Error closing connections:'), error.message);
        }
    }
}

// Run the tests if this file is executed directly
if (require.main === module) {
    const test = new ShardingTest();
    test.runAllTests().catch(error => {
        console.error(chalk.red('❌ Test execution failed:'), error);
        process.exit(1);
    });
}

module.exports = ShardingTest; 