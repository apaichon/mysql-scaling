-- MySQL Initialization Script for Vertical Scaling
-- File: mysql/init-vertical.sql

-- Create application database and user
CREATE DATABASE IF NOT EXISTS app_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Create application user with proper privileges
CREATE USER IF NOT EXISTS 'app_user'@'%' IDENTIFIED BY 'secure_app_password';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, DROP, INDEX, ALTER ON app_db.* TO 'app_user'@'%';

-- Create monitoring user for performance tracking
CREATE USER IF NOT EXISTS 'monitor'@'%' IDENTIFIED BY 'monitor_password';
GRANT PROCESS, REPLICATION CLIENT, SELECT ON *.* TO 'monitor'@'%';
GRANT SELECT ON performance_schema.* TO 'monitor'@'%';
GRANT SELECT ON information_schema.* TO 'monitor'@'%';

-- Create backup user
CREATE USER IF NOT EXISTS 'backup_user'@'%' IDENTIFIED BY 'backup_password';
GRANT SELECT, LOCK TABLES, SHOW VIEW, EVENT, TRIGGER ON *.* TO 'backup_user'@'%';
GRANT REPLICATION CLIENT ON *.* TO 'backup_user'@'%';

-- Optimize MySQL settings for performance
SET GLOBAL innodb_adaptive_hash_index = 1;
SET GLOBAL innodb_change_buffering = 'all';
SET GLOBAL innodb_flush_neighbors = 0; -- Optimize for SSD
SET GLOBAL innodb_random_read_ahead = 0;
SET GLOBAL innodb_read_ahead_threshold = 0;

-- Performance Schema optimization
UPDATE performance_schema.setup_instruments 
SET ENABLED = 'YES', TIMED = 'YES' 
WHERE NAME LIKE '%statement/%';

UPDATE performance_schema.setup_instruments 
SET ENABLED = 'YES', TIMED = 'YES' 
WHERE NAME LIKE '%stage/%';

UPDATE performance_schema.setup_consumers 
SET ENABLED = 'YES' 
WHERE NAME LIKE '%events_statements_%';

UPDATE performance_schema.setup_consumers 
SET ENABLED = 'YES' 
WHERE NAME LIKE '%events_stages_%';

-- Sample table structure for testing vertical scaling
USE app_db;

CREATE TABLE IF NOT EXISTS users (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(100) NOT NULL UNIQUE,
    first_name VARCHAR(50),
    last_name VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    status ENUM('active', 'inactive', 'suspended') DEFAULT 'active',
    
    INDEX idx_username (username),
    INDEX idx_email (email),
    INDEX idx_status (status),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS user_profiles (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    bio TEXT,
    avatar_url VARCHAR(255),
    website VARCHAR(255),
    location VARCHAR(100),
    birth_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS user_sessions (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    session_token VARCHAR(255) NOT NULL UNIQUE,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_session_token (session_token),
    INDEX idx_expires_at (expires_at),
    INDEX idx_is_active (is_active)
) ENGINE=InnoDB;

-- Create a sample stored procedure for bulk operations
DELIMITER $$

CREATE PROCEDURE IF NOT EXISTS BulkInsertUsers(IN batch_size INT)
BEGIN
    DECLARE i INT DEFAULT 1;
    DECLARE batch_start INT DEFAULT 1;
    
    START TRANSACTION;
    
    WHILE i <= batch_size DO
        INSERT INTO users (username, email, first_name, last_name) 
        VALUES 
            (CONCAT('user_', i), CONCAT('user_', i, '@example.com'), 
             CONCAT('FirstName_', i), CONCAT('LastName_', i));
        
        -- Commit in batches of 1000 for better performance
        IF i % 1000 = 0 THEN
            COMMIT;
            START TRANSACTION;
        END IF;
        
        SET i = i + 1;
    END WHILE;
    
    COMMIT;
END$$

DELIMITER ;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_users_composite ON users(status, created_at);
CREATE INDEX IF NOT EXISTS idx_sessions_user_active ON user_sessions(user_id, is_active, expires_at);

-- Enable event scheduler for maintenance tasks
SET GLOBAL event_scheduler = ON;

-- Create maintenance events
DELIMITER $$

CREATE EVENT IF NOT EXISTS cleanup_expired_sessions
ON SCHEDULE EVERY 1 HOUR
DO
BEGIN
    DELETE FROM user_sessions 
    WHERE expires_at < NOW() 
    AND is_active = FALSE;
END$$

CREATE EVENT IF NOT EXISTS optimize_tables_daily
ON SCHEDULE EVERY 1 DAY
STARTS TIMESTAMP(CURDATE()) + INTERVAL 2 HOUR
DO
BEGIN
    OPTIMIZE TABLE users, user_profiles, user_sessions;
END$$

DELIMITER ;

-- Flush privileges to ensure all changes take effect
FLUSH PRIVILEGES;