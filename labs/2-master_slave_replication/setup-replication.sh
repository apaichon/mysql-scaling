#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== MySQL Master-Slave Replication Setup ===${NC}"

# Function to wait for MySQL to be ready
wait_for_mysql() {
    local container=$1
    local max_attempts=30
    local attempt=1
    
    echo -e "${YELLOW}Waiting for $container to be ready...${NC}"
    
    while [ $attempt -le $max_attempts ]; do
        if docker exec $container mysqladmin ping -h localhost --silent; then
            echo -e "${GREEN}$container is ready!${NC}"
            return 0
        fi
        echo -e "${YELLOW}Attempt $attempt/$max_attempts: $container not ready yet...${NC}"
        sleep 2
        ((attempt++))
    done
    
    echo -e "${RED}$container failed to start within expected time${NC}"
    return 1
}

# Function to fix authentication issues
fix_authentication() {
    echo -e "${BLUE}Fixing authentication issues...${NC}"
    
    # Fix replicator user on master
    echo -e "${YELLOW}Fixing replicator user on master...${NC}"
    docker exec mysql-master mysql -uroot -pmasterpassword -e "
ALTER USER 'replicator'@'%' IDENTIFIED WITH mysql_native_password BY 'replicatorpassword';
FLUSH PRIVILEGES;
"
    
    # Verify the fix
    AUTH_CHECK=$(docker exec mysql-master mysql -uroot -pmasterpassword -e "SELECT plugin FROM mysql.user WHERE user='replicator';" 2>/dev/null | grep mysql_native_password)
    if [ -n "$AUTH_CHECK" ]; then
        echo -e "${GREEN}Authentication fixed successfully${NC}"
        return 0
    else
        echo -e "${RED}Authentication fix failed${NC}"
        return 1
    fi
}

# Clean up any existing containers and volumes
echo -e "${BLUE}Cleaning up existing containers...${NC}"
docker-compose down -v
docker system prune -f

# Start the containers
echo -e "${BLUE}Starting Docker containers...${NC}"
docker-compose up -d

# Wait for all MySQL containers to be ready
wait_for_mysql "mysql-master"
wait_for_mysql "mysql-slave1"
wait_for_mysql "mysql-slave2"

# Additional wait to ensure initialization scripts have run
echo -e "${YELLOW}Waiting for initialization scripts to complete...${NC}"
sleep 15

# Verify master has the database and data
echo -e "${BLUE}Verifying master database...${NC}"
MASTER_DB_CHECK=$(docker exec mysql-master mysql -uroot -pmasterpassword -e "SHOW DATABASES;" 2>/dev/null | grep testdb)
if [ -z "$MASTER_DB_CHECK" ]; then
    echo -e "${RED}Master database 'testdb' not found. Please check the initialization scripts.${NC}"
    exit 1
fi

echo -e "${GREEN}Master database 'testdb' exists${NC}"

# Fix authentication issues
fix_authentication

# Set up slave1 with proper authentication
echo -e "${BLUE}Setting up slave1...${NC}"
docker exec mysql-slave1 mysql -uroot -pslavepassword -e "
ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY 'slavepassword';
CREATE DATABASE IF NOT EXISTS testdb;
CREATE USER IF NOT EXISTS 'replicator'@'%' IDENTIFIED WITH mysql_native_password BY 'replicatorpassword';
GRANT REPLICATION SLAVE ON *.* TO 'replicator'@'%';
CREATE USER IF NOT EXISTS 'appuser'@'%' IDENTIFIED WITH mysql_native_password BY 'apppassword';
GRANT SELECT, INSERT, UPDATE, DELETE ON testdb.* TO 'appuser'@'%';
FLUSH PRIVILEGES;
"

# Set up slave2 with proper authentication
echo -e "${BLUE}Setting up slave2...${NC}"
docker exec mysql-slave2 mysql -uroot -pslavepassword -e "
ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY 'slavepassword';
CREATE DATABASE IF NOT EXISTS testdb;
CREATE USER IF NOT EXISTS 'replicator'@'%' IDENTIFIED WITH mysql_native_password BY 'replicatorpassword';
GRANT REPLICATION SLAVE ON *.* TO 'replicator'@'%';
CREATE USER IF NOT EXISTS 'appuser'@'%' IDENTIFIED WITH mysql_native_password BY 'apppassword';
GRANT SELECT, INSERT, UPDATE, DELETE ON testdb.* TO 'appuser'@'%';
FLUSH PRIVILEGES;
"

# Copy database structure and data from master to slaves (without GTID)
echo -e "${BLUE}Copying database structure from master to slave1...${NC}"
docker exec mysql-master mysqldump -uroot -pmasterpassword --no-tablespaces --single-transaction --routines --triggers --set-gtid-purged=OFF testdb | docker exec -i mysql-slave1 mysql -uroot -pslavepassword testdb

echo -e "${BLUE}Copying database structure from master to slave2...${NC}"
docker exec mysql-master mysqldump -uroot -pmasterpassword --no-tablespaces --single-transaction --routines --triggers --set-gtid-purged=OFF testdb | docker exec -i mysql-slave2 mysql -uroot -pslavepassword testdb

# Enable read-only on slaves
echo -e "${BLUE}Enabling read-only mode on slaves...${NC}"
docker exec mysql-slave1 mysql -uroot -pslavepassword -e "
SET GLOBAL read_only = 1;
SET GLOBAL super_read_only = 1;
"
docker exec mysql-slave2 mysql -uroot -pslavepassword -e "
SET GLOBAL read_only = 1;
SET GLOBAL super_read_only = 1;
"

# Get master status
echo -e "${BLUE}Getting master status...${NC}"
MASTER_STATUS=$(docker exec mysql-master mysql -uroot -pmasterpassword -e "SHOW MASTER STATUS\G")
echo "$MASTER_STATUS"

# Extract log file and position using more robust parsing
LOG_FILE=$(echo "$MASTER_STATUS" | grep "File:" | awk '{print $2}')
LOG_POS=$(echo "$MASTER_STATUS" | grep "Position:" | awk '{print $2}')

echo -e "${GREEN}Master Log File: $LOG_FILE${NC}"
echo -e "${GREEN}Master Log Position: $LOG_POS${NC}"

if [ -z "$LOG_FILE" ] || [ -z "$LOG_POS" ]; then
    echo -e "${RED}Failed to get master status. Please check the master container.${NC}"
    exit 1
fi

# Configure slave1
echo -e "${BLUE}Configuring slave1...${NC}"
docker exec mysql-slave1 mysql -uroot -pslavepassword -e "
STOP SLAVE;
RESET SLAVE ALL;
CHANGE MASTER TO
    MASTER_HOST='mysql-master',
    MASTER_USER='replicator',
    MASTER_PASSWORD='replicatorpassword',
    MASTER_LOG_FILE='$LOG_FILE',
    MASTER_LOG_POS=$LOG_POS;
START SLAVE;
"

# Configure slave2
echo -e "${BLUE}Configuring slave2...${NC}"
docker exec mysql-slave2 mysql -uroot -pslavepassword -e "
STOP SLAVE;
RESET SLAVE ALL;
CHANGE MASTER TO
    MASTER_HOST='mysql-master',
    MASTER_USER='replicator',
    MASTER_PASSWORD='replicatorpassword',
    MASTER_LOG_FILE='$LOG_FILE',
    MASTER_LOG_POS=$LOG_POS;
START SLAVE;
"

# Wait a moment for replication to start
sleep 5

# Check slave status
echo -e "${BLUE}Checking slave1 status...${NC}"
docker exec mysql-slave1 mysql -uroot -pslavepassword -e "SHOW SLAVE STATUS\G" | grep -E "(Slave_IO_Running|Slave_SQL_Running|Last_Error|Last_IO_Error)"

echo -e "${BLUE}Checking slave2 status...${NC}"
docker exec mysql-slave2 mysql -uroot -pslavepassword -e "SHOW SLAVE STATUS\G" | grep -E "(Slave_IO_Running|Slave_SQL_Running|Last_Error|Last_IO_Error)"

# Verify data is present on all nodes
echo -e "${BLUE}Verifying data on all nodes...${NC}"
echo -e "${YELLOW}Master users count:${NC}"
docker exec mysql-master mysql -uroot -pmasterpassword -e "USE testdb; SELECT COUNT(*) as user_count FROM users;"

echo -e "${YELLOW}Slave1 users count:${NC}"
docker exec mysql-slave1 mysql -uroot -pslavepassword -e "USE testdb; SELECT COUNT(*) as user_count FROM users;"

echo -e "${YELLOW}Slave2 users count:${NC}"
docker exec mysql-slave2 mysql -uroot -pslavepassword -e "USE testdb; SELECT COUNT(*) as user_count FROM users;"

# Test replication by inserting data on master
echo -e "${BLUE}Testing replication with a new user...${NC}"
docker exec mysql-master mysql -uroot -pmasterpassword -e "
USE testdb;
INSERT INTO users (username, email, first_name, last_name) 
VALUES ('setup_test_$(date +%s)', 'setup_test@replication.com', 'Setup', 'Test');
"

# Wait for replication
sleep 3

# Check if the new user appears on slaves
echo -e "${YELLOW}Checking if new user appears on slaves...${NC}"
echo -e "${YELLOW}Slave1:${NC}"
docker exec mysql-slave1 mysql -uroot -pslavepassword -e "USE testdb; SELECT username, email FROM users WHERE email = 'setup_test@replication.com';"

echo -e "${YELLOW}Slave2:${NC}"
docker exec mysql-slave2 mysql -uroot -pslavepassword -e "USE testdb; SELECT username, email FROM users WHERE email = 'setup_test@replication.com';"

echo -e "${GREEN}=== Replication setup complete! ===${NC}"
echo -e "${YELLOW}Master: localhost:3306${NC}"
echo -e "${YELLOW}Slave1: localhost:3307${NC}"
echo -e "${YELLOW}Slave2: localhost:3308${NC}"
echo -e "${YELLOW}phpMyAdmin: http://localhost:8888${NC}"
echo ""
echo -e "${BLUE}To test replication, run: ./test-replication.sh${NC}"
echo -e "${BLUE}To fix replication issues, run: ./fix-replication.sh${NC}"
echo -e "${BLUE}To test the Node.js API, run: cd app && npm start${NC}" 