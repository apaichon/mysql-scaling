const fs = require('fs').promises;
const path = require('path');
const chalk = require('chalk');
const { table } = require('table');
const moment = require('moment');

class PerformanceLogger {
    constructor(outputDir) {
        this.outputDir = outputDir;
        this.ensureOutputDir();
    }

    async ensureOutputDir() {
        try {
            await fs.mkdir(this.outputDir, { recursive: true });
        } catch (error) {
            console.error(chalk.red('Failed to create output directory:'), error.message);
        }
    }

    async saveResults(testName, results) {
        const timestamp = moment().format('YYYYMMDD_HHmmss');
        const filename = `${testName}_${timestamp}.json`;
        const filepath = path.join(this.outputDir, filename);

        try {
            await fs.writeFile(filepath, JSON.stringify(results, null, 2));
            console.log(chalk.green(`📄 Results saved to: ${filename}`));

            // Also save a human-readable summary
            await this.saveSummary(testName, results, timestamp);

        } catch (error) {
            console.error(chalk.red('Failed to save results:'), error.message);
        }
    }

    async saveSummary(testName, results, timestamp) {
        const summaryFilename = `${testName}_summary_${timestamp}.txt`;
        const summaryPath = path.join(this.outputDir, summaryFilename);

        let summary = `MySQL Performance Test Summary\n`;
        summary += `================================\n`;
        summary += `Test: ${testName}\n`;
        summary += `Container: ${results.container}\n`;
        summary += `Timestamp: ${results.timestamp}\n`;
        summary += `Total Duration: ${(results.total_duration_ms / 1000).toFixed(2)} seconds\n\n`;

        if (results.tests.insert) {
            summary += `INSERT Performance:\n`;
            summary += `- Records: ${results.tests.insert.records}\n`;
            summary += `- Duration: ${results.tests.insert.duration_ms.toFixed(2)} ms\n`;
            summary += `- Records/sec: ${results.tests.insert.records_per_second}\n`;
            summary += `- Avg time per record: ${results.tests.insert.avg_time_per_record_ms} ms\n\n`;
        }

        if (results.tests.select) {
            summary += `SELECT Performance:\n`;
            summary += `- Total Duration: ${results.tests.select.total_duration_ms.toFixed(2)} ms\n`;
            results.tests.select.tests.forEach(test => {
                summary += `- ${test.test_name}: ${test.duration_ms.toFixed(2)} ms (${test.rows_returned} rows)\n`;
            });
            summary += `\n`;
        }

        if (results.tests.update) {
            summary += `UPDATE Performance:\n`;
            summary += `- Records: ${results.tests.update.records}\n`;
            summary += `- Duration: ${results.tests.update.duration_ms.toFixed(2)} ms\n`;
            summary += `- Records/sec: ${results.tests.update.records_per_second}\n`;
            summary += `- Avg time per record: ${results.tests.update.avg_time_per_record_ms} ms\n\n`;
        }

        // Concurrent test results
        if (results.tests.concurrent_insert) {
            summary += `CONCURRENT INSERT Performance:\n`;
            summary += `- Threads: ${results.tests.concurrent_insert.threads}\n`;
            summary += `- Total Records: ${results.tests.concurrent_insert.total_records}\n`;
            summary += `- Records/sec: ${results.tests.concurrent_insert.records_per_second}\n\n`;
        }

        if (results.tests.mixed_workload) {
            summary += `MIXED WORKLOAD Performance:\n`;
            summary += `- Threads: ${results.tests.mixed_workload.threads}\n`;
            summary += `- Total Operations: ${results.tests.mixed_workload.total_operations}\n`;
            summary += `- Operations/sec: ${results.tests.mixed_workload.operations_per_second}\n`;
            summary += `- Breakdown: ${JSON.stringify(results.tests.mixed_workload.operation_breakdown)}\n\n`;
        }

        if (results.metrics) {
            summary += `System Metrics:\n`;
            summary += `- Initial Buffer Pool Reads: ${results.metrics.initial.status.Innodb_buffer_pool_reads || 'N/A'}\n`;
            summary += `- Final Buffer Pool Reads: ${results.metrics.final.status.Innodb_buffer_pool_reads || 'N/A'}\n`;
            summary += `- Buffer Pool Size: ${results.metrics.initial.variables.innodb_buffer_pool_size || 'N/A'}\n`;
            summary += `- Max Connections: ${results.metrics.initial.variables.max_connections || 'N/A'}\n`;
        }

        try {
            await fs.writeFile(summaryPath, summary);
            console.log(chalk.green(`📄 Summary saved to: ${summaryFilename}`));
        } catch (error) {
            console.error(chalk.red('Failed to save summary:'), error.message);
        }
    }

    async saveComparison(defaultResults, optimizedResults) {
        const timestamp = moment().format('YYYYMMDD_HHmmss');
        const filename = `comparison_${timestamp}.json`;
        const filepath = path.join(this.outputDir, filename);

        const comparison = {
            timestamp: moment().format('YYYY-MM-DD HH:mm:ss'),
            default: defaultResults,
            optimized: optimizedResults,
            performance_gains: this.calculatePerformanceGains(defaultResults, optimizedResults)
        };

        try {
            await fs.writeFile(filepath, JSON.stringify(comparison, null, 2));
            console.log(chalk.green(`📄 Comparison saved to: ${filename}`));

            // Create comparison table
            await this.createComparisonTable(comparison, timestamp);

        } catch (error) {
            console.error(chalk.red('Failed to save comparison:'), error.message);
        }
    }

    calculatePerformanceGains(defaultResults, optimizedResults) {
        const gains = {};

        // INSERT comparison
        if (defaultResults.tests.insert && optimizedResults.tests.insert) {
            const defaultRPS = parseFloat(defaultResults.tests.insert.records_per_second);
            const optimizedRPS = parseFloat(optimizedResults.tests.insert.records_per_second);
            gains.insert_improvement = ((optimizedRPS - defaultRPS) / defaultRPS * 100).toFixed(2);
            gains.insert_records_per_second = {
                default: defaultRPS,
                optimized: optimizedRPS
            };
        }

        // UPDATE comparison
        if (defaultResults.tests.update && optimizedResults.tests.update) {
            const defaultRPS = parseFloat(defaultResults.tests.update.records_per_second);
            const optimizedRPS = parseFloat(optimizedResults.tests.update.records_per_second);
            gains.update_improvement = ((optimizedRPS - defaultRPS) / defaultRPS * 100).toFixed(2);
            gains.update_records_per_second = {
                default: defaultRPS,
                optimized: optimizedRPS
            };
        }

        // SELECT comparison
        if (defaultResults.tests.select && optimizedResults.tests.select) {
            const defaultDuration = defaultResults.tests.select.total_duration_ms;
            const optimizedDuration = optimizedResults.tests.select.total_duration_ms;
            gains.select_improvement = ((defaultDuration - optimizedDuration) / defaultDuration * 100).toFixed(2);
            gains.select_duration_ms = {
                default: defaultDuration,
                optimized: optimizedDuration
            };
        }

        // Overall performance score
        const improvements = [
            parseFloat(gains.insert_improvement || 0),
            parseFloat(gains.update_improvement || 0),
            parseFloat(gains.select_improvement || 0)
        ].filter(val => !isNaN(val));

        gains.overall_improvement = improvements.length > 0
            ? (improvements.reduce((a, b) => a + b, 0) / improvements.length).toFixed(2)
            : 'N/A';

        return gains;
    }

    async createComparisonTable(comparison, timestamp) {
        const tableFilename = `comparison_table_${timestamp}.txt`;
        const tablePath = path.join(this.outputDir, tableFilename);

        let tableContent = `MySQL Performance Comparison Table\n`;
        tableContent += `=====================================\n`;
        tableContent += `Generated: ${comparison.timestamp}\n\n`;

        // Performance gains summary
        const gains = comparison.performance_gains;

        const performanceData = [
            ['Metric', 'Default', 'Optimized', 'Improvement'],
            ['INSERT (records/sec)',
                gains.insert_records_per_second?.default || 'N/A',
                gains.insert_records_per_second?.optimized || 'N/A',
                `${gains.insert_improvement || 'N/A'}%`
            ],
            ['UPDATE (records/sec)',
                gains.update_records_per_second?.default || 'N/A',
                gains.update_records_per_second?.optimized || 'N/A',
                `${gains.update_improvement || 'N/A'}%`
            ],
            ['SELECT (duration ms)',
                gains.select_duration_ms?.default || 'N/A',
                gains.select_duration_ms?.optimized || 'N/A',
                `${gains.select_improvement || 'N/A'}%`
            ],
            ['Overall Improvement', '-', '-', `${gains.overall_improvement || 'N/A'}%`]
        ];

        const tableConfig = {
            border: {
                topBody: `─`,
                topJoin: `┬`,
                topLeft: `┌`,
                topRight: `┐`,
                bottomBody: `─`,
                bottomJoin: `┴`,
                bottomLeft: `└`,
                bottomRight: `┘`,
                bodyLeft: `│`,
                bodyRight: `│`,
                bodyJoin: `│`,
                joinBody: `─`,
                joinLeft: `├`,
                joinRight: `┤`,
                joinJoin: `┼`
            }
        };

        tableContent += table(performanceData, tableConfig);
        tableContent += `\n\nDetailed Analysis:\n`;
        tableContent += `==================\n`;

        if (gains.insert_improvement) {
            const improvement = parseFloat(gains.insert_improvement);
            tableContent += `INSERT Performance: ${improvement > 0 ? 'IMPROVED' : 'DEGRADED'} by ${Math.abs(improvement)}%\n`;
        }

        if (gains.update_improvement) {
            const improvement = parseFloat(gains.update_improvement);
            tableContent += `UPDATE Performance: ${improvement > 0 ? 'IMPROVED' : 'DEGRADED'} by ${Math.abs(improvement)}%\n`;
        }

        if (gains.select_improvement) {
            const improvement = parseFloat(gains.select_improvement);
            tableContent += `SELECT Performance: ${improvement > 0 ? 'IMPROVED' : 'DEGRADED'} by ${Math.abs(improvement)}%\n`;
        }

        try {
            await fs.writeFile(tablePath, tableContent);
            console.log(chalk.green(`📊 Comparison table saved to: ${tableFilename}`));
        } catch (error) {
            console.error(chalk.red('Failed to save comparison table:'), error.message);
        }
    }

    displayResults(results) {
        console.log(chalk.blue.bold('\n📊 Performance Test Results'));
        console.log(chalk.gray('================================'));

        if (results.tests.insert) {
            console.log(chalk.yellow(`\n🔄 INSERT Performance:`));
            console.log(`   Records: ${results.tests.insert.records}`);
            console.log(`   Duration: ${results.tests.insert.duration_ms.toFixed(2)} ms`);
            console.log(`   Records/sec: ${chalk.green.bold(results.tests.insert.records_per_second)}`);
        }

        if (results.tests.select) {
            console.log(chalk.yellow(`\n🔍 SELECT Performance:`));
            console.log(`   Total Duration: ${results.tests.select.total_duration_ms.toFixed(2)} ms`);
            results.tests.select.tests.forEach(test => {
                console.log(`   ${test.test_name}: ${chalk.green(test.duration_ms.toFixed(2))} ms`);
            });
        }

        if (results.tests.update) {
            console.log(chalk.yellow(`\n🔄 UPDATE Performance:`));
            console.log(`   Records: ${results.tests.update.records}`);
            console.log(`   Duration: ${results.tests.update.duration_ms.toFixed(2)} ms`);
            console.log(`   Records/sec: ${chalk.green.bold(results.tests.update.records_per_second)}`);
        }

        if (results.tests.concurrent_insert) {
            console.log(chalk.yellow(`\n⚡ CONCURRENT INSERT Performance:`));
            console.log(`   Threads: ${results.tests.concurrent_insert.threads}`);
            console.log(`   Total Records: ${results.tests.concurrent_insert.total_records}`);
            console.log(`   Records/sec: ${chalk.green.bold(results.tests.concurrent_insert.records_per_second)}`);
        }

        if (results.tests.mixed_workload) {
            console.log(chalk.yellow(`\n🔀 MIXED WORKLOAD Performance:`));
            console.log(`   Threads: ${results.tests.mixed_workload.threads}`);
            console.log(`   Total Operations: ${results.tests.mixed_workload.total_operations}`);
            console.log(`   Operations/sec: ${chalk.green.bold(results.tests.mixed_workload.operations_per_second)}`);
        }
    }
}

module.exports = PerformanceLogger; 