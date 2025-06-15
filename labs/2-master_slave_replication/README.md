# MySQL Master-Slave Replication Workshop

This workshop demonstrates how to set up MySQL Master-Slave replication using Docker Compose with 1 master and 2 slave nodes.

## 🎯 Learning Objectives

- Understand MySQL Master-Slave replication concepts
- Set up a multi-node MySQL replication cluster
- Configure binary logging and relay logging
- Test replication functionality
- Monitor replication status and performance

## 📋 Prerequisites

- Docker and Docker Compose installed
- Basic understanding of MySQL
- Terminal/Command line access

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   MySQL Master │    │   MySQL Slave1  │    │   MySQL Slave2  │
│   Port: 3306    │───▶│   Port: 3307    │    │   Port: 3308    │
│   Server ID: 1  │    │   Server ID: 2  │    │   Server ID: 3  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │
         ▼
┌─────────────────┐
│   phpMyAdmin    │
│   Port: 8888    │
└─────────────────┘
```

## 📁 Project Structure

```
2-master_slave_replication/
├── docker-compose.yml          # Main Docker Compose configuration
├── config/
│   ├── master.cnf              # MySQL master configuration
│   └── slave.cnf               # MySQL slave configuration
├── init-scripts/
│   ├── 01-create-replication-user.sql  # Creates replication user
│   └── 02-create-sample-data.sql       # Creates sample tables and data
├── setup-replication.sh        # Automated setup script
├── test-replication.sh         # Test replication functionality
├── cleanup.sh                  # Cleanup script
└── README.md                   # This file
```

## 🚀 Quick Start

### Step 1: Make Scripts Executable

```bash
chmod +x setup-replication.sh test-replication.sh cleanup.sh
```

### Step 2: Start the Replication Cluster

```bash
./setup-replication.sh
```

This script will:
- Start all MySQL containers (master + 2 slaves)
- Wait for containers to be ready
- Configure replication automatically
- Show replication status

### Step 3: Test Replication

```bash
./test-replication.sh
```

This will run comprehensive tests to verify replication is working correctly.

## 📖 Manual Setup (Step by Step)

If you prefer to understand each step, follow this manual process:

### Step 1: Start Containers

```bash
docker-compose up -d
```

### Step 2: Wait for Containers to Initialize

```bash
# Check if containers are running
docker-compose ps

# Wait for MySQL to be ready (may take 1-2 minutes)
docker exec mysql-master mysqladmin ping -h localhost --silent
docker exec mysql-slave1 mysqladmin ping -h localhost --silent
docker exec mysql-slave2 mysqladmin ping -h localhost --silent
```

### Step 3: Get Master Status

```bash
docker exec mysql-master mysql -uroot -pmasterpassword -e "SHOW MASTER STATUS\G"
```

Note the `File` and `Position` values - you'll need these for slave configuration.

### Step 4: Configure Slaves

Replace `<LOG_FILE>` and `<LOG_POSITION>` with values from Step 3:

```bash
# Configure Slave 1
docker exec mysql-slave1 mysql -uroot -pslavepassword -e "
STOP SLAVE;
RESET SLAVE ALL;
CHANGE MASTER TO
    MASTER_HOST='mysql-master',
    MASTER_USER='replicator',
    MASTER_PASSWORD='replicatorpassword',
    MASTER_LOG_FILE='<LOG_FILE>',
    MASTER_LOG_POS=<LOG_POSITION>;
START SLAVE;
"

# Configure Slave 2
docker exec mysql-slave2 mysql -uroot -pslavepassword -e "
STOP SLAVE;
RESET SLAVE ALL;
CHANGE MASTER TO
    MASTER_HOST='mysql-master',
    MASTER_USER='replicator',
    MASTER_PASSWORD='replicatorpassword',
    MASTER_LOG_FILE='<LOG_FILE>',
    MASTER_LOG_POS=<LOG_POSITION>;
START SLAVE;
"
```

### Step 5: Verify Replication Status

```bash
# Check slave status
docker exec mysql-slave1 mysql -uroot -pslavepassword -e "SHOW SLAVE STATUS\G" | grep -E "(Slave_IO_Running|Slave_SQL_Running|Last_Error)"
docker exec mysql-slave2 mysql -uroot -pslavepassword -e "SHOW SLAVE STATUS\G" | grep -E "(Slave_IO_Running|Slave_SQL_Running|Last_Error)"
```

Both `Slave_IO_Running` and `Slave_SQL_Running` should show `Yes`.

## 🧪 Testing Replication

### Test 1: Insert Data on Master

```bash
docker exec mysql-master mysql -uroot -pmasterpassword -e "
USE testdb;
INSERT INTO users (username, email, first_name, last_name) 
VALUES ('new_user', 'new@example.com', 'New', 'User');
"
```

### Test 2: Verify Data on Slaves

```bash
# Check Slave 1
docker exec mysql-slave1 mysql -uroot -pslavepassword -e "
USE testdb;
SELECT * FROM users WHERE username = 'new_user';
"

# Check Slave 2
docker exec mysql-slave2 mysql -uroot -pslavepassword -e "
USE testdb;
SELECT * FROM users WHERE username = 'new_user';
"
```

## 🔍 Monitoring and Troubleshooting

### Check Replication Lag

```bash
docker exec mysql-slave1 mysql -uroot -pslavepassword -e "SHOW SLAVE STATUS\G" | grep "Seconds_Behind_Master"
docker exec mysql-slave2 mysql -uroot -pslavepassword -e "SHOW SLAVE STATUS\G" | grep "Seconds_Behind_Master"
```

### View Binary Logs

```bash
# Show binary logs on master
docker exec mysql-master mysql -uroot -pmasterpassword -e "SHOW BINARY LOGS;"

# Show binary log events
docker exec mysql-master mysql -uroot -pmasterpassword -e "SHOW BINLOG EVENTS;"
```

### Common Issues and Solutions

1. **Slave not connecting to master**
   - Check network connectivity between containers
   - Verify replication user credentials
   - Ensure master binary logging is enabled

2. **Replication lag**
   - Check slave hardware resources
   - Monitor slow queries on slaves
   - Consider parallel replication settings

3. **Slave SQL errors**
   - Check `Last_Error` in `SHOW SLAVE STATUS`
   - Review binary log events
   - Consider using `slave-skip-errors` for non-critical errors

## 🌐 Access Points

- **Master Database**: `localhost:3306`
  - Username: `root`
  - Password: `masterpassword`

- **Slave 1 Database**: `localhost:3307`
  - Username: `root`
  - Password: `slavepassword`

- **Slave 2 Database**: `localhost:3308`
  - Username: `root`
  - Password: `slavepassword`

- **phpMyAdmin**: `http://localhost:8888`
  - Server: `mysql-master`
  - Username: `root`
  - Password: `masterpassword`

- **Application User** (for all databases):
  - Username: `appuser`
  - Password: `apppassword`
  - Database: `testdb`

## 📊 Sample Data

The setup includes sample tables:

- **users**: User information with auto-incrementing IDs
- **products**: Product catalog with pricing
- **orders**: Order records with foreign key relationships

## 🔧 Configuration Details

### Master Configuration (`config/master.cnf`)
- Binary logging enabled
- GTID-based replication
- Row-based binary log format
- Optimized for write performance

### Slave Configuration (`config/slave.cnf`)
- Read-only mode enabled
- Relay logging configured
- Parallel replication workers
- Optimized for read performance

## 🧹 Cleanup

To stop and remove all containers:

```bash
./cleanup.sh
```

This will:
- Stop all containers
- Optionally remove data volumes
- Clean up orphaned containers

## 📚 Key Concepts Learned

1. **Binary Logging**: How MySQL records changes for replication
2. **Relay Logs**: How slaves receive and apply changes from master
3. **GTID**: Global Transaction Identifiers for consistent replication
4. **Read Scaling**: Using read replicas to distribute query load
5. **Replication Monitoring**: Tools and techniques for monitoring replication health

## 🎓 Next Steps

- Experiment with different replication topologies
- Implement read/write splitting in applications
- Explore MySQL Group Replication for high availability
- Learn about MySQL InnoDB Cluster for automatic failover

## 🤝 Contributing

Feel free to submit issues and enhancement requests!

## 📄 License

This workshop is provided for educational purposes. 