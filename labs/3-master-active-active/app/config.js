module.exports = {
    // Direct node connections (for testing individual nodes)
    nodes: {
        node1: {
            host: 'localhost',
            port: 3306,
            user: 'root',
            password: 'rootpassword',
            database: 'testdb'
        },
        node2: {
            host: 'localhost',
            port: 3307,
            user: 'root',
            password: 'rootpassword',
            database: 'testdb'
        },
        node3: {
            host: 'localhost',
            port: 3308,
            user: 'root',
            password: 'rootpassword',
            database: 'testdb'
        }
    },

    // ProxySQL connection (for load-balanced access)
    proxysql: {
        host: 'localhost',
        port: 6033,
        user: 'root',
        password: 'rootpassword',
        database: 'testdb'
    },

    // Test configuration
    test: {
        // Number of records to insert in bulk tests
        bulkInsertCount: 1000,

        // Number of concurrent connections for load testing
        concurrentConnections: 10,

        // Test duration in seconds
        testDuration: 30,

        // Delay between operations in milliseconds
        operationDelay: 100,

        // Invalid port for failover testing (should not be used by any service)
        invalidPort: 9999,

        // Connection timeout for failover tests (in milliseconds)
        failoverConnectionTimeout: 5000
    },

    // Logging configuration
    logging: {
        level: 'info',
        format: 'detailed'
    }
}; 