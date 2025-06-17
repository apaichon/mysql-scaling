I'll help you fix the ProxySQL connection issue permanently. Let's solve this step by step:

1. First, let's check the current ProxySQL configuration:

Ran tool
Let me check the docker-compose configuration:

Ran tool
I see the issue. Let me fix this step by step:

1. First, let's check if the ProxySQL container is running and accessible:

```bash
docker ps | grep sharding-router
```
2. Let's check the ProxySQL logs to see what's wrong:

```bash
docker logs sharding-router
```
3. I see the issue. The initialization script is not being executed properly. Let's check if the script is mounted correctly:

```bash
docker exec -it sharding-router ls -l /docker-entrypoint-initdb.d/
```
4. Let's manually execute the initialization script:

```bash
docker exec -it sharding-router mysql -h127.0.0.1 -P6032 -uadmin -padmin < init-scripts/init-proxysql.sql
```
Let's try a different approach:

```bash
cat init-scripts/init-proxysql.sql | docker exec -i sharding-router mysql -h127.0.0.1 -P6032 -uadmin -padmin
```
5. Let's clean up the existing configuration and try again:

```bash
docker exec -it sharding-router mysql -h127.0.0.1 -P6032 -uadmin -padmin -e "DELETE FROM mysql_servers; DELETE FROM mysql_users; LOAD MYSQL SERVERS TO RUNTIME; LOAD MYSQL USERS TO RUNTIME; SAVE MYSQL SERVERS TO DISK; SAVE MYSQL USERS TO DISK;"
```
6. Now let's add the configuration back:

```bash
docker exec -it sharding-router mysql -h127.0.0.1 -P6032 -uadmin -padmin -e "INSERT INTO mysql_users (username, password, default_hostgroup, max_connections, default_schema, transaction_persistent, fast_forward, backend, frontend, active) VALUES ('root', 'rootpassword', 10, 1000, 'shard1', 1, 0, 1, 1, 1); INSERT INTO mysql_servers (hostname, port, hostgroup_id, status, weight, max_connections, max_replication_lag, use_ssl, max_latency_ms, comment) VALUES ('shard1-node1', 3306, 10, 'ONLINE', 1, 200, 10, 0, 1000, 'Shard 1 Primary - Users 1-1000'), ('shard1-node2', 3306, 10, 'ONLINE', 1, 200, 10, 0, 1000, 'Shard 1 Replica - Users 1-1000'), ('shard2-node1', 3306, 20, 'ONLINE', 1, 200, 10, 0, 1000, 'Shard 2 Primary - Users 1001-2000'), ('shard2-node2', 3306, 20, 'ONLINE', 1, 200, 10, 0, 1000, 'Shard 2 Replica - Users 1001-2000'), ('shard3-node1', 3306, 30, 'ONLINE', 1, 200, 10, 0, 1000, 'Shard 3 Primary - Users 2001-3000'), ('shard3-node2', 3306, 30, 'ONLINE', 1, 200, 10, 0, 1000, 'Shard 3 Replica - Users 2001-3000'); LOAD MYSQL USERS TO RUNTIME; LOAD MYSQL SERVERS TO RUNTIME; SAVE MYSQL USERS TO DISK; SAVE MYSQL SERVERS TO DISK;"
```
7. Let's verify the configuration:

```bash
docker exec -it sharding-router mysql -h127.0.0.1 -P6032 -uadmin -padmin -e "SELECT username, password, default_hostgroup, active FROM mysql_users; SELECT hostname, port, hostgroup_id, status FROM mysql_servers;"
```
8. Let's test the connection:

```bash
docker exec -it sharding-router mysql -h127.0.0.1 -P3306 -uroot -prootpassword -e "SELECT 1;"
```


docker exec -it shard1-node1 mysql -uroot -prootpassword -e "SELECT * FROM shard1.users;"

docker exec -it shard2-node1 mysql -uroot -prootpassword -e "SELECT * FROM shard2.users;"

docker exec -it shard3-node1 mysql -uroot -prootpassword -e "SELECT * FROM shard3.users;"

docker exec -it sharding-router mysql -h127.0.0.1 -P3306 -uroot -prootpassword -e "SELECT * FROM users;"


docker exec -it sharding-router mysql -h127.0.0.1 -P3306 -uroot -prootpassword -e \
"SELECT 'shard1' as shard_name, * FROM shard1.users \
UNION ALL \
SELECT 'shard2' as shard_name, * FROM shard2.users \
UNION ALL \
SELECT 'shard3' as shard_name, * FROM shard3.users \
ORDER BY id;"

docker exec -it sharding-router mysql -h127.0.0.1 -P3306 -uroot -prootpassword -e "SELECT * FROM users;"
docker exec -it sharding-router mysql -h127.0.0.1 -P3307 -uroot -prootpassword -e "SELECT * FROM users;"

docker exec -it sharding-router mysql -h127.0.0.1 -P3306 -uroot -prootpassword -e \
"SELECT 'shard1' as shard_name, * FROM shard1.users \
WHERE id BETWEEN 1 AND 1000 \
UNION ALL \
SELECT 'shard2' as shard_name, * FROM shard2.users \
WHERE id BETWEEN 1001 AND 2000 \
UNION ALL \
SELECT 'shard3' as shard_name, * FROM shard3.users \
WHERE id BETWEEN 2001 AND 3000 \
ORDER BY id;"


docker exec -it sharding-router mysql -h127.0.0.1 -P6032 -uadmin -padmin -e \
"SELECT * \
FROM mysql_servers \
LEFT JOIN stats.stats_memory_metrics ON hostname=hostname \
ORDER BY hostgroup_id, hostname;"


docker exec -it sharding-router mysql -h127.0.0.1 -P3306 -uroot -prootpassword -e \
"SELECT 'shard2' as shard_name, * FROM users \
WHERE id BETWEEN 1001 AND 2000 "