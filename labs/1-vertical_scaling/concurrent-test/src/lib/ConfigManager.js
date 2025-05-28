const path = require('path');

class ConfigManager {
    constructor(options) {
        this.container = options.container || 'mysql-default';
        this.host = options.host || '127.0.0.1';
        this.port = this.getPortForContainer(options.container, options.port);
        this.user = options.user || 'root';
        this.password = options.password || 'test_password';
        this.database = options.database || 'performance_test';
        this.threads = parseInt(options.threads) || 10;
        this.records = parseInt(options.records) || 10000;
        this.iterations = parseInt(options.iterations) || 3;
        this.outputDir = path.resolve(options.output || './performance_results');
    }

    getPortForContainer(container, providedPort) {
        if (providedPort) return parseInt(providedPort);

        switch (container) {
            case 'mysql-default':
                return 3306;
            case 'mysql-optimized':
                return 3307;
            default:
                return 3306;
        }
    }

    validate() {
        const errors = [];

        if (this.threads < 1 || this.threads > 100) {
            errors.push('Threads must be between 1 and 100');
        }

        if (this.records < 100 || this.records > 10000000) {
            errors.push('Records must be between 100 and 10,000,000');
        }

        if (this.iterations < 1 || this.iterations > 10) {
            errors.push('Iterations must be between 1 and 10');
        }

        return errors;
    }

    toString() {
        return `ConfigManager {
      container: ${this.container}
      host: ${this.host}
      port: ${this.port}
      database: ${this.database}
      threads: ${this.threads}
      records: ${this.records}
      iterations: ${this.iterations}
      outputDir: ${this.outputDir}
    }`;
    }
}

module.exports = ConfigManager; 