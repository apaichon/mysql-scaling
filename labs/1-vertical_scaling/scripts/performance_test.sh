#!/bin/bash

# MySQL Performance Testing Suite
# Tests performance before and after configuration changes
# Optimized for MacBook Pro with 16GB RAM
# Modified to work with Docker containers

set -e

# Configuration - Docker-based
MYSQL_CONTAINER_DEFAULT="mysql-default"
MYSQL_CONTAINER_OPTIMIZED="mysql-optimized"
MYSQL_USER="root"
MYSQL_PASSWORD="test_password"
DATABASE_NAME="performance_test"
RESULTS_DIR="./performance_results"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

# Test configuration - Increased to 1 million records
INSERT_RECORDS=1000000
SELECT_SAMPLE_RECORDS=1000000
UPDATE_SAMPLE_RECORDS=100000

# Default to testing the default container, can be overridden
MYSQL_CONTAINER="${MYSQL_CONTAINER:-$MYSQL_CONTAINER_DEFAULT}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Create results directory
mkdir -p "$RESULTS_DIR"

log() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')] $1${NC}"
}

success() {
    echo -e "${GREEN}[SUCCESS] $1${NC}"
}

warning() {
    echo -e "${YELLOW}[WARNING] $1${NC}"
}

error() {
    echo -e "${RED}[ERROR] $1${NC}"
}

# Function to execute MySQL command via Docker
mysql_exec() {
    local container="$1"
    shift
    docker exec -i "$container" mysql -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$@"
}

# Function to execute MySQL admin command via Docker
mysqladmin_exec() {
    local container="$1"
    shift
    docker exec -i "$container" mysqladmin -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$@"
}

# Function to check if MySQL container is running and accessible
check_mysql_connection() {
    log "Checking MySQL connection to container: $MYSQL_CONTAINER..."
    
    # First check if container is running
    if ! docker ps --format "table {{.Names}}" | grep -q "^$MYSQL_CONTAINER$"; then
        error "Container $MYSQL_CONTAINER is not running"
        log "Available containers:"
        docker ps --format "table {{.Names}}\t{{.Status}}"
        return 1
    fi
    
    # Then check MySQL connectivity
    if mysqladmin_exec "$MYSQL_CONTAINER" ping >/dev/null 2>&1; then
        success "MySQL connection successful to container: $MYSQL_CONTAINER"
        return 0
    else
        error "Cannot connect to MySQL in container: $MYSQL_CONTAINER"
        return 1
    fi
}

# Function to get current MySQL configuration
get_mysql_config() {
    local output_file="$1"
    log "Capturing current MySQL configuration from container: $MYSQL_CONTAINER..."
    
    mysql_exec "$MYSQL_CONTAINER" -e "
        SELECT 
            variable_name, 
            variable_value 
        FROM performance_schema.global_variables 
        WHERE variable_name IN (
            'innodb_buffer_pool_size',
            'max_connections',
            'innodb_io_capacity',
            'innodb_flush_log_at_trx_commit',
            'thread_cache_size',
            'table_open_cache',
            'sort_buffer_size',
            'read_buffer_size',
            'join_buffer_size',
            'tmp_table_size',
            'max_heap_table_size',
            'innodb_log_file_size',
            'innodb_log_buffer_size',
            'query_cache_size',
            'key_buffer_size'
        )
        ORDER BY variable_name;
    " > "$output_file"
    
    success "Configuration saved to $output_file"
}

# Function to setup test database and tables
setup_test_database() {
    log "Setting up test database in container: $MYSQL_CONTAINER..."
    log "This will create tables for testing with up to $SELECT_SAMPLE_RECORDS records..."
    
    mysql_exec "$MYSQL_CONTAINER" << EOF
        DROP DATABASE IF EXISTS $DATABASE_NAME;
        CREATE DATABASE $DATABASE_NAME;
        USE $DATABASE_NAME;
        
        -- Test table for INSERT performance
        CREATE TABLE test_insert (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(100),
            email VARCHAR(100),
            age INT,
            city VARCHAR(50),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_name (name),
            INDEX idx_email (email),
            INDEX idx_age (age)
        ) ENGINE=InnoDB;
        
        -- Test table for SELECT performance with existing data
        CREATE TABLE test_select (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT,
            product_id INT,
            quantity INT,
            price DECIMAL(10,2),
            order_date DATE,
            status VARCHAR(20),
            INDEX idx_user_id (user_id),
            INDEX idx_product_id (product_id),
            INDEX idx_order_date (order_date),
            INDEX idx_status (status),
            INDEX idx_composite (user_id, order_date, status)
        ) ENGINE=InnoDB;
        
        -- Create a numbers table to help generate large datasets efficiently
        CREATE TABLE numbers (
            n INT PRIMARY KEY
        ) ENGINE=InnoDB;
        
        -- Populate numbers table (0-9999)
        INSERT INTO numbers (n)
        SELECT a.n + b.n*10 + c.n*100 + d.n*1000
        FROM 
            (SELECT 0 n UNION SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9) a,
            (SELECT 0 n UNION SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9) b,
            (SELECT 0 n UNION SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9) c,
            (SELECT 0 n UNION SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9) d;
EOF
    
    log "Populating test_select table with $SELECT_SAMPLE_RECORDS records (this may take several minutes)..."
    
    # Populate in batches to avoid memory issues
    local batch_size=50000
    local batches=$((SELECT_SAMPLE_RECORDS / batch_size))
    
    for ((i=0; i<batches; i++)); do
        local start_id=$((i * batch_size))
        log "Inserting batch $((i+1))/$batches (records $start_id to $((start_id + batch_size - 1)))..."
        
        mysql_exec "$MYSQL_CONTAINER" "$DATABASE_NAME" << EOF
            INSERT INTO test_select (user_id, product_id, quantity, price, order_date, status)
            SELECT 
                FLOOR(1 + (n1.n + n2.n*10000) * 0.01 * 100000) as user_id,
                FLOOR(1 + (n1.n + n2.n*10000) * 0.001 * 10000) as product_id,
                FLOOR(1 + (n1.n % 10)) as quantity,
                ROUND(10 + (n1.n + n2.n*10000) * 0.1, 2) as price,
                DATE_SUB(CURDATE(), INTERVAL FLOOR((n1.n + n2.n*10000) * 0.001 * 365) DAY) as order_date,
                CASE ((n1.n + n2.n*10000) % 4)
                    WHEN 0 THEN 'pending'
                    WHEN 1 THEN 'processing'
                    WHEN 2 THEN 'shipped'
                    ELSE 'delivered'
                END as status
            FROM 
                numbers n1
                CROSS JOIN (SELECT n FROM numbers WHERE n < $((batch_size / 10000 + 1))) n2
            WHERE (n1.n + n2.n*10000) >= $start_id 
            AND (n1.n + n2.n*10000) < $((start_id + batch_size))
            LIMIT $batch_size;
EOF
    done
    
    mysql_exec "$MYSQL_CONTAINER" "$DATABASE_NAME" << EOF
        -- Test table for UPDATE performance
        CREATE TABLE test_update (
            id INT AUTO_INCREMENT PRIMARY KEY,
            counter INT DEFAULT 0,
            last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            data TEXT,
            INDEX idx_counter (counter)
        ) ENGINE=InnoDB;
        
        -- Populate test_update table with $UPDATE_SAMPLE_RECORDS records
        INSERT INTO test_update (counter, data)
        SELECT 
            FLOOR(n * 0.001 * 1000) as counter,
            CONCAT('test_data_', n, '_', REPEAT('x', n % 100)) as data
        FROM numbers
        WHERE n < $UPDATE_SAMPLE_RECORDS;
        
        -- Clean up helper table
        DROP TABLE numbers;
        
        -- Analyze tables for better query planning
        ANALYZE TABLE test_insert, test_select, test_update;
EOF
    
    success "Test database and tables created successfully with $SELECT_SAMPLE_RECORDS records in test_select"
}

# Function to run INSERT performance test
test_insert_performance() {
    local test_name="$1"
    local result_file="$RESULTS_DIR/insert_test_${test_name}_${TIMESTAMP}.txt"
    
    log "Running INSERT performance test ($test_name) on container: $MYSQL_CONTAINER..."
    log "Inserting $INSERT_RECORDS records (this may take several minutes)..."
    
    # Record start time
    local start_time=$(date +%s.%N)
    
    # Perform INSERT test in batches for better performance
    mysql_exec "$MYSQL_CONTAINER" "$DATABASE_NAME" << EOF > "$result_file" 2>&1
        SET @start_time = NOW(6);
        SET @batch_size = 10000;
        SET @total_records = $INSERT_RECORDS;
        SET @batches = CEIL(@total_records / @batch_size);
        
        -- Create a temporary numbers table for this test
        CREATE TEMPORARY TABLE temp_numbers (n INT PRIMARY KEY);
        INSERT INTO temp_numbers (n)
        SELECT a.n + b.n*10 + c.n*100 + d.n*1000 + e.n*10000 + f.n*100000
        FROM 
            (SELECT 0 n UNION SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9) a,
            (SELECT 0 n UNION SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9) b,
            (SELECT 0 n UNION SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9) c,
            (SELECT 0 n UNION SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9) d,
            (SELECT 0 n UNION SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9) e,
            (SELECT 0 n UNION SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9) f
        WHERE a.n + b.n*10 + c.n*100 + d.n*1000 + e.n*10000 + f.n*100000 < @total_records;
        
        -- Perform the large INSERT
        INSERT INTO test_insert (name, email, age, city)
        SELECT 
            CONCAT('User_', n) as name,
            CONCAT('user_', n, '@example.com') as email,
            18 + (n % 50) as age,
            CASE (n % 5)
                WHEN 0 THEN 'New York'
                WHEN 1 THEN 'Los Angeles'
                WHEN 2 THEN 'Chicago'
                WHEN 3 THEN 'Houston'
                ELSE 'Phoenix'
            END as city
        FROM temp_numbers;
        
        SET @end_time = NOW(6);
        SELECT 
            'INSERT Test Results (1M records)' as test_type,
            @start_time as start_time,
            @end_time as end_time,
            TIMESTAMPDIFF(MICROSECOND, @start_time, @end_time) / 1000000 as duration_seconds,
            @total_records as records_inserted,
            ROUND(@total_records / (TIMESTAMPDIFF(MICROSECOND, @start_time, @end_time) / 1000000), 2) as records_per_second;
            
        -- Show final table size
        SELECT COUNT(*) as total_records_in_table FROM test_insert;
EOF
    
    local end_time=$(date +%s.%N)
    local duration=$(echo "$end_time - $start_time" | bc -l)
    
    echo "Total test duration: ${duration} seconds" >> "$result_file"
    success "INSERT test completed. Results saved to $result_file"
}

# Function to run SELECT performance test
test_select_performance() {
    local test_name="$1"
    local result_file="$RESULTS_DIR/select_test_${test_name}_${TIMESTAMP}.txt"
    
    log "Running SELECT performance test ($test_name) on container: $MYSQL_CONTAINER..."
    log "Testing queries against $SELECT_SAMPLE_RECORDS records..."
    
    mysql_exec "$MYSQL_CONTAINER" "$DATABASE_NAME" << EOF > "$result_file" 2>&1
        -- Test 1: Simple SELECT with WHERE clause on large dataset
        SET @start_time = NOW(6);
        SELECT COUNT(*) FROM test_select WHERE user_id BETWEEN 10000 AND 50000;
        SET @end_time = NOW(6);
        SELECT 'Simple SELECT with WHERE (large dataset)' as test_name,
               TIMESTAMPDIFF(MICROSECOND, @start_time, @end_time) / 1000 as duration_ms;
        
        -- Test 2: Complex SELECT with GROUP BY on large dataset
        SET @start_time = NOW(6);
        SELECT 
            t1.user_id,
            COUNT(*) as order_count,
            AVG(t1.price) as avg_price,
            SUM(t1.quantity) as total_quantity
        FROM test_select t1
        WHERE t1.order_date >= DATE_SUB(CURDATE(), INTERVAL 90 DAY)
        GROUP BY t1.user_id
        HAVING COUNT(*) > 2
        ORDER BY avg_price DESC
        LIMIT 1000;
        SET @end_time = NOW(6);
        SELECT 'Complex SELECT with GROUP BY (large dataset)' as test_name,
               TIMESTAMPDIFF(MICROSECOND, @start_time, @end_time) / 1000 as duration_ms;
        
        -- Test 3: SELECT with multiple conditions and sorting
        SET @start_time = NOW(6);
        SELECT * FROM test_select 
        WHERE status IN ('pending', 'processing') 
        AND price > 100 
        AND order_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
        ORDER BY price DESC, order_date DESC
        LIMIT 5000;
        SET @end_time = NOW(6);
        SELECT 'Multi-condition SELECT with sorting (large dataset)' as test_name,
               TIMESTAMPDIFF(MICROSECOND, @start_time, @end_time) / 1000 as duration_ms;
        
        -- Test 4: Aggregation query on large dataset
        SET @start_time = NOW(6);
        SELECT 
            status,
            COUNT(*) as count,
            AVG(price) as avg_price,
            MIN(price) as min_price,
            MAX(price) as max_price,
            SUM(quantity) as total_quantity
        FROM test_select
        GROUP BY status
        ORDER BY count DESC;
        SET @end_time = NOW(6);
        SELECT 'Aggregation query (large dataset)' as test_name,
               TIMESTAMPDIFF(MICROSECOND, @start_time, @end_time) / 1000 as duration_ms;
        
        -- Test 5: Range query with index
        SET @start_time = NOW(6);
        SELECT COUNT(*) FROM test_select 
        WHERE order_date BETWEEN DATE_SUB(CURDATE(), INTERVAL 180 DAY) AND DATE_SUB(CURDATE(), INTERVAL 90 DAY);
        SET @end_time = NOW(6);
        SELECT 'Date range query (large dataset)' as test_name,
               TIMESTAMPDIFF(MICROSECOND, @start_time, @end_time) / 1000 as duration_ms;
EOF
    
    success "SELECT test completed. Results saved to $result_file"
}

# Function to run UPDATE performance test
test_update_performance() {
    local test_name="$1"
    local result_file="$RESULTS_DIR/update_test_${test_name}_${TIMESTAMP}.txt"
    
    log "Running UPDATE performance test ($test_name) on container: $MYSQL_CONTAINER..."
    log "Testing updates on $UPDATE_SAMPLE_RECORDS records..."
    
    mysql_exec "$MYSQL_CONTAINER" "$DATABASE_NAME" << EOF > "$result_file" 2>&1
        SET @start_time = NOW(6);
        
        -- Update a significant portion of records
        UPDATE test_update 
        SET counter = counter + 1,
            data = CONCAT(data, '_updated_', UNIX_TIMESTAMP())
        WHERE id % 10 = 0
        LIMIT 50000;
        
        SET @end_time = NOW(6);
        SELECT 
            'UPDATE Test Results (large dataset)' as test_type,
            @start_time as start_time,
            @end_time as end_time,
            TIMESTAMPDIFF(MICROSECOND, @start_time, @end_time) / 1000000 as duration_seconds,
            ROW_COUNT() as records_updated,
            ROUND(ROW_COUNT() / (TIMESTAMPDIFF(MICROSECOND, @start_time, @end_time) / 1000000), 2) as records_per_second;
            
        -- Test bulk update performance
        SET @start_time = NOW(6);
        UPDATE test_update 
        SET counter = FLOOR(RAND() * 1000)
        WHERE counter < 100
        LIMIT 25000;
        SET @end_time = NOW(6);
        
        SELECT 
            'Bulk UPDATE Test Results' as test_type,
            @start_time as start_time,
            @end_time as end_time,
            TIMESTAMPDIFF(MICROSECOND, @start_time, @end_time) / 1000000 as duration_seconds,
            ROW_COUNT() as records_updated,
            ROUND(ROW_COUNT() / (TIMESTAMPDIFF(MICROSECOND, @start_time, @end_time) / 1000000), 2) as records_per_second;
EOF
    
    success "UPDATE test completed. Results saved to $result_file"
}

# Function to get system performance metrics
get_system_metrics() {
    local test_name="$1"
    local result_file="$RESULTS_DIR/system_metrics_${test_name}_${TIMESTAMP}.txt"
    
    log "Collecting system metrics ($test_name) from container: $MYSQL_CONTAINER..."
    
    {
        echo "=== System Metrics - $test_name ==="
        echo "Container: $MYSQL_CONTAINER"
        echo "Test Scale: $INSERT_RECORDS INSERT records, $SELECT_SAMPLE_RECORDS SELECT records, $UPDATE_SAMPLE_RECORDS UPDATE records"
        echo "Timestamp: $(date)"
        echo ""
        
        echo "=== MySQL Process Info ==="
        mysql_exec "$MYSQL_CONTAINER" -e "SHOW PROCESSLIST;" 2>/dev/null || echo "Could not get process list"
        echo ""
        
        echo "=== MySQL Status Variables ==="
        mysql_exec "$MYSQL_CONTAINER" -e "
            SHOW STATUS WHERE Variable_name IN (
                'Connections',
                'Queries',
                'Questions',
                'Slow_queries',
                'Threads_connected',
                'Threads_running',
                'Innodb_buffer_pool_reads',
                'Innodb_buffer_pool_read_requests',
                'Innodb_buffer_pool_pages_data',
                'Innodb_buffer_pool_pages_free',
                'Innodb_rows_read',
                'Innodb_rows_inserted',
                'Innodb_rows_updated',
                'Created_tmp_tables',
                'Created_tmp_disk_tables',
                'Handler_read_rnd_next',
                'Select_full_join',
                'Select_range_check'
            );
        " 2>/dev/null || echo "Could not get status variables"
        echo ""
        
        echo "=== Database Size Information ==="
        mysql_exec "$MYSQL_CONTAINER" -e "
            SELECT 
                table_name,
                table_rows,
                ROUND(((data_length + index_length) / 1024 / 1024), 2) AS 'Size (MB)'
            FROM information_schema.tables 
            WHERE table_schema = '$DATABASE_NAME'
            ORDER BY (data_length + index_length) DESC;
        " 2>/dev/null || echo "Could not get table size information"
        echo ""
        
        echo "=== Container Resource Usage ==="
        echo "Docker container stats:"
        docker stats "$MYSQL_CONTAINER" --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}\t{{.NetIO}}\t{{.BlockIO}}" 2>/dev/null || echo "Could not get container stats"
        echo ""
        
        echo "=== Host System Resources ==="
        echo "Memory Usage:"
        if command -v free >/dev/null 2>&1; then
            free -h
        elif command -v vm_stat >/dev/null 2>&1; then
            # macOS
            vm_stat | head -10
        fi
        echo ""
        
        echo "CPU Usage:"
        if command -v top >/dev/null 2>&1; then
            top -l 1 -n 5 | grep "CPU usage" || echo "CPU info not available"
        fi
        echo ""
        
        echo "Disk Usage:"
        df -h | grep -E "(Filesystem|/dev/)" | head -5
        echo ""
        
    } > "$result_file"
    
    success "System metrics saved to $result_file"
}

# Function to run comprehensive performance test
run_performance_test() {
    local test_name="$1"
    
    log "Starting comprehensive performance test: $test_name on container: $MYSQL_CONTAINER"
    log "Test scale: $INSERT_RECORDS INSERT records, $SELECT_SAMPLE_RECORDS SELECT records, $UPDATE_SAMPLE_RECORDS UPDATE records"
    
    # Check MySQL connection
    if ! check_mysql_connection; then
        error "Cannot proceed with tests - MySQL connection failed"
        return 1
    fi
    
    # Get current configuration
    get_mysql_config "$RESULTS_DIR/mysql_config_${test_name}_${TIMESTAMP}.txt"
    
    # Get system metrics before test
    get_system_metrics "${test_name}_before"
    
    # Setup test database
    setup_test_database
    
    # Run performance tests
    test_insert_performance "$test_name"
    test_select_performance "$test_name"
    test_update_performance "$test_name"
    
    # Get system metrics after test
    get_system_metrics "${test_name}_after"
    
    success "Performance test '$test_name' completed on container: $MYSQL_CONTAINER. Results in $RESULTS_DIR"
}

# Function to compare test results
compare_results() {
    local before_dir="$RESULTS_DIR"
    local comparison_file="$RESULTS_DIR/performance_comparison_${TIMESTAMP}.txt"
    
    log "Generating performance comparison report..."
    
    {
        echo "=== MySQL Performance Comparison Report (1M Records Scale) ==="
        echo "Generated: $(date)"
        echo "Test Scale: $INSERT_RECORDS INSERT records, $SELECT_SAMPLE_RECORDS SELECT records, $UPDATE_SAMPLE_RECORDS UPDATE records"
        echo ""
        
        echo "=== Test Files Available ==="
        find "$before_dir" -name "*_before_*" -o -name "*_after_*" | sort
        echo ""
        
        echo "=== Configuration Differences ==="
        echo "Compare the mysql_config_*_before_*.txt and mysql_config_*_after_*.txt files"
        echo ""
        
        echo "=== Performance Summary ==="
        echo "To get detailed comparison:"
        echo "1. Check INSERT test results: compare insert_test_*_before_*.txt vs insert_test_*_after_*.txt"
        echo "2. Check SELECT test results: compare select_test_*_before_*.txt vs select_test_*_after_*.txt"  
        echo "3. Check UPDATE test results: compare update_test_*_before_*.txt vs update_test_*_after_*.txt"
        echo "4. Check system metrics: compare system_metrics_*_before_*.txt vs system_metrics_*_after_*.txt"
        echo ""
        
    } > "$comparison_file"
    
    success "Comparison report saved to $comparison_file"
}

# Main execution
main() {
    echo "=== MySQL Performance Testing Suite (Docker Version) ==="
    echo "Optimized for MacBook Pro with 16GB RAM"
    echo "Testing container: $MYSQL_CONTAINER"
    echo "Test scale: $INSERT_RECORDS INSERT records, $SELECT_SAMPLE_RECORDS SELECT records, $UPDATE_SAMPLE_RECORDS UPDATE records"
    echo ""
    
    case "${1:-help}" in
        "before")
            log "Running BEFORE optimization tests..."
            run_performance_test "before"
            ;;
        "after")
            log "Running AFTER optimization tests..."
            run_performance_test "after"
            ;;
        "compare")
            compare_results
            ;;
        "both")
            log "Running both BEFORE and AFTER tests..."
            run_performance_test "before"
            warning "Please apply your MySQL configuration changes now, then press Enter to continue..."
            read -r
            run_performance_test "after"
            compare_results
            ;;
        "default")
            export MYSQL_CONTAINER="$MYSQL_CONTAINER_DEFAULT"
            log "Testing default MySQL container..."
            run_performance_test "default"
            ;;
        "optimized")
            export MYSQL_CONTAINER="$MYSQL_CONTAINER_OPTIMIZED"
            log "Testing optimized MySQL container..."
            run_performance_test "optimized"
            ;;
        "compare-containers")
            log "Comparing default vs optimized containers..."
            export MYSQL_CONTAINER="$MYSQL_CONTAINER_DEFAULT"
            run_performance_test "default"
            export MYSQL_CONTAINER="$MYSQL_CONTAINER_OPTIMIZED"
            run_performance_test "optimized"
            compare_results
            ;;
        "help"|*)
            echo "Usage: $0 [before|after|compare|both|default|optimized|compare-containers]"
            echo ""
            echo "Commands:"
            echo "  before             - Run performance tests with current configuration"
            echo "  after              - Run performance tests after configuration changes"
            echo "  compare            - Generate comparison report"
            echo "  both               - Run before tests, pause for config changes, then after tests"
            echo "  default            - Test the default MySQL container (mysql-default)"
            echo "  optimized          - Test the optimized MySQL container (mysql-optimized)"
            echo "  compare-containers - Compare default vs optimized containers"
            echo ""
            echo "Environment Variables:"
            echo "  MYSQL_CONTAINER    - Override default container name (default: mysql-default)"
            echo ""
            echo "Example workflows:"
            echo "  1. $0 default                # Test default container"
            echo "  2. $0 optimized              # Test optimized container"
            echo "  3. $0 compare-containers     # Compare both containers"
            echo "  4. MYSQL_CONTAINER=mysql-optimized $0 before  # Test specific container"
            echo ""
            echo "Note: Tests now use 1M records for more comprehensive performance analysis"
            echo ""
            ;;
    esac
}

# Run main function with all arguments
main "$@"