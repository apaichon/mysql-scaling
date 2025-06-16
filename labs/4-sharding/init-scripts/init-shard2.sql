-- Initialize Shard 2 (Users 1001-2000)
USE shard2;
-- Create users table for shard 2
CREATE TABLE IF NOT EXISTS users (
    id INT PRIMARY KEY,
    username VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    shard_id INT DEFAULT 2,
    INDEX idx_username (username),
    INDEX idx_email (email),
    INDEX idx_created_at (created_at)
) ENGINE = InnoDB;
-- Create orders table for shard 2
CREATE TABLE IF NOT EXISTS orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    order_number VARCHAR(50) NOT NULL,
    total_amount DECIMAL(10, 2) NOT NULL,
    status ENUM(
        'pending',
        'processing',
        'shipped',
        'delivered',
        'cancelled'
    ) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_order_number (order_number),
    INDEX idx_status (status),
    INDEX idx_created_at (created_at)
) ENGINE = InnoDB;
-- Create products table for shard 2
CREATE TABLE IF NOT EXISTS products (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10, 2) NOT NULL,
    category VARCHAR(100),
    stock_quantity INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_name (name),
    INDEX idx_category (category),
    INDEX idx_price (price)
) ENGINE = InnoDB;
-- Create order_items table for shard 2
CREATE TABLE IF NOT EXISTS order_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL,
    product_id INT NOT NULL,
    quantity INT NOT NULL,
    unit_price DECIMAL(10, 2) NOT NULL,
    total_price DECIMAL(10, 2) NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    INDEX idx_order_id (order_id),
    INDEX idx_product_id (product_id)
) ENGINE = InnoDB;
-- Insert sample users for shard 2 (IDs 1001-2000)
INSERT IGNORE INTO users (id, username, email, first_name, last_name)
VALUES (
        1001,
        'user1001',
        'user1001@example.com',
        'Sam',
        'Wilson'
    ),
    (
        1002,
        'user1002',
        'user1002@example.com',
        'Pat',
        'Johnson'
    ),
    (
        1003,
        'user1003',
        'user1003@example.com',
        'Chris',
        'Brown'
    ),
    (
        1004,
        'user1004',
        'user1004@example.com',
        'Dana',
        'Davis'
    ),
    (
        1005,
        'user1005',
        'user1005@example.com',
        'Jordan',
        'Miller'
    );
-- Insert sample products
INSERT IGNORE INTO products (
        name,
        description,
        price,
        category,
        stock_quantity
    )
VALUES (
        'Gaming Laptop',
        'High-performance gaming laptop',
        1499.99,
        'Electronics',
        25
    ),
    (
        'Mechanical Keyboard',
        'RGB mechanical gaming keyboard',
        89.99,
        'Electronics',
        100
    ),
    (
        'Gaming Mouse',
        'Precision gaming mouse',
        59.99,
        'Electronics',
        150
    ),
    (
        'Monitor',
        '27-inch 4K gaming monitor',
        399.99,
        'Electronics',
        40
    ),
    (
        'Headset',
        'Wireless gaming headset',
        129.99,
        'Electronics',
        80
    );
-- Insert sample orders
INSERT IGNORE INTO orders (user_id, order_number, total_amount, status)
VALUES (1001, 'ORD-002-001', 1499.99, 'delivered'),
    (1002, 'ORD-002-002', 149.98, 'processing'),
    (1003, 'ORD-002-003', 59.99, 'shipped'),
    (1004, 'ORD-002-004', 399.99, 'pending'),
    (1005, 'ORD-002-005', 129.99, 'delivered');
-- Insert sample order items
INSERT IGNORE INTO order_items (
        order_id,
        product_id,
        quantity,
        unit_price,
        total_price
    )
VALUES (1, 1, 1, 1499.99, 1499.99),
    (2, 2, 1, 89.99, 89.99),
    (2, 3, 1, 59.99, 59.99),
    (3, 3, 1, 59.99, 59.99),
    (4, 4, 1, 399.99, 399.99),
    (5, 5, 1, 129.99, 129.99);
-- Create views for easier querying
CREATE OR REPLACE VIEW user_orders AS
SELECT u.id as user_id,
    u.username,
    u.email,
    o.id as order_id,
    o.order_number,
    o.total_amount,
    o.status,
    o.created_at
FROM users u
    LEFT JOIN orders o ON u.id = o.user_id;
CREATE OR REPLACE VIEW order_details AS
SELECT o.id as order_id,
    o.order_number,
    u.username,
    u.email,
    p.name as product_name,
    oi.quantity,
    oi.unit_price,
    oi.total_price,
    o.total_amount as order_total,
    o.status,
    o.created_at
FROM orders o
    JOIN users u ON o.user_id = u.id
    JOIN order_items oi ON o.id = oi.order_id
    JOIN products p ON oi.product_id = p.id;
-- Create monitor user if it doesn't exist
CREATE USER IF NOT EXISTS 'monitor' @'%' IDENTIFIED BY 'monitor_password';
-- Grant permissions
GRANT ALL PRIVILEGES ON shard2.* TO 'shard_user' @'%';
GRANT SELECT ON shard2.* TO 'monitor' @'%';
FLUSH PRIVILEGES;
-- Show initialization complete
SELECT 'Shard 2 initialization completed successfully' as status;