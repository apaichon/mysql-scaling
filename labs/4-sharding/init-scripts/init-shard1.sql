-- Initialize Shard 1 (Users 1-1000)
USE shard1;
-- Create users table for shard 1
CREATE TABLE IF NOT EXISTS users (
    id INT PRIMARY KEY,
    username VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    shard_id INT DEFAULT 1,
    INDEX idx_username (username),
    INDEX idx_email (email),
    INDEX idx_created_at (created_at)
) ENGINE = InnoDB;
-- Create orders table for shard 1
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
-- Create products table for shard 1
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
-- Create order_items table for shard 1
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
-- Insert sample users for shard 1 (IDs 1-1000) - using INSERT IGNORE to handle duplicates
INSERT IGNORE INTO users (id, username, email, first_name, last_name)
VALUES (1, 'user1', 'user1@example.com', 'John', 'Doe'),
    (2, 'user2', 'user2@example.com', 'Jane', 'Smith'),
    (
        3,
        'user3',
        'user3@example.com',
        'Bob',
        'Johnson'
    ),
    (
        4,
        'user4',
        'user4@example.com',
        'Alice',
        'Brown'
    ),
    (
        5,
        'user5',
        'user5@example.com',
        'Charlie',
        'Wilson'
    ),
    (
        10,
        'user10',
        'user10@example.com',
        'David',
        'Miller'
    ),
    (
        50,
        'user50',
        'user50@example.com',
        'Emma',
        'Davis'
    ),
    (
        100,
        'user100',
        'user100@example.com',
        'Frank',
        'Garcia'
    ),
    (
        250,
        'user250',
        'user250@example.com',
        'Grace',
        'Martinez'
    ),
    (
        500,
        'user500',
        'user500@example.com',
        'Henry',
        'Anderson'
    ),
    (
        750,
        'user750',
        'user750@example.com',
        'Ivy',
        'Taylor'
    ),
    (
        999,
        'user999',
        'user999@example.com',
        'Jack',
        'Thomas'
    ),
    (
        1000,
        'user1000',
        'user1000@example.com',
        'Kate',
        'Jackson'
    );
-- Insert sample products - using INSERT IGNORE to handle duplicates
INSERT IGNORE INTO products (
        name,
        description,
        price,
        category,
        stock_quantity
    )
VALUES (
        'Laptop Pro',
        'High-performance laptop for professionals',
        1299.99,
        'Electronics',
        50
    ),
    (
        'Wireless Mouse',
        'Ergonomic wireless mouse',
        29.99,
        'Electronics',
        200
    ),
    (
        'Office Chair',
        'Comfortable office chair',
        199.99,
        'Furniture',
        30
    ),
    (
        'Desk Lamp',
        'LED desk lamp with adjustable brightness',
        49.99,
        'Home',
        100
    ),
    (
        'Coffee Mug',
        'Ceramic coffee mug',
        9.99,
        'Home',
        500
    );
-- Insert sample orders - using INSERT IGNORE to handle duplicates
INSERT IGNORE INTO orders (user_id, order_number, total_amount, status)
VALUES (1, 'ORD-001-001', 1299.99, 'delivered'),
    (2, 'ORD-001-002', 59.98, 'processing'),
    (3, 'ORD-001-003', 199.99, 'shipped'),
    (4, 'ORD-001-004', 49.99, 'pending'),
    (5, 'ORD-001-005', 19.98, 'delivered');
-- Insert sample order items - using INSERT IGNORE to handle duplicates
INSERT IGNORE INTO order_items (
        order_id,
        product_id,
        quantity,
        unit_price,
        total_price
    )
VALUES (1, 1, 1, 1299.99, 1299.99),
    (2, 2, 2, 29.99, 59.98),
    (3, 3, 1, 199.99, 199.99),
    (4, 4, 1, 49.99, 49.99),
    (5, 5, 2, 9.99, 19.98);
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
-- Load stored procedures and triggers
-- Grant permissions
GRANT ALL PRIVILEGES ON shard1.* TO 'shard_user' @'%';
GRANT SELECT ON shard1.* TO 'monitor' @'%';
FLUSH PRIVILEGES;
-- Show initialization complete
SELECT 'Shard 1 initialization completed successfully' as status;