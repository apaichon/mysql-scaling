#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Testing MySQL Master-Slave Replication ===${NC}"

# Function to execute SQL and show results
execute_sql() {
    local container=$1
    local password=$2
    local sql=$3
    local description=$4
    
    echo -e "${YELLOW}$description${NC}"
    if [ -z "$password" ]; then
        docker exec $container mysql -uroot -e "$sql"
    else
        docker exec $container mysql -uroot -p$password -e "$sql"
    fi
    echo ""
}

# Test 1: Insert new user on master
echo -e "${BLUE}Test 1: Inserting new user on master...${NC}"
NEW_USER_SQL="USE testdb; INSERT INTO users (username, email, first_name, last_name) VALUES ('test_user', 'test@example.com', 'Test', 'User');"
execute_sql "mysql-master" "masterpassword" "$NEW_USER_SQL" "Inserting on Master:"

# Wait for replication
sleep 2

# Check if the user appears on slaves
echo -e "${BLUE}Checking if user appears on slaves...${NC}"
CHECK_USER_SQL="USE testdb; SELECT * FROM users WHERE username = 'test_user';"

execute_sql "mysql-slave1" "" "$CHECK_USER_SQL" "Checking Slave1:"
execute_sql "mysql-slave2" "" "$CHECK_USER_SQL" "Checking Slave2:"

# Test 2: Insert new product on master
echo -e "${BLUE}Test 2: Inserting new product on master...${NC}"
NEW_PRODUCT_SQL="USE testdb; INSERT INTO products (name, description, price, stock_quantity, category) VALUES ('Test Product', 'A product for testing replication', 99.99, 10, 'Test');"
execute_sql "mysql-master" "masterpassword" "$NEW_PRODUCT_SQL" "Inserting Product on Master:"

# Wait for replication
sleep 2

# Check if the product appears on slaves
echo -e "${BLUE}Checking if product appears on slaves...${NC}"
CHECK_PRODUCT_SQL="USE testdb; SELECT * FROM products WHERE name = 'Test Product';"

execute_sql "mysql-slave1" "" "$CHECK_PRODUCT_SQL" "Checking Slave1:"
execute_sql "mysql-slave2" "" "$CHECK_PRODUCT_SQL" "Checking Slave2:"

# Test 3: Update existing data on master
echo -e "${BLUE}Test 3: Updating existing data on master...${NC}"
UPDATE_SQL="USE testdb; UPDATE products SET price = 89.99 WHERE name = 'Test Product';"
execute_sql "mysql-master" "masterpassword" "$UPDATE_SQL" "Updating Product Price on Master:"

# Wait for replication
sleep 2

# Check if the update appears on slaves
echo -e "${BLUE}Checking if update appears on slaves...${NC}"
CHECK_UPDATE_SQL="USE testdb; SELECT name, price FROM products WHERE name = 'Test Product';"

execute_sql "mysql-slave1" "" "$CHECK_UPDATE_SQL" "Checking Updated Price on Slave1:"
execute_sql "mysql-slave2" "" "$CHECK_UPDATE_SQL" "Checking Updated Price on Slave2:"

# Test 4: Check replication status
echo -e "${BLUE}Test 4: Checking replication status...${NC}"

echo -e "${YELLOW}Master Status:${NC}"
docker exec mysql-master mysql -uroot -pmasterpassword -e "SHOW MASTER STATUS\G"

echo -e "${YELLOW}Slave1 Status:${NC}"
docker exec mysql-slave1 mysql -uroot -e "SHOW SLAVE STATUS\G" | grep -E "(Slave_IO_Running|Slave_SQL_Running|Seconds_Behind_Master|Last_Error)"

echo -e "${YELLOW}Slave2 Status:${NC}"
docker exec mysql-slave2 mysql -uroot -e "SHOW SLAVE STATUS\G" | grep -E "(Slave_IO_Running|Slave_SQL_Running|Seconds_Behind_Master|Last_Error)"

# Test 5: Count records to verify consistency
echo -e "${BLUE}Test 5: Verifying data consistency...${NC}"
COUNT_SQL="USE testdb; SELECT 'Users:' as table_name, COUNT(*) as count FROM users UNION ALL SELECT 'Products:', COUNT(*) FROM products UNION ALL SELECT 'Orders:', COUNT(*) FROM orders;"

execute_sql "mysql-master" "masterpassword" "$COUNT_SQL" "Record counts on Master:"
execute_sql "mysql-slave1" "" "$COUNT_SQL" "Record counts on Slave1:"
execute_sql "mysql-slave2" "" "$COUNT_SQL" "Record counts on Slave2:"

echo -e "${GREEN}=== Replication testing complete! ===${NC}"
echo -e "${YELLOW}If all tests show consistent data across master and slaves, replication is working correctly.${NC}" 