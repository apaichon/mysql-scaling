# MySQL Proxy API

A Node.js API that proxies MySQL operations in a master-slave replication setup. Write operations are routed to the master, while read operations are randomly distributed between slave1 and slave2 for load balancing.

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   MySQL Master │    │   MySQL Slave1  │    │   MySQL Slave2  │
│   Port: 3306    │    │   Port: 3307    │    │   Port: 3308    │
│   (WRITE ONLY)  │    │   (READ ONLY)   │    │   (READ ONLY)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         ▲                       ▲                       ▲
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌─────────────────┐
                    │   Node.js API   │
                    │   Port: 3000    │
                    │   (PROXY)       │
                    └─────────────────┘
```

## 🚀 Quick Start

### Prerequisites

1. Make sure the MySQL replication cluster is running:
   ```bash
   cd labs/2-master_slave_replication
   ./setup-replication.sh
   ```

   This script will:
   - Start all MySQL containers (master + 2 slaves)
   - Initialize the database structure and sample data on all nodes
   - Configure replication between master and slaves
   - Verify that all nodes have the same data

2. Install Node.js dependencies:
   ```bash
   cd app
   npm install
   ```

3. Start the API server:
   ```bash
   npm start
   ```

   Or for development with auto-reload:
   ```bash
   npm run dev
   ```

## 📡 API Endpoints

### Health Check
- **GET** `/health` - Check connection status of all databases

### User Management

#### Read Operations (Randomly routed to slaves)
- **GET** `/api/users` - Get all users
- **GET** `/api/users/:id` - Get user by ID

#### Write Operations (Always routed to master)
- **POST** `/api/users` - Create a new user
- **PUT** `/api/users/:id` - Update a user
- **DELETE** `/api/users/:id` - Delete a user

### Custom Queries
- **POST** `/api/query` - Execute custom SQL queries

## 📖 Usage Examples

### 1. Health Check
```bash
curl http://localhost:3000/health
```

Response:
```json
{
  "status": "healthy",
  "master": "connected",
  "slave1": "connected",
  "slave2": "connected"
}
```

### 2. Create a User (Write - Master)
```bash
curl -X POST http://localhost:3000/api/users \
  -H "Content-Type: application/json" \
  -d '{
    "username": "john_doe",
    "email": "john@example.com",
    "first_name": "John",
    "last_name": "Doe"
  }'
```

Response:
```json
{
  "success": true,
  "data": {
    "id": 1,
    "username": "john_doe",
    "email": "john@example.com",
    "first_name": "John",
    "last_name": "Doe"
  },
  "source": "master"
}
```

### 3. Get All Users (Read - Random Slave)
```bash
curl http://localhost:3000/api/users
```

Response:
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "username": "john_doe",
      "email": "john@example.com",
      "first_name": "John",
      "last_name": "Doe"
    }
  ],
  "source": "slave1"
}
```

### 4. Get User by ID (Read - Random Slave)
```bash
curl http://localhost:3000/api/users/1
```

Response:
```json
{
  "success": true,
  "data": {
    "id": 1,
    "username": "john_doe",
    "email": "john@example.com",
    "first_name": "John",
    "last_name": "Doe"
  },
  "source": "slave2"
}
```

### 5. Update User (Write - Master)
```bash
curl -X PUT http://localhost:3000/api/users/1 \
  -H "Content-Type: application/json" \
  -d '{
    "username": "john_updated",
    "email": "john.updated@example.com",
    "first_name": "John",
    "last_name": "Doe Updated"
  }'
```

### 6. Delete User (Write - Master)
```bash
curl -X DELETE http://localhost:3000/api/users/1
```

### 7. Custom Query
```bash
# Read operation (random slave)
curl -X POST http://localhost:3000/api/query \
  -H "Content-Type: application/json" \
  -d '{
    "query": "SELECT COUNT(*) as user_count FROM users",
    "operation": "read"
  }'

# Write operation (master)
curl -X POST http://localhost:3000/api/query \
  -H "Content-Type: application/json" \
  -d '{
    "query": "INSERT INTO users (username, email) VALUES (?, ?)",
    "params": ["test_user", "test@example.com"],
    "operation": "write"
  }'
```

## 🔧 Configuration

The API automatically detects read vs write operations based on SQL keywords:

- **Write operations**: `INSERT`, `UPDATE`, `DELETE`, `CREATE`, `ALTER`, `DROP`
- **Read operations**: `SELECT`, `SHOW`, `DESCRIBE`, etc.

You can also explicitly specify the operation type in the `/api/query` endpoint.

## 📊 Load Balancing

Read operations are randomly distributed between slave1 and slave2 using a simple 50/50 probability. This provides basic load balancing across the read replicas.

## 🛡️ Security Features

- **Helmet.js**: Security headers
- **CORS**: Cross-origin resource sharing
- **Input validation**: Basic validation for required fields
- **SQL injection protection**: Parameterized queries using mysql2
- **Dedicated application user**: Uses `appuser` instead of root credentials

## 🔍 Monitoring

The API includes built-in monitoring:

1. **Health endpoint**: Check database connectivity
2. **Source tracking**: Each response includes which database was used
3. **Error handling**: Comprehensive error responses
4. **Graceful shutdown**: Proper cleanup of database connections

## 🧪 Testing

You can test the replication by:

1. Creating data via the API (goes to master)
2. Reading data multiple times (should see different slaves being used)
3. Checking that data is replicated across all nodes

```bash
# Test script
for i in {1..5}; do
  echo "Request $i:"
  curl -s http://localhost:3000/api/users | jq '.source'
  echo "---"
done
```

Or use the provided test script:
```bash
./test-api.sh
```

## 🚨 Troubleshooting

### Common Issues

1. **Connection refused**: Make sure MySQL containers are running
2. **Authentication failed**: The API uses `appuser/apppassword` credentials
3. **Database not found**: Run `./setup-replication.sh` to initialize all nodes

### Debug Mode

Enable debug logging by setting the environment variable:
```bash
DEBUG=mysql2* npm start
```

## 📝 Environment Variables

- `PORT`: Server port (default: 3000)
- `DEBUG`: Enable debug logging

## 🔄 Database Schema

The API expects a `users` table with the following structure:

```sql
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  email VARCHAR(100) NOT NULL UNIQUE,
  first_name VARCHAR(50),
  last_name VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

This table is automatically created by the MySQL initialization scripts in the replication setup.

## 🔐 Database Credentials

The API uses the following credentials (created by the initialization scripts):

- **Username**: `appuser`
- **Password**: `apppassword`
- **Database**: `testdb`
- **Permissions**: SELECT, INSERT, UPDATE, DELETE on testdb.*

These credentials are created in the `01-create-replication-user.sql` initialization script and are replicated to all slave nodes during setup. 