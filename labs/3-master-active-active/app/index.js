const express = require('express');
const cors = require('cors');
const DatabaseManager = require('./database');
const ClusterTester = require('./test-cluster');
const LoadTester = require('./load-test');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Initialize database manager
const dbManager = new DatabaseManager();

// Routes
app.get('/', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>Galera Cluster Tester</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 40px; }
            .container { max-width: 800px; margin: 0 auto; }
            .card { border: 1px solid #ddd; padding: 20px; margin: 20px 0; border-radius: 5px; }
            .btn { background: #007bff; color: white; padding: 10px 20px; border: none; border-radius: 3px; cursor: pointer; margin: 5px; }
            .btn:hover { background: #0056b3; }
            .status { padding: 10px; margin: 10px 0; border-radius: 3px; }
            .success { background: #d4edda; color: #155724; }
            .error { background: #f8d7da; color: #721c24; }
            .info { background: #d1ecf1; color: #0c5460; }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>🚀 Galera Cluster Tester</h1>
            
            <div class="card">
                <h2>Cluster Health</h2>
                <button class="btn" onclick="checkClusterHealth()">Check Cluster Health</button>
                <div id="healthStatus"></div>
            </div>
            
            <div class="card">
                <h2>Replication Tests</h2>
                <button class="btn" onclick="testReplication()">Test Replication</button>
                <div id="replicationStatus"></div>
            </div>
            
            <div class="card">
                <h2>Load Balancing Tests</h2>
                <button class="btn" onclick="testLoadBalancing()">Test Load Balancing</button>
                <div id="loadBalancingStatus"></div>
            </div>
            
            <div class="card">
                <h2>Performance Tests</h2>
                <button class="btn" onclick="testPerformance()">Test Performance</button>
                <div id="performanceStatus"></div>
            </div>
            
            <div class="card">
                <h2>Load Tests</h2>
                <button class="btn" onclick="runLoadTests()">Run Load Tests</button>
                <div id="loadTestStatus"></div>
            </div>
            
            <div class="card">
                <h2>Cluster Information</h2>
                <button class="btn" onclick="getClusterInfo()">Get Cluster Info</button>
                <div id="clusterInfo"></div>
            </div>
        </div>
        
        <script>
            async function checkClusterHealth() {
                const statusDiv = document.getElementById('healthStatus');
                statusDiv.innerHTML = '<div class="info">Checking cluster health...</div>';
                
                try {
                    const response = await fetch('/api/health');
                    const data = await response.json();
                    
                    let html = '<div class="success">Cluster Health Check Results:</div>';
                    for (const [node, info] of Object.entries(data)) {
                        if (info.error) {
                            html += \`<div class="error">❌ \${node}: \${info.error}</div>\`;
                        } else {
                            html += \`<div class="success">✅ \${node}: \${info.wsrep_cluster_status} (\${info.wsrep_cluster_size} nodes)</div>\`;
                        }
                    }
                    statusDiv.innerHTML = html;
                } catch (error) {
                    statusDiv.innerHTML = \`<div class="error">Error: \${error.message}</div>\`;
                }
            }
            
            async function testReplication() {
                const statusDiv = document.getElementById('replicationStatus');
                statusDiv.innerHTML = '<div class="info">Testing replication...</div>';
                
                try {
                    const response = await fetch('/api/test/replication', { method: 'POST' });
                    const data = await response.json();
                    
                    if (data.success) {
                        statusDiv.innerHTML = '<div class="success">✅ Replication test completed successfully!</div>';
                    } else {
                        statusDiv.innerHTML = \`<div class="error">❌ Replication test failed: \${data.error}</div>\`;
                    }
                } catch (error) {
                    statusDiv.innerHTML = \`<div class="error">Error: \${error.message}</div>\`;
                }
            }
            
            async function testLoadBalancing() {
                const statusDiv = document.getElementById('loadBalancingStatus');
                statusDiv.innerHTML = '<div class="info">Testing load balancing...</div>';
                
                try {
                    const response = await fetch('/api/test/load-balancing', { method: 'POST' });
                    const data = await response.json();
                    
                    if (data.success) {
                        statusDiv.innerHTML = '<div class="success">✅ Load balancing test completed successfully!</div>';
                    } else {
                        statusDiv.innerHTML = \`<div class="error">❌ Load balancing test failed: \${data.error}</div>\`;
                    }
                } catch (error) {
                    statusDiv.innerHTML = \`<div class="error">Error: \${error.message}</div>\`;
                }
            }
            
            async function testPerformance() {
                const statusDiv = document.getElementById('performanceStatus');
                statusDiv.innerHTML = '<div class="info">Testing performance...</div>';
                
                try {
                    const response = await fetch('/api/test/performance', { method: 'POST' });
                    const data = await response.json();
                    
                    if (data.success) {
                        let html = '<div class="success">✅ Performance test completed!</div>';
                        html += \`<div class="info">📈 Bulk insert rate: \${data.results.bulkInsertRate} records/sec</div>\`;
                        html += \`<div class="info">🔍 Query time: \${data.results.queryTime}ms</div>\`;
                        statusDiv.innerHTML = html;
                    } else {
                        statusDiv.innerHTML = \`<div class="error">❌ Performance test failed: \${data.error}</div>\`;
                    }
                } catch (error) {
                    statusDiv.innerHTML = \`<div class="error">Error: \${error.message}</div>\`;
                }
            }
            
            async function runLoadTests() {
                const statusDiv = document.getElementById('loadTestStatus');
                statusDiv.innerHTML = '<div class="info">Running load tests...</div>';
                
                try {
                    const response = await fetch('/api/test/load', { method: 'POST' });
                    const data = await response.json();
                    
                    if (data.success) {
                        let html = '<div class="success">✅ Load tests completed!</div>';
                        html += \`<div class="info">📝 Write rate: \${data.results.concurrentWrites.writeRate} records/sec</div>\`;
                        html += \`<div class="info">🔍 Read rate: \${data.results.concurrentReads.readRate} queries/sec</div>\`;
                        html += \`<div class="info">🔄 Mixed rate: \${data.results.mixedLoad.operationRate} ops/sec</div>\`;
                        statusDiv.innerHTML = html;
                    } else {
                        statusDiv.innerHTML = \`<div class="error">❌ Load tests failed: \${data.error}</div>\`;
                    }
                } catch (error) {
                    statusDiv.innerHTML = \`<div class="error">Error: \${error.message}</div>\`;
                }
            }
            
            async function getClusterInfo() {
                const statusDiv = document.getElementById('clusterInfo');
                statusDiv.innerHTML = '<div class="info">Getting cluster information...</div>';
                
                try {
                    const response = await fetch('/api/cluster/info');
                    const data = await response.json();
                    
                    let html = '<div class="success">Cluster Information:</div>';
                    for (const [node, info] of Object.entries(data)) {
                        html += \`<div class="info">\${node}: \${info.hostname}:\${info.port} - \${info.version}</div>\`;
                    }
                    statusDiv.innerHTML = html;
                } catch (error) {
                    statusDiv.innerHTML = \`<div class="error">Error: \${error.message}</div>\`;
                }
            }
        </script>
    </body>
    </html>
  `);
});

// API Routes
app.get('/api/health', async (req, res) => {
    try {
        await dbManager.connectToNode('node1');
        await dbManager.connectToNode('node2');
        await dbManager.connectToNode('node3');

        const health = {};
        const nodes = ['node1', 'node2', 'node3'];

        for (const node of nodes) {
            try {
                const nodeInfo = await dbManager.getNodeInfo(node);
                health[node] = nodeInfo;
            } catch (error) {
                health[node] = { error: error.message };
            }
        }

        res.json(health);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/test/replication', async (req, res) => {
    try {
        const tester = new ClusterTester();
        await tester.connectToAllNodes();
        await tester.testReplication();

        res.json({ success: true, message: 'Replication test completed' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/test/load-balancing', async (req, res) => {
    try {
        const tester = new ClusterTester();
        await tester.connectToAllNodes();
        await tester.testLoadBalancing();

        res.json({ success: true, message: 'Load balancing test completed' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/test/performance', async (req, res) => {
    try {
        const tester = new ClusterTester();
        await tester.connectToAllNodes();
        await tester.testPerformance();

        res.json({
            success: true,
            message: 'Performance test completed',
            results: tester.testResults.performance
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/test/load', async (req, res) => {
    try {
        const loadTester = new LoadTester();
        await loadTester.connectToCluster();
        await loadTester.testConcurrentWrites();
        await loadTester.testConcurrentReads();
        await loadTester.testMixedLoad();

        res.json({
            success: true,
            message: 'Load tests completed',
            results: loadTester.results
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/cluster/info', async (req, res) => {
    try {
        await dbManager.connectToNode('node1');
        await dbManager.connectToNode('node2');
        await dbManager.connectToNode('node3');

        const info = {};
        const nodes = ['node1', 'node2', 'node3'];

        for (const node of nodes) {
            try {
                const nodeInfo = await dbManager.getNodeInfo(node);
                info[node] = {
                    hostname: nodeInfo.hostname,
                    port: nodeInfo.port,
                    version: nodeInfo.version
                };
            } catch (error) {
                info[node] = { error: error.message };
            }
        }

        res.json(info);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('Error:', error);
    res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Galera Cluster Tester running on http://localhost:${PORT}`);
    console.log(`📊 API endpoints available at http://localhost:${PORT}/api`);
});

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n🔄 Shutting down gracefully...');
    await dbManager.closeAll();
    process.exit(0);
});

module.exports = app; 