Here's a quick guide table format for MySQL performance testing:

## MySQL Performance Testing Quick Guide

### 🐳 Docker Container Management

| Action | Command | Notes |
|--------|---------|-------|
| **Start Default MySQL** | `docker-compose --profile default up -d mysql-default` | Port 3306 |
| **Start Optimized MySQL** | `docker-compose --profile optimized up -d mysql-optimized` | Port 3307 |
| **Check Logs** | `docker-compose logs -f mysql-default` | Wait for "ready for connections" |
| **Stop Default** | `docker-compose --profile default down` | |
| **Stop Optimized** | `docker-compose --profile optimized down` | |

### 🧪 Performance Tests

| Test Type | Command | Description |
|-----------|---------|-------------|
| **Standard Test (Default)** | `node src/index.js --container=mysql-default` | Basic INSERT/SELECT/UPDATE tests |
| **Standard Test (Optimized)** | `node src/index.js --container=mysql-optimized --port=3307` | Same tests on optimized config |
| **Stress Test (Default)** | `node src/index.js --container=mysql-default --stress` | High-volume, transaction stress |
| **Stress Test (Optimized)** | `node src/index.js --container=mysql-optimized --port=3307 --stress` | Stress test on optimized config |
| **Concurrent Test (Default)** | `node src/index.js --container=mysql-default --concurrent` | Multi-threaded operations |
| **Concurrent Test (Optimized)** | `node src/index.js --container=mysql-optimized --port=3307 --concurrent` | Concurrent on optimized config |
| **Auto Comparison** | `node src/index.js --compare` | Automatically tests both containers |

### ⚙️ Test Parameters

| Parameter | Flag | Default | Description |
|-----------|------|---------|-------------|
| **Container** | `--container` | `mysql-default` | MySQL container name |
| **Port** | `--port` | `3306` | MySQL port (3307 for optimized) |
| **Threads** | `--threads` | `10` | Number of concurrent threads |
| **Records** | `--records` | `10000` | Records per operation |
| **Iterations** | `--iterations` | `3` | Number of test iterations |
| **Output** | `--output` | `./performance_results` | Results directory |

### 🚀 Quick Test Commands

| Scenario | Command |
|----------|---------|
| **Quick Default Test** | `node src/index.js` |
| **Quick Optimized Test** | `node src/index.js --container=mysql-optimized --port=3307` |
| **High Load Stress** | `node src/index.js --stress --threads=25 --records=100000` |
| **Heavy Concurrent** | `node src/index.js --concurrent --threads=15 --records=25000` |
| **Full Comparison** | `node src/index.js --compare --threads=20 --records=50000` |

### 📊 Test Workflow

| Step | Default Container | Optimized Container |
|------|------------------|-------------------|
| **1. Start** | `docker-compose --profile default up -d` | `docker-compose --profile optimized up -d` |
| **2. Test** | `node src/index.js --container=mysql-default` | `node src/index.js --container=mysql-optimized --port=3307` |
| **3. Stress** | `node src/index.js --container=mysql-default --stress` | `node src/index.js --container=mysql-optimized --port=3307 --stress` |
| **4. Concurrent** | `node src/index.js --container=mysql-default --concurrent` | `node src/index.js --container=mysql-optimized --port=3307 --concurrent` |
| **5. Stop** | `docker-compose --profile default down` | `docker-compose --profile optimized down` |

### 🎯 One-Liner Commands

```bash
# Complete default test suite
docker-compose --profile default up -d && node src/index.js && node src/index.js --stress && node src/index.js --concurrent && docker-compose --profile default down

# Complete optimized test suite  
docker-compose --profile optimized up -d && node src/index.js --container=mysql-optimized --port=3307 && node src/index.js --container=mysql-optimized --port=3307 --stress && node src/index.js --container=mysql-optimized --port=3307 --concurrent && docker-compose --profile optimized down

# Full comparison (automatic)
node src/index.js --compare --stress && node src/index.js --compare --concurrent
```
