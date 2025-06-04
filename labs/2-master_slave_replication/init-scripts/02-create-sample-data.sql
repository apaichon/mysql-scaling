-- Use the test database
USE testdb;
-- Create a sample users table
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(100) NOT NULL UNIQUE,
    first_name VARCHAR(50),
    last_name VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
-- Create a sample products table
CREATE TABLE products (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    price DECIMAL(10, 2) NOT NULL,
    stock_quantity INT DEFAULT 0,
    category VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
-- Create a sample orders table
CREATE TABLE orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
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
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE
    SET NULL
);
-- Insert sample users
INSERT INTO users (username, email, first_name, last_name)
VALUES ('john_doe', 'john@example.com', 'John', 'Doe'),
    (
        'jane_smith',
        'jane@example.com',
        'Jane',
        'Smith'
    ),
    ('bob_wilson', 'bob@example.com', 'Bob', 'Wilson'),
    (
        'alice_brown',
        'alice@example.com',
        'Alice',
        'Brown'
    ),
    (
        'charlie_davis',
        'charlie@example.com',
        'Charlie',
        'Davis'
    );
-- Insert sample products
INSERT INTO products (
        name,
        description,
        price,
        stock_quantity,
        category
    )
VALUES (
        'Laptop Pro',
        'High-performance laptop for professionals',
        1299.99,
        50,
        'Electronics'
    ),
    (
        'Wireless Mouse',
        'Ergonomic wireless mouse with long battery life',
        29.99,
        200,
        'Electronics'
    ),
    (
        'Office Chair',
        'Comfortable ergonomic office chair',
        199.99,
        25,
        'Furniture'
    ),
    (
        'Coffee Mug',
        'Ceramic coffee mug with company logo',
        12.99,
        100,
        'Accessories'
    ),
    (
        'Notebook Set',
        'Set of 3 premium notebooks',
        24.99,
        75,
        'Stationery'
    );
-- Insert sample orders
INSERT INTO orders (user_id, total_amount, status)
VALUES (1, 1329.98, 'delivered'),
    (2, 199.99, 'shipped'),
    (3, 42.98, 'processing'),
    (4, 12.99, 'pending'),
    (5, 224.98, 'delivered');
-- Show the created tables and data
SELECT 'Users Table:' as info;
SELECT *
FROM users;
SELECT 'Products Table:' as info;
SELECT *
FROM products;
SELECT 'Orders Table:' as info;
SELECT *
FROM orders;