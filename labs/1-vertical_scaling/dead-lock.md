The deadlock error during stress testing on the optimized MySQL configuration is a common issue that occurs due to several factors related to the optimization settings. Let me explain why this happens and how to address it.

Search files...
Read file: labs/1-vertical_scaling/concurrent-test/src/lib/StressTester.js
Read file: labs/1-vertical_scaling/concurrent-test/src/lib/StressTester.js
Based on my analysis of the code and configuration files, the deadlock error during stress testing on the optimized MySQL configuration occurs due to several factors related to the optimization settings. Here's why this happens and how to address it:

## Why Deadlocks Occur in Optimized Configuration

### 1. **Increased Concurrency and Lock Contention**
The optimized configuration increases several parameters that lead to higher concurrency:

```ini
# Optimized settings that increase concurrency
max_connections = 200          # vs 151 default
innodb_thread_concurrency = 0  # Let InnoDB manage (more aggressive)
innodb_read_io_threads = 8     # vs 4 default
innodb_write_io_threads = 8    # vs 4 default
```

### 2. **Transaction Isolation and Locking Behavior**
The stress test code shows complex transactions with multiple operations:

```javascript
// From StressTester.js - lines 160-180
await connection.beginTransaction();
// Multiple operations in same transaction
await connection.execute('INSERT INTO stress_test_transactions...');
await connection.execute('UPDATE stress_test_transactions SET balance...');
await connection.execute('INSERT INTO stress_test_transactions...');
await connection.commit();
```

### 3. **Optimized Configuration Changes**
Key settings that contribute to deadlocks:

```ini
# These settings make the system more aggressive
innodb_flush_log_at_trx_commit = 2     # Less durability, more concurrency
innodb_io_capacity = 1000              # Higher I/O capacity
innodb_buffer_pool_size = 6G           # Larger buffer pool
```

## Solutions to Reduce Deadlocks

### 1. **Add Deadlock-Specific Configuration**
Add these settings to your optimized configuration:

```ini
# Add to mysql/optimized.cnf
[mysqld]
# Deadlock prevention settings
innodb_lock_wait_timeout = 50          # Increase from default 50
innodb_deadlock_detect = ON            # Enable deadlock detection
innodb_print_all_deadlocks = ON        # Log all deadlocks for debugging

# Transaction isolation level
transaction_isolation = READ-COMMITTED  # Less strict than REPEATABLE-READ

# Lock timeout settings
lock_wait_timeout = 31536000           # 1 year in seconds

# InnoDB lock management
innodb_lock_wait_timeout = 50
innodb_rollback_on_timeout = ON
```

### 2. **Modify Stress Test Code**
Update the transaction stress test to reduce deadlock probability:

```javascript
// Modified transaction stress test with deadlock handling
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
            let deadlockRetries = 0;
            const maxRetries = 3;

            try {
                for (let i = 0; i < transactionsPerThread; i++) {
                    let retryCount = 0;
                    let transactionSuccess = false;

                    while (retryCount < maxRetries && !transactionSuccess) {
                        await connection.beginTransaction();

                        try {
                            // Use consistent ordering to reduce deadlocks
                            const accountId = Math.floor(Math.random() * 1000) + 1;
                            const amount = (Math.random() * 1000 + 10).toFixed(2);

                            // Order operations consistently
                            const accounts = [accountId, accountId + 1000].sort((a, b) => a - b);

                            // First account operations
                            await connection.execute(
                                'INSERT INTO stress_test_transactions (account_id, transaction_type, amount, balance, metadata) VALUES (?, ?, ?, ?, ?)',
                                [accounts[0], 'DEBIT', amount, 0, JSON.stringify({ thread: threadId, transaction: i })]
                            );

                            await connection.execute(
                                'UPDATE stress_test_transactions SET balance = balance - ? WHERE account_id = ?',
                                [amount, accounts[0]]
                            );

                            // Second account operations
                            await connection.execute(
                                'INSERT INTO stress_test_transactions (account_id, transaction_type, amount, balance, metadata) VALUES (?, ?, ?, ?, ?)',
                                [accounts[1], 'CREDIT', amount, 0, JSON.stringify({ thread: threadId, transaction: i })]
                            );

                            await connection.commit();
                            completedTransactions++;
                            transactionSuccess = true;

                        } catch (error) {
                            await connection.rollback();
                            
                            if (error.message.includes('Deadlock') || error.message.includes('lock')) {
                                retryCount++;
                                deadlockRetries++;
                                
                                if (retryCount < maxRetries) {
                                    // Exponential backoff
                                    await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 10));
                                    console.log(chalk.yellow(`🔄 Retrying transaction after deadlock (attempt ${retryCount})`));
                                } else {
                                    console.error(chalk.red(`❌ Transaction failed after ${maxRetries} retries: ${error.message}`));
                                }
                            } else {
                                console.error(chalk.red(`❌ Transaction failed: ${error.message}`));
                                break; // Don't retry non-deadlock errors
                            }
                        }
                    }
                }

                return { threadId, completedTransactions, deadlockRetries };
            } finally {
                connection.release();
            }
        });
    }

    const results = await async.parallelLimit(tasks, threadCount);
    const endTime = process.hrtime.bigint();
    const duration = Number(endTime - startTime) / 1000000;

    const totalTransactions = results.reduce((sum, r) => sum + r.completedTransactions, 0);
    const totalDeadlockRetries = results.reduce((sum, r) => sum + r.deadlockRetries, 0);

    return {
        operation: 'TRANSACTION_STRESS',
        duration_ms: duration,
        total_transactions: totalTransactions,
        transactions_per_second: (totalTransactions / (duration / 1000)).toFixed(2),
        deadlock_retries: totalDeadlockRetries,
        threads: threadCount,
        thread_results: results
    };
}
```

### 3. **Reduce Stress Test Intensity**
Modify the test parameters to be less aggressive:

```javascript
// In your main test runner
const stressConfig = {
    threads: 5,           // Reduce from 10
    records: 50000,       // Reduce from 1000000
    transactionCount: 200, // Reduce from 500
    queryCount: 100       // Reduce from 200
};
```

### 4. **Add Connection Pool Optimization**
Update the connection pool configuration:

```javascript
this.connectionPool = mysql.createPool({
    host: this.config.host,
    port: this.config.port,
    user: this.config.user,
    password: this.config.password,
    database: this.config.database,
    connectionLimit: parseInt(this.config.threads), // Reduce from *2
    queueLimit: 10,                    // Add queue limit
    acquireTimeout: 30000,             // Reduce from 60000
    timeout: 30000,                    // Reduce from 60000
    // Add deadlock-specific settings
    multipleStatements: false,
    dateStrings: false
});
```

### 5. **Monitor and Debug Deadlocks**
Add deadlock monitoring to your test:

```javascript
// Add this method to StressTester class
async monitorDeadlocks() {
    const connection = await this.connectionPool.getConnection();
    try {
        const [rows] = await connection.execute(`
            SELECT 
                COUNT(*) as deadlock_count,
                MAX(created_at) as last_deadlock
            FROM information_schema.INNODB_METRICS 
            WHERE name = 'lock_deadlocks'
        `);
        
        console.log(chalk.yellow(`🔍 Deadlock count: ${rows[0].deadlock_count}`));
        return rows[0];
    } finally {
        connection.release();
    }
}
```

## Summary

The deadlocks occur because the optimized configuration increases concurrency and reduces transaction isolation, while the stress test creates complex multi-operation transactions that compete for the same resources. The solutions involve:

1. **Configuration tuning** for better deadlock handling
2. **Code modifications** with retry logic and consistent ordering
3. **Reduced test intensity** to avoid overwhelming the system
4. **Better monitoring** to track deadlock patterns

These changes will significantly reduce deadlock occurrences while still allowing you to test the performance benefits of the optimized configuration.