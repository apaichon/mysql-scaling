-- Create replication user for slaves (if not exists)
CREATE USER IF NOT EXISTS 'replicator' @'%' IDENTIFIED WITH mysql_native_password BY 'replicatorpassword';
GRANT REPLICATION SLAVE ON *.* TO 'replicator' @'%';
-- Create a test user for application access
CREATE USER IF NOT EXISTS 'appuser' @'%' IDENTIFIED WITH mysql_native_password BY 'apppassword';
GRANT SELECT,
    INSERT,
    UPDATE,
    DELETE ON testdb.* TO 'appuser' @'%';
-- Also update root user to use mysql_native_password for consistency
ALTER USER 'root' @'localhost' IDENTIFIED WITH mysql_native_password BY 'masterpassword';
-- Flush privileges to ensure changes take effect
FLUSH PRIVILEGES;
-- Show master status for reference
SHOW MASTER STATUS;