const mysql = require('mysql2/promise');
const config = require('./config');

class DatabaseManager {
    constructor() {
        this.connections = new Map();
        this.pool = null;
    }

    // Create connection to a specific node
    async connectToNode(nodeName) {
        try {
            const nodeConfig = config.nodes[nodeName];
            if (!nodeConfig) {
                throw new Error(`Unknown node: ${nodeName}`);
            }

            const connection = await mysql.createConnection(nodeConfig);
            this.connections.set(nodeName, connection);

            console.log(`✅ Connected to ${nodeName}`);
            return connection;
        } catch (error) {
            console.error(`❌ Failed to connect to ${nodeName}:`, error.message);
            throw error;
        }
    }

    // Create connection pool for ProxySQL
    async createProxySQLPool() {
        try {
            this.pool = mysql.createPool({
                ...config.proxysql,
                waitForConnections: true,
                connectionLimit: 10,
                queueLimit: 0,
                connectTimeout: 30000,     // Time to establish connection
            });

            // Test the pool
            const testConnection = await this.pool.getConnection();
            await testConnection.ping();
            testConnection.release();

            console.log('✅ ProxySQL connection pool created');
            return this.pool;
        } catch (error) {
            console.error('❌ Failed to create ProxySQL pool:', error.message);
            throw error;
        }
    }

    // Get connection to a specific node
    getNodeConnection(nodeName) {
        return this.connections.get(nodeName);
    }

    // Get ProxySQL pool
    getProxySQLPool() {
        return this.pool;
    }

    // Execute query on a specific node
    async executeOnNode(nodeName, query, params = []) {
        const connection = this.getNodeConnection(nodeName);
        if (!connection) {
            throw new Error(`No connection to ${nodeName}`);
        }

        try {
            const [rows] = await connection.execute(query, params);
            return rows;
        } catch (error) {
            console.error(`❌ Query failed on ${nodeName}:`, error.message);
            throw error;
        }
    }

    // Execute query through ProxySQL
    async executeOnProxySQL(query, params = []) {
        if (!this.pool) {
            throw new Error('ProxySQL pool not initialized');
        }

        try {
            const [rows] = await this.pool.execute(query, params);
            return rows;
        } catch (error) {
            console.error('❌ Query failed on ProxySQL:', error.message);
            throw error;
        }
    }

    // Get cluster status from a node
    async getClusterStatus(nodeName) {
        const query = `
      SHOW STATUS LIKE 'wsrep%'
    `;

        const rows = await this.executeOnNode(nodeName, query);
        return rows.reduce((acc, row) => {
            acc[row.Variable_name] = row.Value;
            return acc;
        }, {});
    }

    // Get node information
    async getNodeInfo(nodeName) {
        const queries = [
            'SELECT @@hostname as hostname, @@port as port, @@version as version',
            'SHOW STATUS LIKE "wsrep_cluster_size"',
            'SHOW STATUS LIKE "wsrep_cluster_status"',
            'SHOW STATUS LIKE "wsrep_connected"',
            'SHOW STATUS LIKE "wsrep_ready"'
        ];

        const results = {};

        for (const query of queries) {
            const rows = await this.executeOnNode(nodeName, query);
            if (rows.length > 0) {
                if (rows[0].Variable_name) {
                    results[rows[0].Variable_name] = rows[0].Value;
                } else {
                    Object.assign(results, rows[0]);
                }
            }
        }

        return results;
    }

    // Create test tables
    async createTestTables(nodeName) {
        const createTableQuery = `
      CREATE TABLE IF NOT EXISTS cluster_test (
        id INT PRIMARY KEY AUTO_INCREMENT,
        node_name VARCHAR(50) NOT NULL,
        message TEXT,
        test_type VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_node_name (node_name),
        INDEX idx_created_at (created_at)
      ) ENGINE=InnoDB
    `;

        const createUsersTableQuery = `
      CREATE TABLE IF NOT EXISTS users (
        id INT PRIMARY KEY AUTO_INCREMENT,
        username VARCHAR(100) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        first_name VARCHAR(100),
        last_name VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_username (username),
        INDEX idx_email (email),
        INDEX idx_created_at (created_at)
      ) ENGINE=InnoDB
    `;

        try {
            await this.executeOnNode(nodeName, createTableQuery);
            await this.executeOnNode(nodeName, createUsersTableQuery);
            console.log(`✅ Test tables created on ${nodeName}`);
        } catch (error) {
            console.error(`❌ Failed to create test tables on ${nodeName}:`, error.message);
            throw error;
        }
    }

    // Close all connections
    async closeAll() {
        console.log('🔄 Closing all database connections...');

        // Close individual node connections
        for (const [nodeName, connection] of this.connections) {
            try {
                await connection.end();
                console.log(`✅ Closed connection to ${nodeName}`);
            } catch (error) {
                console.error(`❌ Error closing ${nodeName}:`, error.message);
            }
        }

        // Close ProxySQL pool
        if (this.pool) {
            try {
                await this.pool.end();
                console.log('✅ Closed ProxySQL pool');
            } catch (error) {
                console.error('❌ Error closing ProxySQL pool:', error.message);
            }
        }

        this.connections.clear();
        this.pool = null;
    }
}

module.exports = DatabaseManager;