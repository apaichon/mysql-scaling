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

# Start the containers
echo -e "${BLUE}Starting Docker containers...${NC}"
docker-compose up -d

# Wait for all MySQL containers to be ready
wait_for_mysql "mysql-master"
wait_for_mysql "mysql-slave1"
wait_for_mysql "mysql-slave2"

# Additional wait to ensure initialization scripts have run
echo -e "${YELLOW}Waiting for initialization scripts to complete...${NC}"
sleep 10

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
docker exec mysql-slave1 mysql -uroot -pslavepassword -e "SHOW SLAVE STATUS\G" | grep -E "(Slave_IO_Running|Slave_SQL_Running|Last_Error)"

echo -e "${BLUE}Checking slave2 status...${NC}"
docker exec mysql-slave2 mysql -uroot -pslavepassword -e "SHOW SLAVE STATUS\G" | grep -E "(Slave_IO_Running|Slave_SQL_Running|Last_Error)"

echo -e "${GREEN}=== Replication setup complete! ===${NC}"
echo -e "${YELLOW}Master: localhost:3306${NC}"
echo -e "${YELLOW}Slave1: localhost:3307${NC}"
echo -e "${YELLOW}Slave2: localhost:3308${NC}"
echo -e "${YELLOW}phpMyAdmin: http://localhost:8888${NC}"
echo ""
echo -e "${BLUE}To test replication, run: ./test-replication.sh${NC}" 