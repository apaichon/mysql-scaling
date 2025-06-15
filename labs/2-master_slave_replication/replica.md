# MySQL Replica (Master-Slave Replication) Guide

## Overview

This lab demonstrates MySQL Master-Slave replication using a 1-master, 2-slave architecture. The setup uses Docker containers to simulate a production-like environment where one master database handles all write operations, and two slave databases serve read operations, providing scalability and high availability.

## Architecture

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

## How Replication Works

### 1. Binary Logging (Master)
- The master records all data changes in binary log files (`mysql-bin.*`)
- Uses ROW-based binary log format for better consistency
- GTID (Global Transaction Identifier) enabled for reliable replication
- Only replicates the `testdb` database

### 2. Relay Logging (Slaves)
- Slaves receive binary log events from master via I/O thread
- Events are stored in relay log files (`mysql-relay-bin.*`)
- SQL thread applies these events to the slave database
- Parallel replication workers (4) for better performance

### 3. Data Flow
1. **Write Operation**: Client writes to master
2. **Binary Log**: Master records change in binary log
3. **I/O Thread**: Slave connects to master and downloads binary log events
4. **Relay Log**: Slave stores events in relay log
5. **SQL Thread**: Slave applies events to its database
6. **Read Operations**: Clients can read from any slave

## Data Synchronization

### Initial Setup
The replication setup follows these steps:

1. **Container Startup**: All MySQL containers start with specific configurations
2. **User Creation**: Replication user (`replicator`) created with `REPLICATION SLAVE` privileges
3. **Data Copy**: Master's database structure and data copied to slaves using `mysqldump`
4. **Slave Configuration**: Slaves configured to connect to master with correct log file and position
5. **Replication Start**: Slaves start replicating from the master

### Ongoing Synchronization
- **Real-time**: Changes on master are replicated to slaves within seconds
- **Automatic**: No manual intervention required for normal operations
- **Consistent**: GTID ensures transaction consistency across all nodes

### Configuration Files

#### Master Configuration (`config/master.cnf`)
```ini
[mysqld]
server-id = 1
log-bin = mysql-bin
binlog-format = ROW
binlog-do-db = testdb
gtid-mode = ON
enforce-gtid-consistency = ON
sync_binlog = 1
innodb_flush_log_at_trx_commit = 1
```

#### Slave Configuration (`config/slave.cnf`)
```ini
[mysqld]
server-id = 2
relay-log = mysql-relay-bin
log-slave-updates = 1
read-only = 1
gtid-mode = ON
enforce-gtid-consistency = ON
relay_log_recovery = 1
slave_parallel_workers = 4
slave_parallel_type = LOGICAL_CLOCK
```

## Monitoring Replication

### Key Commands

#### Check Master Status
```bash
docker exec mysql-master mysql -uroot -pmasterpassword -e "SHOW MASTER STATUS\G"
```

#### Check Slave Status
```bash
# Slave 1
docker exec mysql-slave1 mysql -uroot -pslavepassword -e "SHOW SLAVE STATUS\G"

# Slave 2
docker exec mysql-slave2 mysql -uroot -pslavepassword -e "SHOW SLAVE STATUS\G"
```

#### Monitor Replication Lag
```bash
docker exec mysql-slave1 mysql -uroot -pslavepassword -e "SHOW SLAVE STATUS\G" | grep "Seconds_Behind_Master"
```

#### View Binary Logs
```bash
# Show binary logs on master
docker exec mysql-master mysql -uroot -pmasterpassword -e "SHOW BINARY LOGS;"

# Show binary log events
docker exec mysql-master mysql -uroot -pmasterpassword -e "SHOW BINLOG EVENTS;"
```

### Automated Monitoring
Use the provided monitoring script:
```bash
./monitor-replication.sh
```

This script provides real-time monitoring of:
- Container status
- Master status
- Slave status (IO/SQL threads)
- Replication lag
- Data consistency
- Error messages

## Troubleshooting

### Common Issues and Solutions

#### 1. Slave Not Connecting to Master

**Symptoms:**
- `Slave_IO_Running: No`
- Connection errors in slave status

**Solutions:**
```bash
# Check network connectivity
docker exec mysql-slave1 ping mysql-master

# Verify replication user exists on master
docker exec mysql-master mysql -uroot -pmasterpassword -e "SELECT User, Host FROM mysql.user WHERE User='replicator';"

# Check replication user privileges
docker exec mysql-master mysql -uroot -pmasterpassword -e "SHOW GRANTS FOR 'replicator'@'%';"
```

#### 2. Replication Lag

**Symptoms:**
- `Seconds_Behind_Master` > 0
- Slaves falling behind master

**Solutions:**
```bash
# Check slave performance
docker exec mysql-slave1 mysql -uroot -pslavepassword -e "SHOW PROCESSLIST;"

# Increase parallel workers (if needed)
docker exec mysql-slave1 mysql -uroot -pslavepassword -e "SET GLOBAL slave_parallel_workers = 8;"

# Check for slow queries
docker exec mysql-slave1 mysql -uroot -pslavepassword -e "SHOW VARIABLES LIKE 'slow_query_log%';"
```

#### 3. Slave SQL Errors

**Symptoms:**
- `Slave_SQL_Running: No`
- Errors in `Last_Error` field

**Solutions:**
```bash
# View detailed error
docker exec mysql-slave1 mysql -uroot -pslavepassword -e "SHOW SLAVE STATUS\G" | grep -A 10 "Last_Error"

# Skip specific errors (use with caution)
docker exec mysql-slave1 mysql -uroot -pslavepassword -e "SET GLOBAL slave_skip_errors = '1062,1053';"

# Restart slave
docker exec mysql-slave1 mysql -uroot -pslavepassword -e "STOP SLAVE; START SLAVE;"
```

#### 4. Data Inconsistency

**Symptoms:**
- Different record counts between master and slaves
- Missing or duplicate data on slaves

**Solutions:**
```bash
# Check data consistency
docker exec mysql-master mysql -uroot -pmasterpassword -e "USE testdb; SELECT COUNT(*) FROM users;"
docker exec mysql-slave1 mysql -uroot -pslavepassword -e "USE testdb; SELECT COUNT(*) FROM users;"

# Re-sync slave from master
docker exec mysql-master mysqldump -uroot -pmasterpassword --no-tablespaces --single-transaction --routines --triggers testdb | docker exec -i mysql-slave1 mysql -uroot -pslavepassword testdb
```

#### 5. GTID Issues

**Symptoms:**
- GTID-related errors in slave status
- Replication stops due to GTID conflicts

**Solutions:**
```bash
# Check GTID status
docker exec mysql-slave1 mysql -uroot -pslavepassword -e "SHOW VARIABLES LIKE 'gtid_mode';"

# Reset GTID (use with extreme caution)
docker exec mysql-slave1 mysql -uroot -pslavepassword -e "RESET MASTER;"

# Reconfigure slave with GTID
docker exec mysql-slave1 mysql -uroot -pslavepassword -e "
STOP SLAVE;
RESET SLAVE ALL;
CHANGE MASTER TO
    MASTER_HOST='mysql-master',
    MASTER_USER='replicator',
    MASTER_PASSWORD='replicatorpassword',
    MASTER_AUTO_POSITION=1;
START SLAVE;
"
```

### Emergency Recovery

#### Complete Slave Reset
If a slave is completely broken, reset it:

```bash
# Stop slave
docker exec mysql-slave1 mysql -uroot -pslavepassword -e "STOP SLAVE;"

# Reset all slave settings
docker exec mysql-slave1 mysql -uroot -pslavepassword -e "RESET SLAVE ALL;"

# Copy fresh data from master
docker exec mysql-master mysqldump -uroot -pmasterpassword --no-tablespaces --single-transaction --routines --triggers testdb | docker exec -i mysql-slave1 mysql -uroot -pslavepassword testdb

# Get current master position
MASTER_STATUS=$(docker exec mysql-master mysql -uroot -pmasterpassword -e "SHOW MASTER STATUS\G")
LOG_FILE=$(echo "$MASTER_STATUS" | grep "File:" | awk '{print $2}')
LOG_POS=$(echo "$MASTER_STATUS" | grep "Position:" | awk '{print $2}')

# Reconfigure slave
docker exec mysql-slave1 mysql -uroot -pslavepassword -e "
CHANGE MASTER TO
    MASTER_HOST='mysql-master',
    MASTER_USER='replicator',
    MASTER_PASSWORD='replicatorpassword',
    MASTER_LOG_FILE='$LOG_FILE',
    MASTER_LOG_POS=$LOG_POS;
START SLAVE;
"
```

## Best Practices

### 1. Monitoring
- Use automated monitoring scripts
- Set up alerts for replication lag
- Monitor disk space for binary logs
- Check slave performance regularly

### 2. Backup Strategy
- Take regular backups from slaves (to avoid master impact)
- Use point-in-time recovery capabilities
- Test backup restoration procedures

### 3. Performance Optimization
- Use appropriate `innodb_buffer_pool_size`
- Configure parallel replication workers
- Monitor and optimize slow queries
- Use read-only mode on slaves

### 4. Security
- Use dedicated replication users
- Limit replication user privileges
- Monitor access logs
- Keep MySQL versions consistent

## Testing Replication

### Automated Testing
```bash
./test-replication.sh
```

### Manual Testing
```bash
# Insert data on master
docker exec mysql-master mysql -uroot -pmasterpassword -e "
USE testdb;
INSERT INTO users (username, email, first_name, last_name) 
VALUES ('test_user', 'test@example.com', 'Test', 'User');
"

# Verify on slaves
docker exec mysql-slave1 mysql -uroot -pslavepassword -e "USE testdb; SELECT * FROM users WHERE username = 'test_user';"
docker exec mysql-slave2 mysql -uroot -pslavepassword -e "USE testdb; SELECT * FROM users WHERE username = 'test_user';"
```

## Access Information

- **Master**: `localhost:3306` (root/masterpassword)
- **Slave1**: `localhost:3307` (root/slavepassword)
- **Slave2**: `localhost:3308` (root/slavepassword)
- **phpMyAdmin**: `http://localhost:8888`
- **Application User**: `appuser/apppassword` (all databases)

This replication setup provides a solid foundation for understanding MySQL replication concepts and implementing them in production environments.
