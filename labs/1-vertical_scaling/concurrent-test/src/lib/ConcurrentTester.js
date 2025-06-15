const mysql = require('mysql2/promise');
const chalk = require('chalk');
const async = require('async');
const moment = require('moment');

class ConcurrentTester {
    constructor(config) {
        this.config = config;
        this.connectionPool = null;
        this.results = {
            timestamp: moment().format('YYYY-MM-DD HH:mm:ss'),
            container: config.container,
            concurrent_threads: parseInt(config.threads),
            tests: {}
        };
    }

    async connect() {
        console.log(chalk.blue(`🔌 Creating connection pool for ${this.config.container}...`));

        this.connectionPool = mysql.createPool({
            host: this.config.host,
            port: this.config.port,
            user: this.config.user,
            password: this.config.password,
            database: this.config.database,
            connectionLimit: parseInt(this.config.threads) + 5,
            queueLimit: 0,
            acquireTimeout: 60000,
            timeout: 60000
        });

        console.log(chalk.green('✅ Connection pool created'));
    }

    async disconnect() {
        if (this.connectionPool) {
            await this.connectionPool.end();
            console.log(chalk.gray('🔌 Connection pool closed'));
        }
    }

    async setupConcurrentTables() {
        console.log(chalk.blue('🏗️  Setting up concurrent test tables...'));

        const connection = await this.connectionPool.getConnection();

        try {
            // Execute DROP TABLE separately
            await connection.execute('DROP TABLE IF EXISTS concurrent_test');

            // Execute CREATE TABLE separately
            await connection.execute(`
                CREATE TABLE concurrent_test (
                  id INT AUTO_INCREMENT PRIMARY KEY,
                  thread_id INT,
                  operation_type VARCHAR(20),
                  data JSON,
                  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                  INDEX idx_thread_id (thread_id),
                  INDEX idx_operation_type (operation_type),
                  INDEX idx_created_at (created_at)
                ) ENGINE=InnoDB
            `);

            console.log(chalk.green('✅ Concurrent test tables created'));
        } finally {
            connection.release();
        }
    }

    async runConcurrentInserts(threadCount, recordsPerThread) {
        console.log(chalk.yellow(`🔄 Running concurrent INSERTs (${threadCount} threads, ${recordsPerThread} records each)...`));

        const startTime = process.hrtime.bigint();
        const tasks = [];

        for (let threadId = 0; threadId < threadCount; threadId++) {
            tasks.push(async () => {
                const connection = await this.connectionPool.getConnection();

                try {
                    const batchSize = 100;
                    const batches = Math.ceil(recordsPerThread / batchSize);
                    let inserted = 0;

                    for (let batch = 0; batch < batches; batch++) {
                        const batchRecords = Math.min(batchSize, recordsPerThread - inserted);
                        const values = [];

                        for (let i = 0; i < batchRecords; i++) {
                            values.push([
                                threadId,
                                'INSERT',
                                JSON.stringify({
                                    thread: threadId,
                                    batch: batch,
                                    record: i,
                                    timestamp: Date.now(),
                                    random: Math.random()
                                })
                            ]);
                        }

                        const placeholders = values.map(() => '(?, ?, ?)').join(', ');
                        const sql = `INSERT INTO concurrent_test (thread_id, operation_type, data) VALUES ${placeholders}`;

                        await connection.execute(sql, values.flat());
                        inserted += batchRecords;
                    }

                    return { threadId, inserted };
                } finally {
                    connection.release();
                }
            });
        }

        const results = await async.parallelLimit(tasks, threadCount);
        const endTime = process.hrtime.bigint();
        const duration = Number(endTime - startTime) / 1000000;

        const totalInserted = results.reduce((sum, r) => sum + r.inserted, 0);

        return {
            operation: 'CONCURRENT_INSERT',
            threads: threadCount,
            records_per_thread: recordsPerThread,
            total_records: totalInserted,
            duration_ms: duration,
            records_per_second: (totalInserted / (duration / 1000)).toFixed(2),
            avg_thread_performance: results.map(r => ({
                thread_id: r.threadId,
                records: r.inserted,
                records_per_second: (r.inserted / (duration / 1000)).toFixed(2)
            }))
        };
    }

    async runConcurrentReads(threadCount, queriesPerThread) {
        console.log(chalk.yellow(`🔍 Running concurrent SELECTs (${threadCount} threads, ${queriesPerThread} queries each)...`));

        const startTime = process.hrtime.bigint();
        const tasks = [];

        const queryTemplates = [
            'SELECT COUNT(*) FROM concurrent_test WHERE thread_id = ?',
            'SELECT * FROM concurrent_test WHERE operation_type = ? ORDER BY created_at DESC LIMIT 100',
            'SELECT thread_id, COUNT(*) as count, AVG(JSON_EXTRACT(data, "$.random")) as avg_random FROM concurrent_test where thread_id = ? GROUP BY thread_id',
            'SELECT * FROM concurrent_test WHERE created_at >= ? ORDER BY id DESC LIMIT 50'
        ];

        for (let threadId = 0; threadId < threadCount; threadId++) {
            tasks.push(async () => {
                const connection = await this.connectionPool.getConnection();

                try {
                    let queriesExecuted = 0;
                    const threadStartTime = process.hrtime.bigint();

                    for (let i = 0; i < queriesPerThread; i++) {
                        const queryIndex = i % queryTemplates.length;
                        const query = queryTemplates[queryIndex];

                        let params = [];
                        switch (queryIndex) {
                            case 0:
                                params = [threadId % 10];
                                break;
                            case 1:
                                params = ['INSERT'];
                                break;
                            case 2:
                                params = [threadId % 10];
                                break;
                            case 3:
                                params = [moment().subtract(1, 'minute').format('YYYY-MM-DD HH:mm:ss')];
                                break;
                        }

                        await connection.execute(query, params);
                        queriesExecuted++;
                    }

                    const threadEndTime = process.hrtime.bigint();
                    const threadDuration = Number(threadEndTime - threadStartTime) / 1000000;

                    return {
                        threadId,
                        queriesExecuted,
                        duration_ms: threadDuration,
                        queries_per_second: (queriesExecuted / (threadDuration / 1000)).toFixed(2)
                    };
                } finally {
                    connection.release();
                }
            });
        }

        const results = await async.parallelLimit(tasks, threadCount);
        const endTime = process.hrtime.bigint();
        const duration = Number(endTime - startTime) / 1000000;

        const totalQueries = results.reduce((sum, r) => sum + r.queriesExecuted, 0);

        return {
            operation: 'CONCURRENT_SELECT',
            threads: threadCount,
            queries_per_thread: queriesPerThread,
            total_queries: totalQueries,
            duration_ms: duration,
            queries_per_second: (totalQueries / (duration / 1000)).toFixed(2),
            avg_thread_performance: results
        };
    }

    async runConcurrentUpdates(threadCount, updatesPerThread) {
        console.log(chalk.yellow(`🔄 Running concurrent UPDATEs (${threadCount} threads, ${updatesPerThread} updates each)...`));

        const startTime = process.hrtime.bigint();
        const tasks = [];

        for (let threadId = 0; threadId < threadCount; threadId++) {
            tasks.push(async () => {
                const connection = await this.connectionPool.getConnection();

                try {
                    let updatesExecuted = 0;
                    const threadStartTime = process.hrtime.bigint();

                    for (let i = 0; i < updatesPerThread; i++) {
                        const [result] = await connection.execute(
                            `UPDATE concurrent_test 
               SET data = JSON_SET(data, '$.updated', ?, '$.update_count', COALESCE(JSON_EXTRACT(data, '$.update_count'), 0) + 1)
               WHERE thread_id = ? AND id % ? = ?
               LIMIT 10`,
                            [Date.now(), threadId, 10, i % 10]
                        );

                        updatesExecuted += result.affectedRows;
                    }

                    const threadEndTime = process.hrtime.bigint();
                    const threadDuration = Number(threadEndTime - threadStartTime) / 1000000;

                    return {
                        threadId,
                        updatesExecuted,
                        duration_ms: threadDuration,
                        updates_per_second: (updatesExecuted / (threadDuration / 1000)).toFixed(2)
                    };
                } finally {
                    connection.release();
                }
            });
        }

        const results = await async.parallelLimit(tasks, threadCount);
        const endTime = process.hrtime.bigint();
        const duration = Number(endTime - startTime) / 1000000;

        const totalUpdates = results.reduce((sum, r) => sum + r.updatesExecuted, 0);

        return {
            operation: 'CONCURRENT_UPDATE',
            threads: threadCount,
            updates_per_thread: updatesPerThread,
            total_updates: totalUpdates,
            duration_ms: duration,
            updates_per_second: (totalUpdates / (duration / 1000)).toFixed(2),
            avg_thread_performance: results
        };
    }

    async runMixedWorkload(threadCount, operationsPerThread) {
        console.log(chalk.yellow(`⚡ Running mixed workload (${threadCount} threads, ${operationsPerThread} operations each)...`));

        const startTime = process.hrtime.bigint();
        const tasks = [];

        for (let threadId = 0; threadId < threadCount; threadId++) {
            tasks.push(async () => {
                const connection = await this.connectionPool.getConnection();

                try {
                    let operations = { inserts: 0, selects: 0, updates: 0 };
                    const threadStartTime = process.hrtime.bigint();

                    for (let i = 0; i < operationsPerThread; i++) {
                        const operationType = i % 3; // 0: INSERT, 1: SELECT, 2: UPDATE

                        switch (operationType) {
                            case 0: // INSERT
                                await connection.execute(
                                    'INSERT INTO concurrent_test (thread_id, operation_type, data) VALUES (?, ?, ?)',
                                    [threadId, 'MIXED_INSERT', JSON.stringify({
                                        thread: threadId,
                                        operation: i,
                                        timestamp: Date.now()
                                    })]
                                );
                                operations.inserts++;
                                break;

                            case 1: // SELECT
                                await connection.execute(
                                    'SELECT COUNT(*) FROM concurrent_test WHERE thread_id <= ? AND operation_type LIKE ?',
                                    [threadId, '%INSERT%']
                                );
                                operations.selects++;
                                break;

                            case 2: // UPDATE
                                await connection.execute(
                                    'UPDATE concurrent_test SET data = JSON_SET(data, "$.mixed_update", ?) WHERE thread_id = ? AND id % 5 = ? LIMIT 5',
                                    [Date.now(), threadId, i % 5]
                                );
                                operations.updates++;
                                break;
                        }
                    }

                    const threadEndTime = process.hrtime.bigint();
                    const threadDuration = Number(threadEndTime - threadStartTime) / 1000000;

                    return {
                        threadId,
                        operations,
                        total_operations: operationsPerThread,
                        duration_ms: threadDuration,
                        operations_per_second: (operationsPerThread / (threadDuration / 1000)).toFixed(2)
                    };
                } finally {
                    connection.release();
                }
            });
        }

        const results = await async.parallelLimit(tasks, threadCount);
        const endTime = process.hrtime.bigint();
        const duration = Number(endTime - startTime) / 1000000;

        const totalOperations = results.reduce((sum, r) => sum + r.total_operations, 0);
        const aggregatedOps = results.reduce((acc, r) => {
            acc.inserts += r.operations.inserts;
            acc.selects += r.operations.selects;
            acc.updates += r.operations.updates;
            return acc;
        }, { inserts: 0, selects: 0, updates: 0 });

        return {
            operation: 'MIXED_WORKLOAD',
            threads: threadCount,
            operations_per_thread: operationsPerThread,
            total_operations: totalOperations,
            operation_breakdown: aggregatedOps,
            duration_ms: duration,
            operations_per_second: (totalOperations / (duration / 1000)).toFixed(2),
            avg_thread_performance: results
        };
    }

    async runConcurrentTest() {
        console.log(chalk.blue.bold(`🚀 Starting concurrent performance test on ${this.config.container}`));

        const testStartTime = process.hrtime.bigint();
        const threadCount = parseInt(this.config.threads);
        const recordsPerThread = Math.floor(parseInt(this.config.records) / threadCount);

        // Setup
        await this.setupConcurrentTables();

        // Run concurrent tests
        const insertResult = await this.runConcurrentInserts(threadCount, recordsPerThread);
        const selectResult = await this.runConcurrentReads(threadCount, recordsPerThread / 1000);
        const updateResult = await this.runConcurrentUpdates(threadCount, recordsPerThread / 4);
        const mixedResult = await this.runMixedWorkload(threadCount, recordsPerThread / 1000);

        const testEndTime = process.hrtime.bigint();
        const totalDuration = Number(testEndTime - testStartTime) / 1000000;

        this.results = {
            ...this.results,
            total_duration_ms: totalDuration,
            tests: {
                concurrent_insert: insertResult,
                concurrent_select: selectResult,
                concurrent_update: updateResult,
                mixed_workload: mixedResult
            }
        };

        console.log(chalk.green.bold(`✅ Concurrent test completed in ${(totalDuration / 1000).toFixed(2)} seconds`));
        return this.results;
    }
}

module.exports = ConcurrentTester; 