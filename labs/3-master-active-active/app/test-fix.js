const DatabaseManager = require('./database');

async function testFixedConfiguration() {
    console.log('🧪 Testing Fixed MySQL2 Configuration...\n');

    const dbManager = new DatabaseManager();

    try {
        // Test individual node connections
        console.log('📡 Testing individual node connections...');
        await dbManager.connectToNode('node1');
        await dbManager.connectToNode('node2');
        await dbManager.connectToNode('node3');

        // Test ProxySQL pool creation
        console.log('\n🏊 Testing ProxySQL pool creation...');
        await dbManager.createProxySQLPool();

        // Test simple queries
        console.log('\n🔍 Testing simple queries...');

        // Test on individual nodes
        const node1Result = await dbManager.executeOnNode('node1', 'SELECT 1 as test');
        console.log('✅ Node1 query successful:', node1Result[0]);

        // Test through ProxySQL
        const proxyResult = await dbManager.executeOnProxySQL('SELECT 1 as test');
        console.log('✅ ProxySQL query successful:', proxyResult[0]);

        // Test cluster status
        console.log('\n🏥 Testing cluster status...');
        const clusterStatus = await dbManager.getClusterStatus('node1');
        console.log('✅ Cluster size:', clusterStatus.wsrep_cluster_size);
        console.log('✅ Cluster status:', clusterStatus.wsrep_cluster_status);

        console.log('\n🎉 All tests passed! Configuration is working correctly.');

    } catch (error) {
        console.error('❌ Test failed:', error.message);
    } finally {
        await dbManager.closeAll();
    }
}

// Run the test
testFixedConfiguration().catch(console.error); 