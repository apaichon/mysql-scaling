-- Initialize Shard 3 (Users 2001-3000)
USE shard3;
-- Create users table for shard 3
CREATE TABLE IF NOT EXISTS users (
    id INT PRIMARY KEY,
    username VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    shard_id INT DEFAULT 3,
    INDEX idx_username (username),
    INDEX idx_email (email),
    INDEX idx_created_at (created_at)
) ENGINE = InnoDB;
-- Create orders table for shard 3
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
-- Create products table for shard 3
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
-- Create order_items table for shard 3
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
-- Insert sample users for shard 3 (IDs 2001-3000)
INSERT IGNORE INTO users (id, username, email, first_name, last_name)
VALUES (
        2001,
        'user2001',
        'user2001@example.com',
        'Parker',
        'Clark'
    ),
    (
        2002,
        'user2002',
        'user2002@example.com',
        'Reese',
        'Lewis'
    ),
    (
        2003,
        'user2003',
        'user2003@example.com',
        'Blake',
        'Walker'
    ),
    (
        2004,
        'user2004',
        'user2004@example.com',
        'Drew',
        'Hall'
    ),
    (
        2005,
        'user2005',
        'user2005@example.com',
        'Emery',
        'Allen'
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
        'Smartphone',
        'Latest smartphone with advanced features',
        899.99,
        'Electronics',
        60
    ),
    (
        'Tablet',
        '10-inch tablet for productivity',
        299.99,
        'Electronics',
        45
    ),
    (
        'Smartwatch',
        'Fitness tracking smartwatch',
        199.99,
        'Electronics',
        120
    ),
    (
        'Bluetooth Speaker',
        'Portable wireless speaker',
        79.99,
        'Electronics',
        200
    ),
    (
        'Power Bank',
        'High-capacity portable charger',
        49.99,
        'Electronics',
        300
    );
-- Insert sample orders
INSERT IGNORE INTO orders (user_id, order_number, total_amount, status)
VALUES (2001, 'ORD-003-001', 899.99, 'delivered'),
    (2002, 'ORD-003-002', 299.99, 'processing'),
    (2003, 'ORD-003-003', 199.99, 'shipped'),
    (2004, 'ORD-003-004', 79.99, 'pending'),
    (2005, 'ORD-003-005', 49.99, 'delivered');
-- Insert sample order items
INSERT IGNORE INTO order_items (
        order_id,
        product_id,
        quantity,
        unit_price,
        total_price
    )
VALUES (1, 1, 1, 899.99, 899.99),
    (2, 2, 1, 299.99, 299.99),
    (3, 3, 1, 199.99, 199.99),
    (4, 4, 1, 79.99, 79.99),
    (5, 5, 1, 49.99, 49.99);
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
GRANT ALL PRIVILEGES ON shard3.* TO 'shard_user' @'%';
GRANT SELECT ON shard3.* TO 'monitor' @'%';
FLUSH PRIVILEGES;
-- Show initialization complete
SELECT 'Shard 3 initialization completed successfully' as status;