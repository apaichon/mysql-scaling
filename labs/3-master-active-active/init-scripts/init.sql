-- Create replication user for Group Replication
CREATE USER IF NOT EXISTS 'repl' @'%' IDENTIFIED BY 'replpass';
GRANT REPLICATION SLAVE,
    REPLICATION CLIENT,
    SUPER ON *.* TO 'repl' @'%';
GRANT BACKUP_ADMIN ON *.* TO 'repl' @'%';
FLUSH PRIVILEGES;
-- Required for Group Replication
SET SQL_LOG_BIN = 0;
CREATE USER IF NOT EXISTS 'mysql_innodb_cluster' @'%' IDENTIFIED BY 'clusterpass';
GRANT ALL PRIVILEGES ON *.* TO 'mysql_innodb_cluster' @'%' WITH
GRANT OPTION;
SET SQL_LOG_BIN = 1;
FLUSH PRIVILEGES;