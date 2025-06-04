# 🚀 Quick Hands-On Guide: MariaDB Galera Cluster (Active-Active)

## 1. Prerequisites

- Docker & Docker Compose installed
- This repo cloned and in the `labs/3-master-active-active` directory

---

## 2. Start the Cluster

```bash
cd labs/3-master-active-active
docker compose up -d
```

This will start:
- 3 MariaDB Galera nodes (active-active replication)
- ProxySQL for load balancing
- phpMyAdmin for management

---

## 3. Wait for Cluster Initialization

Check that all containers are running:

```bash
docker compose ps
```

Wait about 30 seconds for the Galera cluster to initialize. You can verify the cluster status with:

```bash
docker exec galera-node1 mysql -uroot -prootpassword -e "SHOW STATUS LIKE 'wsrep%';"
```

Key indicators to look for:
- `wsrep_cluster_size = 3` (all nodes connected)
- `wsrep_cluster_status = Primary`
- `wsrep_connected = ON`
- `wsrep_ready = ON`

---

## 4. Cluster Configuration

The cluster is configured with:
- Node 1 (galera-node1): Bootstrap node
- Node 2 (galera-node2): Joins automatically
- Node 3 (galera-node3): Joins automatically

Each node has its own configuration file:
- `config/galera.cnf` (node1)
- `config/galera-node2.cnf` (node2)
- `config/galera-node3.cnf` (node3)

---

## 5. Access phpMyAdmin

- Open [http://localhost:8080](http://localhost:8080)
- Server: `proxysql`
- Username: `root`
- Password: `rootpassword`

---

## 6. Test the Cluster

You can connect to any node directly or through ProxySQL. All nodes can handle both reads and writes.

Test replication by writing to different nodes:

```bash
# Write to node1
docker exec galera-node1 mysql -uroot -prootpassword -e "CREATE DATABASE IF NOT EXISTS testdb; USE testdb; CREATE TABLE IF NOT EXISTS demo (id INT PRIMARY KEY AUTO_INCREMENT, name VARCHAR(50)); INSERT INTO demo (name) VALUES ('hello from node1');"

# Write to node2
docker exec galera-node2 mysql -uroot -prootpassword -e "USE testdb; INSERT INTO demo (name) VALUES ('hello from node2');"

# Write to node3
docker exec galera-node3 mysql -uroot -prootpassword -e "USE testdb; INSERT INTO demo (name) VALUES ('hello from node3');"

# Verify data on all nodes
docker exec galera-node1 mysql -uroot -prootpassword -e "USE testdb; SELECT * FROM demo;"
docker exec galera-node2 mysql -uroot -prootpassword -e "USE testdb; SELECT * FROM demo;"
docker exec galera-node3 mysql -uroot -prootpassword -e "USE testdb; SELECT * FROM demo;"
```

---

## 7. Stop the Cluster

```bash
docker compose down
```

To completely clean up (including data):
```bash
docker compose down -v
rm -rf mysql*_data proxysql_data
```

---

## 8. Useful Ports

| Service      | Host Port | Description                    |
|--------------|-----------|--------------------------------|
| Galera Node 1| 3306      | Direct access to first node    |
| Galera Node 2| 3307      | Direct access to second node   |
| Galera Node 3| 3308      | Direct access to third node    |
| ProxySQL     | 6033      | Load balanced MySQL interface  |
| ProxySQL Admin| 6032     | ProxySQL admin interface       |
| phpMyAdmin   | 8080      | Web-based management interface |

---

## 9. Troubleshooting

### Check Node Status
```bash
# Check cluster status on any node
docker exec galera-node1 mysql -uroot -prootpassword -e "SHOW STATUS LIKE 'wsrep%';"

# Check node logs
docker logs galera-node1
docker logs galera-node2
docker logs galera-node3
```

### Common Issues
1. **Node not joining cluster**
   - Check if the node can reach other nodes
   - Verify configuration files
   - Check logs for specific errors

2. **Replication not working**
   - Verify all nodes show `wsrep_connected = ON`
   - Check `wsrep_cluster_size = 3`
   - Ensure `wsrep_cluster_status = Primary`

3. **ProxySQL connection issues**
   - Verify ProxySQL can reach all nodes
   - Check ProxySQL logs: `docker logs proxysql`

---

## 10. Cluster Features

- **Active-Active**: All nodes can handle reads and writes
- **Synchronous Replication**: All nodes have the same data
- **Automatic Node Recovery**: Nodes automatically rejoin after restart
- **Load Balancing**: ProxySQL distributes queries across nodes
- **High Availability**: Cluster continues working if one node fails

---

**You now have a 3-node MariaDB Galera Cluster running with ProxySQL and phpMyAdmin!**

For more information about Galera Cluster, visit the [official documentation](https://galeracluster.com/library/documentation/index.html).
