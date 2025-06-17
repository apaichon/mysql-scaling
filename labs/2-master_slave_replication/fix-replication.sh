#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== MySQL Master-Slave Replication Fix Script ===${NC}"

# Function to check if containers are running
check_containers() {
    echo -e "${YELLOW}Checking if containers are running...${NC}"
    
    if ! docker ps | grep -q mysql-master; then
        echo -e "${RED}mysql-master container is not running${NC}"
        return 1
    fi
    
    if ! docker ps | grep -q mysql-slave1; then
        echo -e "${RED}mysql-slave1 container is not running${NC}"
        return 1
    fi
    
    if ! docker ps | grep -q mysql-slave2; then
        echo -e "${RED}mysql-slave2 container is not running${NC}"
        return 1
    fi
    
    echo -e "${GREEN}All containers are running${NC}"
    return 0
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
    else
        echo -e "${RED}Authentication fix failed${NC}"
        return 1
    fi
}

# Function to restart replication on slaves
restart_replication() {
    echo -e "${BLUE}Restarting replication on slaves...${NC}"
    
    # Restart slave1
    echo -e "${YELLOW}Restarting replication on slave1...${NC}"
    docker exec mysql-slave1 mysql -uroot -pslavepassword -e "STOP SLAVE; START SLAVE;"
    
    # Restart slave2
    echo -e "${YELLOW}Restarting replication on slave2...${NC}"
    docker exec mysql-slave2 mysql -uroot -pslavepassword -e "STOP SLAVE; START SLAVE;"
    
    # Wait for replication to stabilize
    sleep 5
}

# Function to check replication status
check_replication_status() {
    echo -e "${BLUE}Checking replication status...${NC}"
    
    # Check slave1
    echo -e "${YELLOW}Slave1 Status:${NC}"
    docker exec mysql-slave1 mysql -uroot -pslavepassword -e "SHOW SLAVE STATUS\G" | grep -E "(Slave_IO_Running|Slave_SQL_Running|Last_Error|Last_IO_Error)"
    
    # Check slave2
    echo -e "${YELLOW}Slave2 Status:${NC}"
    docker exec mysql-slave2 mysql -uroot -pslavepassword -e "SHOW SLAVE STATUS\G" | grep -E "(Slave_IO_Running|Slave_SQL_Running|Last_Error|Last_IO_Error)"
}

# Function to test replication
test_replication() {
    echo -e "${BLUE}Testing replication...${NC}"
    
    # Insert test data on master
    echo -e "${YELLOW}Inserting test data on master...${NC}"
    docker exec mysql-master mysql -uroot -pmasterpassword -e "
USE testdb;
INSERT INTO users (username, email, first_name, last_name) 
VALUES ('fix_test_$(date +%s)', 'fix_test@replication.com', 'Fix', 'Test');
"
    
    # Wait for replication
    sleep 3
    
    # Check if data appears on slaves
    echo -e "${YELLOW}Checking data on slave1...${NC}"
    docker exec mysql-slave1 mysql -uroot -pslavepassword -e "
USE testdb;
SELECT username, email FROM users WHERE email = 'fix_test@replication.com';
"
    
    echo -e "${YELLOW}Checking data on slave2...${NC}"
    docker exec mysql-slave2 mysql -uroot -pslavepassword -e "
USE testdb;
SELECT username, email FROM users WHERE email = 'fix_test@replication.com';
"
}

# Function to show connection information
show_connection_info() {
    echo -e "${BLUE}Connection Information:${NC}"
    echo -e "${YELLOW}Master: localhost:3306${NC}"
    echo -e "${YELLOW}Slave1: localhost:3307${NC}"
    echo -e "${YELLOW}Slave2: localhost:3308${NC}"
    echo -e "${YELLOW}phpMyAdmin: http://localhost:8888${NC}"
    echo ""
    echo -e "${GREEN}Master credentials:${NC}"
    echo -e "${WHITE}  Username: root${NC}"
    echo -e "${WHITE}  Password: masterpassword${NC}"
    echo ""
    echo -e "${GREEN}Slave credentials:${NC}"
    echo -e "${WHITE}  Username: root${NC}"
    echo -e "${WHITE}  Password: slavepassword${NC}"
    echo ""
    echo -e "${GREEN}Replication user:${NC}"
    echo -e "${WHITE}  Username: replicator${NC}"
    echo -e "${WHITE}  Password: replicatorpassword${NC}"
}

# Main execution
main() {
    # Check if containers are running
    if ! check_containers; then
        echo -e "${RED}Please start the containers first: docker-compose up -d${NC}"
        exit 1
    fi
    
    # Fix authentication
    if ! fix_authentication; then
        echo -e "${RED}Failed to fix authentication${NC}"
        exit 1
    fi
    
    # Restart replication
    restart_replication
    
    # Check replication status
    check_replication_status
    
    # Test replication
    test_replication
    
    # Show connection information
    show_connection_info
    
    echo -e "${GREEN}=== Replication fix complete! ===${NC}"
}

# Run main function
main 