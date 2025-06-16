// Configuration for MySQL Sharding Test Application

const config = {
    // Sharding Router (ProxySQL)
    shardingRouter: {
        host: 'localhost',
        port: 3307,
        user: 'root',
        password: 'rootpassword',
        database: 'shard1',
        connectionLimit: 10
    },

    // Direct connections to individual shards
    shards: {
        shard1: {
            primary: {
                host: 'localhost',
                port: 3306,
                user: 'root',
                password: 'rootpassword',
                database: 'shard1',
                connectionLimit: 5
            },
            replica: {
                host: 'localhost',
                port: 3308,
                user: 'root',
                password: 'rootpassword',
                database: 'shard1',
                connectionLimit: 5
            }
        },
        shard2: {
            primary: {
                host: 'localhost',
                port: 3309,
                user: 'root',
                password: 'rootpassword',
                database: 'shard2',
                connectionLimit: 5
            },
            replica: {
                host: 'localhost',
                port: 3310,
                user: 'root',
                password: 'rootpassword',
                database: 'shard2',
                connectionLimit: 5
            }
        },
        shard3: {
            primary: {
                host: 'localhost',
                port: 3311,
                user: 'root',
                password: 'rootpassword',
                database: 'shard3',
                connectionLimit: 5
            },
            replica: {
                host: 'localhost',
                port: 3312,
                user: 'root',
                password: 'rootpassword',
                database: 'shard3',
                connectionLimit: 5
            }
        }
    },

    // Sharding configuration
    sharding: {
        // User ID ranges for each shard
        ranges: {
            shard1: { min: 1, max: 1000 },
            shard2: { min: 1001, max: 2000 },
            shard3: { min: 2001, max: 3000 }
        },

        // Shard mapping function
        getShardForUserId: function (userId) {
            if (userId >= 1 && userId <= 1000) return 'shard1';
            if (userId >= 1001 && userId <= 2000) return 'shard2';
            if (userId >= 2001 && userId <= 3000) return 'shard3';
            throw new Error(`User ID ${userId} is outside the supported range (1-3000)`);
        },

        // Get shard connection config
        getShardConfig: function (shardName) {
            return this.shards[shardName];
        }
    },

    // Test configuration
    test: {
        // Number of test users to create
        userCount: 100,

        // Number of test orders to create
        orderCount: 50,

        // Performance test settings
        performance: {
            concurrentQueries: 10,
            queryCount: 100,
            timeout: 30000
        },

        // Failover test settings
        failover: {
            timeout: 10000,
            retryAttempts: 3,
            retryDelay: 1000
        }
    },

    // Monitoring configuration
    monitoring: {
        // Metrics collection interval (ms)
        interval: 5000,

        // Performance thresholds
        thresholds: {
            queryTime: 1000, // ms
            connectionTime: 500, // ms
            errorRate: 0.05 // 5%
        }
    },

    // Logging configuration
    logging: {
        level: 'info', // debug, info, warn, error
        timestamp: true,
        colors: true
    },

    // Application settings
    app: {
        port: 3001,
        host: 'localhost',
        cors: {
            origin: '*',
            methods: ['GET', 'POST', 'PUT', 'DELETE'],
            allowedHeaders: ['Content-Type', 'Authorization']
        }
    }
};

module.exports = config; 