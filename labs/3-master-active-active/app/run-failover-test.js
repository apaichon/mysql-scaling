#!/usr/bin/env node

const FailoverTester = require('./failover-test');

async function main() {
    console.log('🚀 Starting Failover Test Suite');
    console.log('='.repeat(50));

    const failoverTester = new FailoverTester();

    try {
        await failoverTester.runFailoverTests();
        console.log('\n✅ Failover test suite completed successfully!');
        process.exit(0);
    } catch (error) {
        console.error('\n❌ Failover test suite failed:', error.message);
        console.error('Stack trace:', error.stack);
        process.exit(1);
    }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    process.exit(1);
});

main(); 