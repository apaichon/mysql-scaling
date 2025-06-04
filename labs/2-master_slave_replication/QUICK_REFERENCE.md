# MySQL Master-Slave Replication - Quick Reference

## 🚀 Quick Commands

```bash
# Setup everything automatically
./setup-replication.sh

# Test replication
./test-replication.sh

# Monitor replication (real-time)
./monitor-replication.sh

# Cleanup everything
./cleanup.sh
```

## 🔗 Connection Details

| Service | Host | Port | Username | Password |
|---------|------|------|----------|----------|
| Master | localhost | 3306 | root | masterpassword |
| Slave1 | localhost | 3307 | root | slavepassword |
| Slave2 | localhost | 3308 | root | slavepassword |
| phpMyAdmin | localhost | 8888 | root | masterpassword |
| App User | any | any | appuser | apppassword |

## 📊 Key SQL Commands

### Check Master Status
```sql
SHOW MASTER STATUS;
```

### Check Slave Status
```sql
SHOW SLAVE STATUS\G
```

### Start/Stop Replication
```sql
START SLAVE;
STOP SLAVE;
```

### Reset Slave
```sql
STOP SLAVE;
RESET SLAVE ALL;
```

### Configure Slave
```sql
CHANGE MASTER TO
    MASTER_HOST='mysql-master',
    MASTER_USER='replicator',
    MASTER_PASSWORD='replicatorpassword',
    MASTER_LOG_FILE='mysql-bin.000001',
    MASTER_LOG_POS=123;
```

## 🔍 Monitoring Commands

### Check Container Status
```bash
docker-compose ps
```

### Check MySQL Process
```bash
docker exec mysql-master mysqladmin ping
```

### View Logs
```bash
docker-compose logs mysql-master
docker-compose logs mysql-slave1
docker-compose logs mysql-slave2
```

### Check Replication Lag
```bash
docker exec mysql-slave1 mysql -uroot -pslavepassword -e "SHOW SLAVE STATUS\G" | grep "Seconds_Behind_Master"
```

## 🧪 Test Scenarios

### Insert Test Data
```bash
docker exec mysql-master mysql -uroot -pmasterpassword -e "
USE testdb;
INSERT INTO users (username, email, first_name, last_name) 
VALUES ('test$(date +%s)', 'test@example.com', 'Test', 'User');
"
```

### Verify on Slaves
```bash
docker exec mysql-slave1 mysql -uroot -pslavepassword -e "USE testdb; SELECT COUNT(*) FROM users;"
docker exec mysql-slave2 mysql -uroot -pslavepassword -e "USE testdb; SELECT COUNT(*) FROM users;"
```

## 🚨 Troubleshooting

### Common Issues

1. **Slave not connecting**
   - Check network: `docker network ls`
   - Verify credentials
   - Check master binary log position

2. **Replication stopped**
   - Check `SHOW SLAVE STATUS\G` for errors
   - Look at `Last_Error` field
   - Restart slave: `STOP SLAVE; START SLAVE;`

3. **Data inconsistency**
   - Compare record counts
   - Check for duplicate key errors
   - Consider `slave-skip-errors`

### Useful Diagnostic Commands

```bash
# Check binary logs
docker exec mysql-master mysql -uroot -pmasterpassword -e "SHOW BINARY LOGS;"

# Check binary log events
docker exec mysql-master mysql -uroot -pmasterpassword -e "SHOW BINLOG EVENTS;"

# Check processlist
docker exec mysql-master mysql -uroot -pmasterpassword -e "SHOW PROCESSLIST;"

# Check slave threads
docker exec mysql-slave1 mysql -uroot -pslavepassword -e "SHOW PROCESSLIST;" | grep -i slave
```

## 📁 File Structure

```
3-master_slave_replication/
├── docker-compose.yml          # Main configuration
├── setup-replication.sh        # Automated setup
├── test-replication.sh         # Test script
├── monitor-replication.sh      # Real-time monitoring
├── cleanup.sh                  # Cleanup script
├── config/
│   ├── master.cnf              # Master config
│   └── slave.cnf               # Slave config
└── init-scripts/
    ├── 01-create-replication-user.sql
    └── 02-create-sample-data.sql
```

## 🎯 Learning Checkpoints

- [ ] Understand binary logging
- [ ] Configure master-slave replication
- [ ] Monitor replication status
- [ ] Test data consistency
- [ ] Handle replication errors
- [ ] Understand GTID-based replication
- [ ] Monitor replication lag 