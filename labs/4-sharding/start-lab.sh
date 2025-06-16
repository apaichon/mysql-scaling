#!/bin/bash

# MySQL Sharding Lab Startup Script
# This script sets up the complete sharding environment

set -e

echo "🚀 Starting MySQL Sharding Lab Setup..."
echo "========================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Docker is running
check_docker() {
    print_status "Checking Docker status..."
    if ! docker info > /dev/null 2>&1; then
        print_error "Docker is not running. Please start Docker and try again."
        exit 1
    fi
    print_success "Docker is running"
}

# Check available ports
check_ports() {
    print_status "Checking required ports..."
    local ports=(3306 3307 3308 3309 3310 3311 3312 8888 3000)
    local available=true
    
    for port in "${ports[@]}"; do
        if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
            print_warning "Port $port is already in use"
            available=false
        fi
    done
    
    if [ "$available" = false ]; then
        print_error "Some required ports are already in use. Please free them up and try again."
        exit 1
    fi
    print_success "All required ports are available"
}

# Clean up existing environment
cleanup_environment() {
    print_status "Cleaning up existing environment..."
    
    # Stop and remove containers, networks, and volumes
    docker-compose down -v --remove-orphans 2>/dev/null || true
    
    # Remove any orphaned containers
    docker container prune -f >/dev/null 2>&1 || true
    
    print_success "Environment cleaned up"
}

# Start the containers
start_containers() {
    print_status "Starting Docker containers..."
    
    # Start containers
    docker-compose up -d
    
    print_success "Containers started successfully"
}

# Wait for services to be ready
wait_for_services() {
    print_status "Waiting for services to be ready..."
    
    # Wait for MariaDB containers
    local max_attempts=60
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if docker-compose ps | grep -q "Up" && \
           docker exec shard1-node1 mysqladmin ping -h localhost -u root -prootpassword >/dev/null 2>&1 && \
           docker exec shard2-node1 mysqladmin ping -h localhost -u root -prootpassword >/dev/null 2>&1 && \
           docker exec shard3-node1 mysqladmin ping -h localhost -u root -prootpassword >/dev/null 2>&1; then
            print_success "All MariaDB containers are ready"
            break
        fi
        
        print_status "Waiting for containers to be ready... (attempt $attempt/$max_attempts)"
        sleep 5
        attempt=$((attempt + 1))
    done
    
    if [ $attempt -gt $max_attempts ]; then
        print_error "Timeout waiting for containers to be ready"
        exit 1
    fi
}

# Initialize shards with error handling
initialize_shards() {
    print_status "Initializing shards..."
    
    # Wait a bit more for containers to be fully ready
    sleep 10
    
    # Initialize shard 1
    print_status "Initializing Shard 1..."
    if docker exec -i shard1-node1 mysql -uroot -prootpassword < init-scripts/init-shard1.sql 2>/dev/null; then
        print_success "Shard 1 initialized"
    else
        print_warning "Shard 1 may already be initialized (duplicate key errors are normal)"
    fi
    
    # Initialize shard 2
    print_status "Initializing Shard 2..."
    if docker exec -i shard2-node1 mysql -uroot -prootpassword < init-scripts/init-shard2.sql 2>/dev/null; then
        print_success "Shard 2 initialized"
    else
        print_warning "Shard 2 may already be initialized (duplicate key errors are normal)"
    fi
    
    # Initialize shard 3
    print_status "Initializing Shard 3..."
    if docker exec -i shard3-node1 mysql -uroot -prootpassword < init-scripts/init-shard3.sql 2>/dev/null; then
        print_success "Shard 3 initialized"
    else
        print_warning "Shard 3 may already be initialized (duplicate key errors are normal)"
    fi
    
    print_success "All shards processed"
}

# Configure ProxySQL with error handling
configure_proxysql() {
    print_status "Configuring ProxySQL sharding router..."
    
    # Wait for ProxySQL to be ready
    sleep 10
    
    # Initialize ProxySQL
    if docker exec -i sharding-router mysql -h127.0.0.1 -P6032 -uadmin -padmin < init-scripts/init-proxysql.sql 2>/dev/null; then
        print_success "ProxySQL configured successfully"
    else
        print_warning "ProxySQL may already be configured"
    fi
}

# Install Node.js dependencies
install_dependencies() {
    print_status "Installing Node.js dependencies..."
    
    if [ -d "app" ]; then
        cd app
        npm install
        cd ..
        print_success "Node.js dependencies installed"
    else
        print_warning "App directory not found, skipping dependency installation"
    fi
}

# Display access information
show_access_info() {
    echo ""
    echo "🎉 MySQL Sharding Lab is ready!"
    echo "================================"
    echo ""
    echo "📊 Access Points:"
    echo "  • phpMyAdmin:     http://localhost:8888"
    echo "  • Monitoring:     http://localhost:3000"
    echo "  • Sharding Router: localhost:3307"
    echo ""
    echo "🗄️  Database Connections:"
    echo "  • Shard 1 Primary: localhost:3306"
    echo "  • Shard 1 Replica: localhost:3308"
    echo "  • Shard 2 Primary: localhost:3309"
    echo "  • Shard 2 Replica: localhost:3310"
    echo "  • Shard 3 Primary: localhost:3311"
    echo "  • Shard 3 Replica: localhost:3312"
    echo ""
    echo "🧪 Test Commands:"
    echo "  • Run sharding tests: cd app && npm start"
    echo "  • Basic sharding test: cd app && npm test"
    echo "  • Performance test: cd app && npm run performance"
    echo ""
    echo "🔧 Management Commands:"
    echo "  • View logs: docker-compose logs -f"
    echo "  • Stop lab: docker-compose down"
    echo "  • Restart lab: ./start-lab.sh"
    echo ""
    echo "📚 Documentation: README.md"
    echo ""
}

# Main execution
main() {
    echo "MySQL Sharding Lab Setup"
    echo "========================"
    echo ""
    
    # Check prerequisites
    check_docker
    check_ports
    
    # Clean up and start the lab
    cleanup_environment
    start_containers
    wait_for_services
    initialize_shards
    configure_proxysql
    install_dependencies
    
    # Show access information
    show_access_info
}

# Run main function
main "$@" 