const mysql = require('mysql2/promise');
const chalk = require('chalk');
const async = require('async');
const moment = require('moment');

class StressTester {
    constructor(config) {
        this.config = config;
        this.connectionPool = null;
        this.results = {
            timestamp: moment().format('YYYY-MM-DD HH:mm:ss'),
            container: config.container,
            stress_level: 'HIGH',
            tests: {}
        };
    }

    async connect() {
        console.log(chalk.blue(`🔌 Creating stress test connection pool for ${this.config.container}...`));

        this.connectionPool = mysql.createPool({
            host: this.config.host,
            port: this.config.port,
            user: this.config.user,
            password: this.config.password,
            database: this.config.database,
            connectionLimit: parseInt(this.config.threads) * 2,
            queueLimit: 0,
            acquireTimeout: 60000,
            timeout: 60000
        });

        console.log(chalk.green('✅ Stress test connection pool created'));
    }

    async disconnect() {
        if (this.connectionPool) {
            await this.connectionPool.end();
            console.log(chalk.gray('🔌 Stress test connection pool closed'));
        }
    }

    async setupStressTables() {
        console.log(chalk.blue('🏗️  Setting up stress test tables...'));

        const connection = await this.connectionPool.getConnection();

        try {
            // Drop tables first
            await connection.execute('DROP TABLE IF EXISTS stress_test_heavy');
            await connection.execute('DROP TABLE IF EXISTS stress_test_transactions');

            // Create stress_test_heavy table
            await connection.execute(`
                CREATE TABLE stress_test_heavy (
                  id INT AUTO_INCREMENT PRIMARY KEY,
                  thread_id INT,
                  large_text TEXT,
                  json_data JSON,
                  binary_data BLOB,
                  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                  INDEX idx_thread_id (thread_id),
                  INDEX idx_created_at (created_at),
                  FULLTEXT idx_large_text (large_text)
                ) ENGINE=InnoDB
            `);

            // Create stress_test_transactions table
            await connection.execute(`
                CREATE TABLE stress_test_transactions (
                  id INT AUTO_INCREMENT PRIMARY KEY,
                  account_id INT,
                  transaction_type VARCHAR(20),
                  amount DECIMAL(15,2),
                  balance DECIMAL(15,2),
                  transaction_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                  metadata JSON,
                  INDEX idx_account_id (account_id),
                  INDEX idx_transaction_date (transaction_date),
                  INDEX idx_transaction_type (transaction_type)
                ) ENGINE=InnoDB
            `);

            console.log(chalk.green('✅ Stress test tables created'));
        } finally {
            connection.release();
        }
    }

    async runHighVolumeInserts(duration = 60000) {
        console.log(chalk.yellow(`💥 Running high-volume inserts for ${duration / 1000} seconds...`));

        const startTime = Date.now();
        const endTime = startTime + duration;
        const threadCount = parseInt(this.config.threads);
        let totalInserted = 0;
        let isRunning = true;

        const tasks = [];
        for (let threadId = 0; threadId < threadCount; threadId++) {
            tasks.push(async () => {
                const connection = await this.connectionPool.getConnection();
                let threadInserted = 0;

                try {
                    while (Date.now() < endTime && isRunning) {
                        const batchSize = 50;
                        const values = [];

                        for (let i = 0; i < batchSize; i++) {
                            const largeText = 'Lorem ipsum '.repeat(100) + Math.random().toString(36);
                            const jsonData = JSON.stringify({
                                thread: threadId,
                                timestamp: Date.now(),
                                random: Math.random(),
                                data: Array.from({ length: 10 }, () => Math.random().toString(36))
                            });
                            const binaryData = Buffer.from(Math.random().toString(36).repeat(50));

                            values.push([threadId, largeText, jsonData, binaryData]);
                        }

                        const placeholders = values.map(() => '(?, ?, ?, ?)').join(', ');
                        const sql = `INSERT INTO stress_test_heavy (thread_id, large_text, json_data, binary_data) VALUES ${placeholders}`;

                        await connection.execute(sql, values.flat());
                        threadInserted += batchSize;
                    }

                    return { threadId, inserted: threadInserted };
                } finally {
                    connection.release();
                }
            });
        }

        const results = await async.parallelLimit(tasks, threadCount);
        isRunning = false;

        totalInserted = results.reduce((sum, r) => sum + r.inserted, 0);
        const actualDuration = Date.now() - startTime;

        return {
            operation: 'HIGH_VOLUME_INSERT',
            duration_ms: actualDuration,
            total_records: totalInserted,
            records_per_second: (totalInserted / (actualDuration / 1000)).toFixed(2),
            threads: threadCount,
            thread_results: results
        };
    }

    async runTransactionStress(transactionCount = 1000) {
        console.log(chalk.yellow(`💳 Running transaction stress test (${transactionCount} transactions)...`));

        const startTime = process.hrtime.bigint();
        const threadCount = parseInt(this.config.threads);
        const transactionsPerThread = Math.floor(transactionCount / threadCount);

        const tasks = [];
        for (let threadId = 0; threadId < threadCount; threadId++) {
            tasks.push(async () => {
                const connection = await this.connectionPool.getConnection();
                let completedTransactions = 0;

                try {
                    for (let i = 0; i < transactionsPerThread; i++) {
                        await connection.beginTransaction();

                        try {
                            const accountId = Math.floor(Math.random() * 1000) + 1;
                            const amount = (Math.random() * 1000 + 10).toFixed(2);

                            // Simulate complex transaction
                            await connection.execute(
                                'INSERT INTO stress_test_transactions (account_id, transaction_type, amount, balance, metadata) VALUES (?, ?, ?, ?, ?)',
                                [accountId, 'DEBIT', amount, 0, JSON.stringify({ thread: threadId, transaction: i })]
                            );

                            await connection.execute(
                                'UPDATE stress_test_transactions SET balance = balance - ? WHERE account_id = ?',
                                [amount, accountId]
                            );

                            await connection.execute(
                                'INSERT INTO stress_test_transactions (account_id, transaction_type, amount, balance, metadata) VALUES (?, ?, ?, ?, ?)',
                                [accountId + 1000, 'CREDIT', amount, 0, JSON.stringify({ thread: threadId, transaction: i })]
                            );

                            await connection.commit();
                            completedTransactions++;

                        } catch (error) {
                            await connection.rollback();
                            console.error(chalk.red(`Transaction failed: ${error.message}`));
                        }
                    }

                    return { threadId, completedTransactions };
                } finally {
                    connection.release();
                }
            });
        }

        const results = await async.parallelLimit(tasks, threadCount);
        const endTime = process.hrtime.bigint();
        const duration = Number(endTime - startTime) / 1000000;

        const totalTransactions = results.reduce((sum, r) => sum + r.completedTransactions, 0);

        return {
            operation: 'TRANSACTION_STRESS',
            duration_ms: duration,
            total_transactions: totalTransactions,
            transactions_per_second: (totalTransactions / (duration / 1000)).toFixed(2),
            threads: threadCount,
            thread_results: results
        };
    }

    async runComplexQueryStress(queryCount = 500) {
        console.log(chalk.yellow(`🔍 Running complex query stress test (${queryCount} queries)...`));

        const startTime = process.hrtime.bigint();
        const threadCount = parseInt(this.config.threads);
        const queriesPerThread = Math.floor(queryCount / threadCount);

        const complexQueries = [
            `SELECT thread_id, COUNT(*) as count, AVG(LENGTH(large_text)) as avg_text_length,
       AVG(CAST(JSON_EXTRACT(json_data, '$.random') AS DECIMAL(10,6))) as avg_random_val
       FROM stress_test_heavy 
       WHERE created_at >= DATE_SUB(NOW(), INTERVAL 1 HOUR)
       GROUP BY thread_id 
       HAVING count > 10
       ORDER BY count DESC`,

            `SELECT h1.thread_id, COUNT(*) as record_count,
       AVG(MATCH(h1.large_text) AGAINST('Lorem' IN NATURAL LANGUAGE MODE)) as avg_relevance
       FROM stress_test_heavy h1
       WHERE h1.created_at >= DATE_SUB(NOW(), INTERVAL 30 MINUTE)
       GROUP BY h1.thread_id
       ORDER BY avg_relevance DESC
       LIMIT 100`,

            `SELECT account_id, 
       SUM(CASE WHEN transaction_type = 'CREDIT' THEN amount ELSE 0 END) as total_credits,
       SUM(CASE WHEN transaction_type = 'DEBIT' THEN amount ELSE 0 END) as total_debits,
       COUNT(*) as transaction_count,
       MAX(transaction_date) as last_transaction
       FROM stress_test_transactions
       GROUP BY account_id
       HAVING transaction_count > 1
       ORDER BY total_credits DESC
       LIMIT 50`
        ];

        const tasks = [];
        for (let threadId = 0; threadId < threadCount; threadId++) {
            tasks.push(async () => {
                const connection = await this.connectionPool.getConnection();
                let completedQueries = 0;

                try {
                    for (let i = 0; i < queriesPerThread; i++) {
                        const queryIndex = i % complexQueries.length;
                        const query = complexQueries[queryIndex];

                        try {
                            await connection.query(query);
                            completedQueries++;
                        } catch (error) {
                            console.log(chalk.red(`❌ Query ${queryIndex + 1} failed: ${error.message}`));
                        }
                    }

                    return { threadId, completedQueries };
                } finally {
                    connection.release();
                }
            });
        }

        const results = await async.parallelLimit(tasks, threadCount);
        const endTime = process.hrtime.bigint();
        const duration = Number(endTime - startTime) / 1000000;

        const totalQueries = results.reduce((sum, r) => sum + r.completedQueries, 0);

        return {
            operation: 'COMPLEX_QUERY_STRESS',
            duration_ms: duration,
            total_queries: totalQueries,
            queries_per_second: (totalQueries / (duration / 1000)).toFixed(2),
            threads: threadCount,
            thread_results: results
        };
    }

    async runStressTest() {
        console.log(chalk.blue.bold(`🚀 Starting stress test on ${this.config.container}`));

        const testStartTime = process.hrtime.bigint();

        // Setup
        await this.setupStressTables();

        // Run stress tests
        const highVolumeResult = await this.runHighVolumeInserts(30000); // 30 seconds
        const transactionResult = await this.runTransactionStress(500);
        const complexQueryResult = await this.runComplexQueryStress(200);

        const testEndTime = process.hrtime.bigint();
        const totalDuration = Number(testEndTime - testStartTime) / 1000000;

        this.results = {
            ...this.results,
            total_duration_ms: totalDuration,
            tests: {
                high_volume_insert: highVolumeResult,
                transaction_stress: transactionResult,
                complex_query_stress: complexQueryResult
            }
        };

        console.log(chalk.green.bold(`✅ Stress test completed in ${(totalDuration / 1000).toFixed(2)} seconds`));
        return this.results;
    }
}

module.exports = StressTester; 