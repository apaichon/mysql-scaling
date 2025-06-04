#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== MySQL Replication Monitor ===${NC}"
echo -e "${YELLOW}Press Ctrl+C to stop monitoring${NC}"
echo ""

while true; do
    clear
    echo -e "${BLUE}=== MySQL Replication Status - $(date) ===${NC}"
    echo ""
    
    # Check if containers are running
    echo -e "${YELLOW}Container Status:${NC}"
    docker-compose ps
    echo ""
    
    # Master Status
    echo -e "${YELLOW}Master Status:${NC}"
    if docker exec mysql-master mysqladmin ping -h localhost --silent 2>/dev/null; then
        docker exec mysql-master mysql -uroot -pmasterpassword -e "SHOW MASTER STATUS\G" 2>/dev/null
    else
        echo -e "${RED}Master is not responding${NC}"
    fi
    echo ""
    
    # Slave1 Status
    echo -e "${YELLOW}Slave1 Status:${NC}"
    if docker exec mysql-slave1 mysqladmin ping -h localhost --silent 2>/dev/null; then
        SLAVE1_STATUS=$(docker exec mysql-slave1 mysql -uroot -pslavepassword -e "SHOW SLAVE STATUS\G" 2>/dev/null)
        
        IO_RUNNING=$(echo "$SLAVE1_STATUS" | grep "Slave_IO_Running:" | awk '{print $2}')
        SQL_RUNNING=$(echo "$SLAVE1_STATUS" | grep "Slave_SQL_Running:" | awk '{print $2}')
        SECONDS_BEHIND=$(echo "$SLAVE1_STATUS" | grep "Seconds_Behind_Master:" | awk '{print $2}')
        LAST_ERROR=$(echo "$SLAVE1_STATUS" | grep "Last_Error:" | cut -d: -f2- | xargs)
        
        echo "  IO Running: $IO_RUNNING"
        echo "  SQL Running: $SQL_RUNNING"
        echo "  Seconds Behind Master: $SECONDS_BEHIND"
        if [ -n "$LAST_ERROR" ] && [ "$LAST_ERROR" != "" ]; then
            echo -e "  ${RED}Last Error: $LAST_ERROR${NC}"
        fi
    else
        echo -e "${RED}Slave1 is not responding${NC}"
    fi
    echo ""
    
    # Slave2 Status
    echo -e "${YELLOW}Slave2 Status:${NC}"
    if docker exec mysql-slave2 mysqladmin ping -h localhost --silent 2>/dev/null; then
        SLAVE2_STATUS=$(docker exec mysql-slave2 mysql -uroot -pslavepassword -e "SHOW SLAVE STATUS\G" 2>/dev/null)
        
        IO_RUNNING=$(echo "$SLAVE2_STATUS" | grep "Slave_IO_Running:" | awk '{print $2}')
        SQL_RUNNING=$(echo "$SLAVE2_STATUS" | grep "Slave_SQL_Running:" | awk '{print $2}')
        SECONDS_BEHIND=$(echo "$SLAVE2_STATUS" | grep "Seconds_Behind_Master:" | awk '{print $2}')
        LAST_ERROR=$(echo "$SLAVE2_STATUS" | grep "Last_Error:" | cut -d: -f2- | xargs)
        
        echo "  IO Running: $IO_RUNNING"
        echo "  SQL Running: $SQL_RUNNING"
        echo "  Seconds Behind Master: $SECONDS_BEHIND"
        if [ -n "$LAST_ERROR" ] && [ "$LAST_ERROR" != "" ]; then
            echo -e "  ${RED}Last Error: $LAST_ERROR${NC}"
        fi
    else
        echo -e "${RED}Slave2 is not responding${NC}"
    fi
    echo ""
    
    # Data consistency check
    echo -e "${YELLOW}Data Consistency Check:${NC}"
    if docker exec mysql-master mysqladmin ping -h localhost --silent 2>/dev/null; then
        MASTER_COUNT=$(docker exec mysql-master mysql -uroot -pmasterpassword -e "USE testdb; SELECT COUNT(*) FROM users;" 2>/dev/null | tail -n 1)
        echo "  Master users count: $MASTER_COUNT"
        
        if docker exec mysql-slave1 mysqladmin ping -h localhost --silent 2>/dev/null; then
            SLAVE1_COUNT=$(docker exec mysql-slave1 mysql -uroot -pslavepassword -e "USE testdb; SELECT COUNT(*) FROM users;" 2>/dev/null | tail -n 1)
            echo "  Slave1 users count: $SLAVE1_COUNT"
            if [ "$MASTER_COUNT" = "$SLAVE1_COUNT" ]; then
                echo -e "  ${GREEN}✓ Slave1 is in sync${NC}"
            else
                echo -e "  ${RED}✗ Slave1 is out of sync${NC}"
            fi
        fi
        
        if docker exec mysql-slave2 mysqladmin ping -h localhost --silent 2>/dev/null; then
            SLAVE2_COUNT=$(docker exec mysql-slave2 mysql -uroot -pslavepassword -e "USE testdb; SELECT COUNT(*) FROM users;" 2>/dev/null | tail -n 1)
            echo "  Slave2 users count: $SLAVE2_COUNT"
            if [ "$MASTER_COUNT" = "$SLAVE2_COUNT" ]; then
                echo -e "  ${GREEN}✓ Slave2 is in sync${NC}"
            else
                echo -e "  ${RED}✗ Slave2 is out of sync${NC}"
            fi
        fi
    fi
    
    echo ""
    echo -e "${BLUE}Refreshing in 5 seconds... (Ctrl+C to stop)${NC}"
    sleep 5
done 