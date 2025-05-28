#!/usr/bin/env node

const { Command } = require('commander');
const chalk = require('chalk');
const DatabaseTester = require('./lib/DatabaseTester');
const PerformanceLogger = require('./lib/PerformanceLogger');
const ConfigManager = require('./lib/ConfigManager');

const program = new Command();

program
    .name('mysql-performance-tester')
    .description('Node.js MySQL Performance Testing Suite for MacBook Pro M1')
    .version('1.0.0');

program
    .option('-c, --container <name>', 'MySQL container name', 'mysql-default')
    .option('-h, --host <host>', 'MySQL host', '127.0.0.1')
    .option('-p, --port <port>', 'MySQL port', '3306')
    .option('-u, --user <user>', 'MySQL user', 'root')
    .option('-w, --password <password>', 'MySQL password', 'test_password')
    .option('-d, --database <database>', 'Database name', 'performance_test')
    .option('-t, --threads <number>', 'Number of concurrent threads', '10')
    .option('-r, --records <number>', 'Number of records per operation', '10000')
    .option('-i, --iterations <number>', 'Number of test iterations', '3')
    .option('--compare', 'Compare default vs optimized containers')
    .option('--stress', 'Run stress test')
    .option('--concurrent', 'Run concurrent operations test')
    .option('--output <path>', 'Output directory for results', './performance_results');

program.action(async (options) => {
    console.log(chalk.blue.bold('🚀 MySQL Performance Testing Suite'));
    console.log(chalk.gray('Optimized for MacBook Pro M1 with 16GB RAM\n'));

    try {
        const config = new ConfigManager(options);
        const logger = new PerformanceLogger(config.outputDir);

        if (options.compare) {
            await runComparisonTest(config, logger);
        } else if (options.stress) {
            await runStressTest(config, logger);
        } else if (options.concurrent) {
            await runConcurrentTest(config, logger);
        } else {
            await runStandardTest(config, logger);
        }

        console.log(chalk.green.bold('\n✅ Performance testing completed!'));
        console.log(chalk.gray(`Results saved to: ${config.outputDir}`));

    } catch (error) {
        console.error(chalk.red.bold('❌ Error:'), error.message);
        process.exit(1);
    }
});

async function runStandardTest(config, logger) {
    console.log(chalk.yellow(`📊 Running standard performance test on ${config.container}`));

    const tester = new DatabaseTester(config);
    await tester.connect();

    const results = await tester.runFullTest();
    await logger.saveResults(`standard_${config.container}`, results);

    await tester.disconnect();
}

async function runComparisonTest(config, logger) {
    console.log(chalk.yellow('🔄 Running comparison test: Default vs Optimized'));

    // Test default container
    const defaultConfig = { ...config, container: 'mysql-default', port: 3306 };
    const defaultTester = new DatabaseTester(defaultConfig);
    await defaultTester.connect();
    const defaultResults = await defaultTester.runFullTest();
    await defaultTester.disconnect();

    // Test optimized container
    const optimizedConfig = { ...config, container: 'mysql-optimized', port: 3307 };
    const optimizedTester = new DatabaseTester(optimizedConfig);
    await optimizedTester.connect();
    const optimizedResults = await optimizedTester.runFullTest();
    await optimizedTester.disconnect();

    // Save comparison results
    await logger.saveComparison(defaultResults, optimizedResults);
}

async function runStressTest(config, logger) {
    console.log(chalk.yellow('💪 Running stress test'));

    const StressTester = require('./lib/StressTester');
    const stressTester = new StressTester(config);

    await stressTester.connect();
    const results = await stressTester.runStressTest();
    await logger.saveResults(`stress_${config.container}`, results);
    await stressTester.disconnect();
}

async function runConcurrentTest(config, logger) {
    console.log(chalk.yellow('⚡ Running concurrent operations test'));

    const ConcurrentTester = require('./lib/ConcurrentTester');
    const concurrentTester = new ConcurrentTester(config);

    await concurrentTester.connect();
    const results = await concurrentTester.runConcurrentTest();
    await logger.saveResults(`concurrent_${config.container}`, results);
    await concurrentTester.disconnect();
}

if (require.main === module) {
    program.parse();
}

module.exports = program; 