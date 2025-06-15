const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const helmet = require('helmet');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Database configurations
const masterConfig = {
    host: 'localhost',
    port: 3306,
    user: 'appuser',
    password: 'apppassword',
    database: 'testdb',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
};

const slaveConfig = {
    host: 'localhost',
    port: 3307, // Will be overridden for slave2
    user: 'appuser',
    password: 'apppassword',
    database: 'testdb',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
};

// Create connection pools
const masterPool = mysql.createPool(masterConfig);

const slave1Config = { ...slaveConfig, port: 3307 };
const slave2Config = { ...slaveConfig, port: 3308 };

const slave1Pool = mysql.createPool(slave1Config);
const slave2Pool = mysql.createPool(slave2Config);

// Function to randomly select a slave
function getRandomSlave() {
    return Math.random() < 0.5 ? slave1Pool : slave2Pool;
}

// Health check endpoint
app.get('/health', async (req, res) => {
    try {
        const [masterResult] = await masterPool.query('SELECT 1 as status');
        const [slave1Result] = await slave1Pool.query('SELECT 1 as status');
        const [slave2Result] = await slave2Pool.query('SELECT 1 as status');

        res.json({
            status: 'healthy',
            master: masterResult[0].status === 1 ? 'connected' : 'disconnected',
            slave1: slave1Result[0].status === 1 ? 'connected' : 'disconnected',
            slave2: slave2Result[0].status === 1 ? 'connected' : 'disconnected'
        });
    } catch (error) {
        res.status(500).json({
            status: 'unhealthy',
            error: error.message
        });
    }
});

// READ operations - randomly route to slaves
app.get('/api/users', async (req, res) => {
    try {
        const slavePool = getRandomSlave();
        const [rows] = await slavePool.query('SELECT * FROM users');
        res.json({
            success: true,
            data: rows,
            source: slavePool === slave1Pool ? 'slave1' : 'slave2'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

app.get('/api/users/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const slavePool = getRandomSlave();
        const [rows] = await slavePool.query('SELECT * FROM users WHERE id = ?', [id]);

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        res.json({
            success: true,
            data: rows[0],
            source: slavePool === slave1Pool ? 'slave1' : 'slave2'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// WRITE operations - always route to master
app.post('/api/users', async (req, res) => {
    try {
        const { username, email, first_name, last_name } = req.body;

        if (!username || !email) {
            return res.status(400).json({
                success: false,
                error: 'Username and email are required'
            });
        }

        const [result] = await masterPool.query(
            'INSERT INTO users (username, email, first_name, last_name) VALUES (?, ?, ?, ?)',
            [username, email, first_name, last_name]
        );

        res.status(201).json({
            success: true,
            data: {
                id: result.insertId,
                username,
                email,
                first_name,
                last_name
            },
            source: 'master'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

app.put('/api/users/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { username, email, first_name, last_name } = req.body;

        const [result] = await masterPool.query(
            'UPDATE users SET username = ?, email = ?, first_name = ?, last_name = ? WHERE id = ?',
            [username, email, first_name, last_name, id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        res.json({
            success: true,
            data: {
                id,
                username,
                email,
                first_name,
                last_name
            },
            source: 'master'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

app.delete('/api/users/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const [result] = await masterPool.query('DELETE FROM users WHERE id = ?', [id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        res.json({
            success: true,
            message: 'User deleted successfully',
            source: 'master'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Custom query endpoint (for advanced operations)
app.post('/api/query', async (req, res) => {
    try {
        const { query, params = [], operation = 'read' } = req.body;

        if (!query) {
            return res.status(400).json({
                success: false,
                error: 'Query is required'
            });
        }

        // Determine if this is a read or write operation
        const isWriteOperation = /^(INSERT|UPDATE|DELETE|CREATE|ALTER|DROP)/i.test(query.trim());

        let pool;
        let source;

        if (isWriteOperation || operation === 'write') {
            pool = masterPool;
            source = 'master';
        } else {
            pool = getRandomSlave();
            source = pool === slave1Pool ? 'slave1' : 'slave2';
        }

        const [result] = await pool.query(query, params);

        res.json({
            success: true,
            data: result,
            source,
            operation: isWriteOperation ? 'write' : 'read'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('Error:', error);
    res.status(500).json({
        success: false,
        error: 'Internal server error'
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'Endpoint not found'
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 MySQL Proxy API running on port ${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/health`);
    console.log(`📖 READ operations: Randomly routed to slave1 (3307) or slave2 (3308)`);
    console.log(`✍️  WRITE operations: Always routed to master (3306)`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('SIGTERM received, shutting down gracefully...');
    await masterPool.end();
    await slave1Pool.end();
    await slave2Pool.end();
    process.exit(0);
});

process.on('SIGINT', async () => {
    console.log('SIGINT received, shutting down gracefully...');
    await masterPool.end();
    await slave1Pool.end();
    await slave2Pool.end();
    process.exit(0);
}); 