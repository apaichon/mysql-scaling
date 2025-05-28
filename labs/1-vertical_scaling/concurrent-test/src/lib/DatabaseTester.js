const mysql = require('mysql2/promise');
const chalk = require('chalk');
const cliProgress = require('cli-progress');
const moment = require('moment');

class DatabaseTester {
    constructor(config) {
        this.config = config;
        this.connection = null;
        this.results = {
            timestamp: moment().format('YYYY-MM-DD HH:mm:ss'),
            container: config.container,
            config: config,
            tests: {}
        };
    }

    async connect() {
        console.log(chalk.blue(`🔌 Connecting to ${this.config.container}...`));

        this.connection = await mysql.createConnection({
            host: this.config.host,
            port: this.config.port,
            user: this.config.user,
            password: this.config.password,
            database: this.config.database
        });

        console.log(chalk.green('✅ Connected to MySQL'));
    }

    async disconnect() {
        if (this.connection) {
            await this.connection.end();
            console.log(chalk.gray('🔌 Disconnected from MySQL'));
        }
    }

    async setupTestTables() {
        console.log(chalk.blue('🏗️  Setting up test tables...'));

        // Drop tables first
        await this.connection.execute('DROP TABLE IF EXISTS perf_test_insert');
        await this.connection.execute('DROP TABLE IF EXISTS perf_test_select');
        await this.connection.execute('DROP TABLE IF EXISTS perf_test_update');

        // Create perf_test_insert table
        await this.connection.execute(`
            CREATE TABLE perf_test_insert (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(100),
                email VARCHAR(100),
                age INT,
                city VARCHAR(50),
                data JSON,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_name (name),
                INDEX idx_email (email),
                INDEX idx_age (age),
                INDEX idx_city (city)
            ) ENGINE=InnoDB
        `);

        // Create perf_test_select table
        await this.connection.execute(`
            CREATE TABLE perf_test_select (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT,
                product_id INT,
                quantity INT,
                price DECIMAL(10,2),
                order_date DATE,
                status VARCHAR(20),
                metadata JSON,
                INDEX idx_user_id (user_id),
                INDEX idx_product_id (product_id),
                INDEX idx_order_date (order_date),
                INDEX idx_status (status),
                INDEX idx_composite (user_id, order_date, status)
            ) ENGINE=InnoDB
        `);

        // Create perf_test_update table
        await this.connection.execute(`
            CREATE TABLE perf_test_update (
                id INT AUTO_INCREMENT PRIMARY KEY,
                counter INT DEFAULT 0,
                last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                data TEXT,
                status VARCHAR(20) DEFAULT 'active',
                INDEX idx_counter (counter),
                INDEX idx_status (status)
            ) ENGINE=InnoDB
        `);

        console.log(chalk.green('✅ Test tables created'));
    }

    async populateSelectTable(records = 100000) {
        console.log(chalk.blue(`📊 Populating select table with ${records} records...`));

        const progressBar = new cliProgress.SingleBar({
            format: 'Progress |{bar}| {percentage}% | {value}/{total} Records',
            barCompleteChar: '\u2588',
            barIncompleteChar: '\u2591',
            hideCursor: true
        });

        progressBar.start(records, 0);

        const batchSize = 1000;
        const batches = Math.ceil(records / batchSize);

        for (let i = 0; i < batches; i++) {
            const batchRecords = Math.min(batchSize, records - (i * batchSize));
            const values = [];

            for (let j = 0; j < batchRecords; j++) {
                const recordId = (i * batchSize) + j + 1;
                values.push([
                    Math.floor(Math.random() * 10000) + 1, // user_id
                    Math.floor(Math.random() * 1000) + 1,  // product_id
                    Math.floor(Math.random() * 10) + 1,    // quantity
                    (Math.random() * 1000 + 10).toFixed(2), // price
                    moment().subtract(Math.floor(Math.random() * 365), 'days').format('YYYY-MM-DD'), // order_date
                    ['pending', 'processing', 'shipped', 'delivered'][Math.floor(Math.random() * 4)], // status
                    JSON.stringify({ batch: i, record: j, timestamp: Date.now() }) // metadata
                ]);
            }

            const placeholders = values.map(() => '(?, ?, ?, ?, ?, ?, ?)').join(', ');
            const sql = `INSERT INTO perf_test_select (user_id, product_id, quantity, price, order_date, status, metadata) VALUES ${placeholders}`;

            await this.connection.execute(sql, values.flat());
            progressBar.update((i + 1) * batchSize);
        }

        progressBar.stop();
        console.log(chalk.green('✅ Select table populated'));
    }

    async testInsertPerformance(records = 10000) {
        console.log(chalk.yellow(`🔄 Testing INSERT performance (${records} records)...`));

        const startTime = process.hrtime.bigint();
        const startMemory = process.memoryUsage();

        const progressBar = new cliProgress.SingleBar({
            format: 'INSERT |{bar}| {percentage}% | {value}/{total} Records | {duration_formatted}',
            barCompleteChar: '\u2588',
            barIncompleteChar: '\u2591',
            hideCursor: true
        });

        progressBar.start(records, 0);

        const batchSize = 500;
        const batches = Math.ceil(records / batchSize);
        let totalInserted = 0;

        for (let i = 0; i < batches; i++) {
            const batchRecords = Math.min(batchSize, records - (i * batchSize));
            const values = [];

            for (let j = 0; j < batchRecords; j++) {
                const recordId = (i * batchSize) + j + 1;
                values.push([
                    `User_${recordId}`,
                    `user_${recordId}@example.com`,
                    Math.floor(Math.random() * 50) + 18,
                    ['New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix'][Math.floor(Math.random() * 5)],
                    JSON.stringify({
                        batch: i,
                        record: j,
                        timestamp: Date.now(),
                        random: Math.random()
                    })
                ]);
            }

            const placeholders = values.map(() => '(?, ?, ?, ?, ?)').join(', ');
            const sql = `INSERT INTO perf_test_insert (name, email, age, city, data) VALUES ${placeholders}`;

            await this.connection.execute(sql, values.flat());
            totalInserted += batchRecords;
            progressBar.update(totalInserted);
        }

        const endTime = process.hrtime.bigint();
        const endMemory = process.memoryUsage();
        const duration = Number(endTime - startTime) / 1000000; // Convert to milliseconds

        progressBar.stop();

        const result = {
            operation: 'INSERT',
            records: totalInserted,
            duration_ms: duration,
            records_per_second: (totalInserted / (duration / 1000)).toFixed(2),
            memory_used_mb: ((endMemory.heapUsed - startMemory.heapUsed) / 1024 / 1024).toFixed(2),
            avg_time_per_record_ms: (duration / totalInserted).toFixed(4)
        };

        console.log(chalk.green(`✅ INSERT: ${result.records_per_second} records/sec`));
        return result;
    }

    async testSelectPerformance() {
        console.log(chalk.yellow('🔍 Testing SELECT performance...'));

        const tests = [
            {
                name: 'Simple WHERE',
                sql: 'SELECT COUNT(*) as count FROM perf_test_select WHERE user_id BETWEEN ? AND ?',
                params: [1000, 5000]
            },
            {
                name: 'Complex GROUP BY',
                sql: `SELECT user_id, COUNT(*) as order_count, AVG(price) as avg_price, SUM(quantity) as total_qty 
              FROM perf_test_select 
              WHERE order_date >= ? 
              GROUP BY user_id 
              HAVING COUNT(*) > ?
              ORDER BY AVG(price) DESC 
              LIMIT ?`,
                params: [moment().subtract(90, 'days').format('YYYY-MM-DD'), 2, 100]
            },
            {
                name: 'Multi-condition Filter',
                sql: `SELECT id, user_id, product_id, price, status
              FROM perf_test_select 
              WHERE status = ? 
              AND price > ?
              ORDER BY price DESC 
              LIMIT ?`,
                params: ['pending', 100.00, 1000]
            },
            {
                name: 'Aggregation with JSON',
                sql: `SELECT status, COUNT(*) as count, AVG(price) as avg_price, 
              MIN(price) as min_price, MAX(price) as max_price 
              FROM perf_test_select 
              WHERE JSON_EXTRACT(metadata, '$.batch') < ?
              GROUP BY status 
              ORDER BY COUNT(*) DESC`,
                params: [50]
            }
        ];

        const results = [];

        for (const test of tests) {
            try {
                const startTime = process.hrtime.bigint();
                const startMemory = process.memoryUsage();

                // console.log('Test Data:', test.sql, test.params);

                const [rows] = await this.connection.query(test.sql, test.params);


                const endTime = process.hrtime.bigint();
                const endMemory = process.memoryUsage();
                const duration = Number(endTime - startTime) / 1000000;

                const result = {
                    test_name: test.name,
                    duration_ms: duration,
                    rows_returned: Array.isArray(rows) ? rows.length : 1,
                    memory_used_mb: ((endMemory.heapUsed - startMemory.heapUsed) / 1024 / 1024).toFixed(2),
                    success: true
                };

                results.push(result);
                console.log(chalk.green(`✅ ${test.name}: ${duration.toFixed(2)}ms (${result.rows_returned} rows)`));
            } catch (error) {
                console.log(chalk.red(`❌ ${test.name}: ${error.message}`));
                results.push({
                    test_name: test.name,
                    duration_ms: 0,
                    rows_returned: 0,
                    memory_used_mb: 0,
                    success: false,
                    error: error.message
                });
            }
        }

        return {
            operation: 'SELECT',
            tests: results,
            total_duration_ms: results.reduce((sum, r) => sum + r.duration_ms, 0),
            successful_tests: results.filter(r => r.success).length,
            failed_tests: results.filter(r => !r.success).length
        };
    }

    async testUpdatePerformance(records = 5000) {
        console.log(chalk.yellow(`🔄 Testing UPDATE performance (${records} records)...`));

        // First populate the update table
        await this.populateUpdateTable(records * 2);

        const startTime = process.hrtime.bigint();
        const startMemory = process.memoryUsage();

        const batchSize = 100;
        const batches = Math.ceil(records / batchSize);
        let totalUpdated = 0;

        const progressBar = new cliProgress.SingleBar({
            format: 'UPDATE |{bar}| {percentage}% | {value}/{total} Records',
            barCompleteChar: '\u2588',
            barIncompleteChar: '\u2591',
            hideCursor: true
        });

        progressBar.start(records, 0);

        for (let i = 0; i < batches; i++) {
            const limit = Math.min(batchSize, records - totalUpdated);

            try {
                const [result] = await this.connection.execute(
                    `UPDATE perf_test_update 
                     SET counter = counter + ?, 
                         data = CONCAT(COALESCE(data, ''), ?),
                         status = ?
                     WHERE id BETWEEN ? AND ?`,
                    [
                        1,
                        `_batch_${i}_${Date.now()}`,
                        i % 2 === 0 ? 'updated' : 'active',
                        i * batchSize + 1,
                        (i + 1) * batchSize
                    ]
                );

                totalUpdated += result.affectedRows;
                progressBar.update(totalUpdated);
            } catch (error) {
                console.log(chalk.red(`❌ UPDATE batch ${i}: ${error.message}`));
                break;
            }
        }

        const endTime = process.hrtime.bigint();
        const endMemory = process.memoryUsage();
        const duration = Number(endTime - startTime) / 1000000;

        progressBar.stop();

        const result = {
            operation: 'UPDATE',
            records: totalUpdated,
            duration_ms: duration,
            records_per_second: totalUpdated > 0 ? (totalUpdated / (duration / 1000)).toFixed(2) : '0',
            memory_used_mb: ((endMemory.heapUsed - startMemory.heapUsed) / 1024 / 1024).toFixed(2),
            avg_time_per_record_ms: totalUpdated > 0 ? (duration / totalUpdated).toFixed(4) : '0'
        };

        console.log(chalk.green(`✅ UPDATE: ${result.records_per_second} records/sec`));
        return result;
    }

    async populateUpdateTable(records) {
        const batchSize = 1000;
        const batches = Math.ceil(records / batchSize);

        for (let i = 0; i < batches; i++) {
            const batchRecords = Math.min(batchSize, records - (i * batchSize));
            const values = [];

            for (let j = 0; j < batchRecords; j++) {
                values.push([
                    Math.floor(Math.random() * 1000),
                    `initial_data_${i}_${j}_${Date.now()}`
                ]);
            }

            const placeholders = values.map(() => '(?, ?)').join(', ');
            const sql = `INSERT INTO perf_test_update (counter, data) VALUES ${placeholders}`;

            await this.connection.execute(sql, values.flat());
        }
    }

    async getSystemMetrics() {
        console.log(chalk.blue('📊 Collecting system metrics...'));

        const [variables] = await this.connection.execute(`
      SELECT variable_name, variable_value 
      FROM performance_schema.global_variables 
      WHERE variable_name IN (
        'innodb_buffer_pool_size',
        'max_connections',
        'innodb_io_capacity',
        'innodb_flush_log_at_trx_commit',
        'thread_cache_size',
        'table_open_cache'
      )
    `);

        const [status] = await this.connection.execute(`
      SHOW STATUS WHERE Variable_name IN (
        'Connections',
        'Queries',
        'Innodb_buffer_pool_read_requests',
        'Innodb_buffer_pool_reads',
        'Innodb_rows_inserted',
        'Innodb_rows_read',
        'Innodb_rows_updated',
        'Threads_connected',
        'Threads_running'
      )
    `);

        return {
            variables: variables.reduce((acc, row) => {
                acc[row.variable_name] = row.variable_value;
                return acc;
            }, {}),
            status: status.reduce((acc, row) => {
                acc[row.Variable_name] = row.Value;
                return acc;
            }, {}),
            memory_usage: process.memoryUsage(),
            timestamp: moment().format('YYYY-MM-DD HH:mm:ss')
        };
    }

    async runFullTest() {
        console.log(chalk.blue.bold(`🚀 Starting full performance test on ${this.config.container}`));

        const testStartTime = process.hrtime.bigint();

        // Setup
        await this.setupTestTables();
        await this.populateSelectTable(parseInt(this.config.records));

        // Get initial metrics
        const initialMetrics = await this.getSystemMetrics();

        // Run tests
        const insertResult = await this.testInsertPerformance(parseInt(this.config.records));
        const selectResult = await this.testSelectPerformance();
        const updateResult = await this.testUpdatePerformance(parseInt(this.config.records) / 2);

        // Get final metrics
        const finalMetrics = await this.getSystemMetrics();

        const testEndTime = process.hrtime.bigint();
        const totalDuration = Number(testEndTime - testStartTime) / 1000000;

        this.results = {
            ...this.results,
            total_duration_ms: totalDuration,
            tests: {
                insert: insertResult,
                select: selectResult,
                update: updateResult
            },
            metrics: {
                initial: initialMetrics,
                final: finalMetrics
            }
        };

        console.log(chalk.green.bold(`✅ Full test completed in ${(totalDuration / 1000).toFixed(2)} seconds`));
        return this.results;
    }
}

module.exports = DatabaseTester; 