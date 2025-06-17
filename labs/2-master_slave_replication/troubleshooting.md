# MySQL Master-Slave Replication Troubleshooting Guide

This guide helps you diagnose and resolve common issues with the MySQL Master-Slave replication lab.

## 🚨 Common Issues and Solutions

### 1. Authentication Plugin Issues

#### Problem: "Authentication plugin 'caching_sha2_password' reported error: Authentication requires secure connection"
```
Last_IO_Error: Error connecting to source 'replicator@mysql-master:3306'. 
Message: Authentication plugin 'caching_sha2_password' reported error: Authentication requires secure connection.
```

#### Solution:
```bash
# Fix the replicator user authentication
docker exec mysql-master mysql -uroot -pmasterpassword -e "
ALTER USER 'replicator'@'%' IDENTIFIED WITH mysql_native_password BY 'replicatorpassword';
FLUSH PRIVILEGES;
"

# Restart replication on slaves
docker exec mysql-slave1 mysql -uroot -pslavepassword -e "STOP SLAVE; START SLAVE;"
docker exec mysql-slave2 mysql -uroot -pslavepassword -e "STOP SLAVE; START SLAVE;"
```

#### Prevention:
- Use `--default-authentication-plugin=mysql_native_password` in Docker Compose
- Ensure all users are created with `mysql_native_password`

### 2. Slave_IO_Running: Connecting

#### Problem: Slave IO thread stuck in "Connecting" state
```
Slave_IO_Running: Connecting
Slave_SQL_Running: Yes
```

#### Solution:
```bash
# Check if master is accessible from slave
docker exec mysql-slave1 mysql -ureplicator -preplicatorpassword -h mysql-master -e "SELECT 1;"

# Check master status
docker exec mysql-master mysql -uroot -pmasterpassword -e "SHOW MASTER STATUS;"

# Restart slave with correct log file and position
docker exec mysql-slave1 mysql -uroot -pslavepassword -e "
STOP SLAVE;
CHANGE MASTER TO
    MASTER_LOG_FILE='mysql-bin.000001',
    MASTER_LOG_POS=154;
START SLAVE;
"
```

### 3. Slave_SQL_Running: No

#### Problem: Slave SQL thread stopped
```
Slave_SQL_Running: No
Last_Error: Error 'Duplicate entry' for key 'PRIMARY'
```

#### Solution:
```bash
# Skip the problematic transaction
docker exec mysql-slave1 mysql -uroot -pslavepassword -e "
SET GLOBAL sql_slave_skip_counter = 1;
START SLAVE SQL_THREAD;
"

# Or skip specific error types
docker exec mysql-slave1 mysql -uroot -pslavepassword -e "
STOP SLAVE;
SET GLOBAL slave_skip_errors = '1062,1053';
START SLAVE;
"
```

### 4. GTID Issues

#### Problem: GTID-related errors during replication
```
Last_Error: Error 'Found a row that has a different value in a column with a NOT NULL constraint'
```

#### Solution:
```bash
# Disable GTID for traditional replication
# Add to my.cnf:
# gtid-mode = OFF

# Or reset GTID state
docker exec mysql-slave1 mysql -uroot -pslavepassword -e "
RESET MASTER;
STOP SLAVE;
RESET SLAVE ALL;
"
```

### 5. Network Connectivity Issues

#### Problem: Slaves cannot connect to master
```
Last_IO_Error: Can't connect to MySQL server on 'mysql-master'
```

#### Solution:
```bash
# Check network connectivity
docker exec mysql-slave1 ping mysql-master

# Check if master is listening
docker exec mysql-master netstat -tlnp | grep 3306

# Verify Docker network
docker network ls
docker network inspect 2-master_slave_replication_mysql-replication
```

### 6. Permission Issues

#### Problem: Access denied for replication user
```
Last_IO_Error: Access denied for user 'replicator'@'mysql-slave1'
```

#### Solution:
```bash
# Check user permissions on master
docker exec mysql-master mysql -uroot -pmasterpassword -e "
SHOW GRANTS FOR 'replicator'@'%';
"

# Recreate replication user with proper permissions
docker exec mysql-master mysql -uroot -pmasterpassword -e "
DROP USER IF EXISTS 'replicator'@'%';
CREATE USER 'replicator'@'%' IDENTIFIED WITH mysql_native_password BY 'replicatorpassword';
GRANT REPLICATION SLAVE ON *.* TO 'replicator'@'%';
FLUSH PRIVILEGES;
"
```

### 7. Data Inconsistency

#### Problem: Data differs between master and slaves
```
Slave_SQL_Running: No
Last_Error: Error 'Duplicate entry' for key 'users.username'
```

#### Solution:
```bash
# Check data on all nodes
docker exec mysql-master mysql -uroot -pmasterpassword -e "USE testdb; SELECT COUNT(*) FROM users;"
docker exec mysql-slave1 mysql -uroot -pslavepassword -e "USE testdb; SELECT COUNT(*) FROM users;"
docker exec mysql-slave2 mysql -uroot -pslavepassword -e "USE testdb; SELECT COUNT(*) FROM users;"

# Resync data from master
docker exec mysql-master mysqldump -uroot -pmasterpassword --no-tablespaces --single-transaction --set-gtid-purged=OFF testdb | docker exec -i mysql-slave1 mysql -uroot -pslavepassword testdb
```

## 🔧 Diagnostic Commands

### Check Replication Status
```bash
# Overall replication status
docker exec mysql-slave1 mysql -uroot -pslavepassword -e "SHOW SLAVE STATUS\G"
docker exec mysql-slave2 mysql -uroot -pslavepassword -e "SHOW SLAVE STATUS\G"

# Check specific status fields
docker exec mysql-slave1 mysql -uroot -pslavepassword -e "SHOW SLAVE STATUS\G" | grep -E "(Slave_IO_Running|Slave_SQL_Running|Last_Error|Last_IO_Error|Seconds_Behind_Master)"
```

### Check Master Status
```bash
# Master binary log status
docker exec mysql-master mysql -uroot -pmasterpassword -e "SHOW MASTER STATUS\G"

# Binary logs
docker exec mysql-master mysql -uroot -pmasterpassword -e "SHOW BINARY LOGS;"

# Binary log events
docker exec mysql-master mysql -uroot -pmasterpassword -e "SHOW BINLOG EVENTS;"
```

### Check User Authentication
```bash
# Check authentication plugins
docker exec mysql-master mysql -uroot -pmasterpassword -e "SELECT user, host, plugin FROM mysql.user WHERE user='replicator';"

# Test replication user connection
docker exec mysql-slave1 mysql -ureplicator -preplicatorpassword -h mysql-master -e "SELECT 1;"
```

### Check Data Consistency
```bash
# Compare record counts
docker exec mysql-master mysql -uroot -pmasterpassword -e "USE testdb; SELECT COUNT(*) as master_count FROM users;"
docker exec mysql-slave1 mysql -uroot -pslavepassword -e "USE testdb; SELECT COUNT(*) as slave1_count FROM users;"
docker exec mysql-slave2 mysql -uroot -pslavepassword -e "USE testdb; SELECT COUNT(*) as slave2_count FROM users;"

# Check for specific records
docker exec mysql-master mysql -uroot -pmasterpassword -e "USE testdb; SELECT * FROM users ORDER BY id DESC LIMIT 5;"
```

## 🚀 Quick Fix Scripts

### Fix Authentication Issues
```bash
#!/bin/bash
# Fix authentication and restart replication
docker exec mysql-master mysql -uroot -pmasterpassword -e "
ALTER USER 'replicator'@'%' IDENTIFIED WITH mysql_native_password BY 'replicatorpassword';
FLUSH PRIVILEGES;
"

docker exec mysql-slave1 mysql -uroot -pslavepassword -e "STOP SLAVE; START SLAVE;"
docker exec mysql-slave2 mysql -uroot -pslavepassword -e "STOP SLAVE; START SLAVE;"
```

### Reset Replication
```bash
#!/bin/bash
# Complete replication reset
docker exec mysql-slave1 mysql -uroot -pslavepassword -e "
STOP SLAVE;
RESET SLAVE ALL;
"

docker exec mysql-slave2 mysql -uroot -pslavepassword -e "
STOP SLAVE;
RESET SLAVE ALL;
"

# Get master status and reconfigure
MASTER_STATUS=$(docker exec mysql-master mysql -uroot -pmasterpassword -e "SHOW MASTER STATUS\G")
LOG_FILE=$(echo "$MASTER_STATUS" | grep "File:" | awk '{print $2}')
LOG_POS=$(echo "$MASTER_STATUS" | grep "Position:" | awk '{print $2}')

docker exec mysql-slave1 mysql -uroot -pslavepassword -e "
CHANGE MASTER TO
    MASTER_HOST='mysql-master',
    MASTER_USER='replicator',
    MASTER_PASSWORD='replicatorpassword',
    MASTER_LOG_FILE='$LOG_FILE',
    MASTER_LOG_POS=$LOG_POS;
START SLAVE;
"

docker exec mysql-slave2 mysql -uroot -pslavepassword -e "
CHANGE MASTER TO
    MASTER_HOST='mysql-master',
    MASTER_USER='replicator',
    MASTER_PASSWORD='replicatorpassword',
    MASTER_LOG_FILE='$LOG_FILE',
    MASTER_LOG_POS=$LOG_POS;
START SLAVE;
"
```

## 📊 Monitoring Commands

### Check Replication Lag
```bash
# Check seconds behind master
docker exec mysql-slave1 mysql -uroot -pslavepassword -e "SHOW SLAVE STATUS\G" | grep "Seconds_Behind_Master"
docker exec mysql-slave2 mysql -uroot -pslavepassword -e "SHOW SLAVE STATUS\G" | grep "Seconds_Behind_Master"
```

### Monitor Replication Performance
```bash
# Check replication threads
docker exec mysql-master mysql -uroot -pmasterpassword -e "SHOW PROCESSLIST;"
docker exec mysql-slave1 mysql -uroot -pslavepassword -e "SHOW PROCESSLIST;"
```

### Check Error Logs
```bash
# View MySQL error logs
docker logs mysql-master | grep -i error
docker logs mysql-slave1 | grep -i error
docker logs mysql-slave2 | grep -i error
```

## 🆘 Getting Help

If you encounter issues not covered in this guide:

1. **Check the logs**: Use `docker-compose logs` to see detailed error messages
2. **Verify prerequisites**: Ensure Docker has sufficient resources
3. **Restart services**: Use `docker-compose restart` to restart specific services
4. **Check network**: Ensure containers can communicate with each other
5. **Review configuration**: Verify all configuration files are correct

### Common Error Messages

- **"Connection refused"**: Service not started or port not exposed
- **"Access denied"**: Authentication or permission issues
- **"Duplicate entry"**: Data inconsistency between master and slave
- **"GTID" errors**: GTID configuration conflicts
- **"Authentication plugin" errors**: MySQL 8.0 authentication issues

### Emergency Recovery

If all else fails, use the complete reset:
```bash
# Complete reset
docker-compose down -v
docker system prune -f
./setup-replication.sh
```

Remember: The MySQL replication setup is complex and may take several minutes to fully initialize. Be patient and check the logs for progress indicators. 