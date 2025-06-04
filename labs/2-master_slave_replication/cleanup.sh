#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== MySQL Master-Slave Replication Cleanup ===${NC}"

# Stop and remove containers
echo -e "${YELLOW}Stopping and removing containers...${NC}"
docker-compose down

# Remove volumes (optional - uncomment if you want to remove data)
echo -e "${YELLOW}Do you want to remove all data volumes? (y/N)${NC}"
read -r response
if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
    echo -e "${YELLOW}Removing volumes...${NC}"
    docker-compose down -v
    docker volume prune -f
    echo -e "${GREEN}Volumes removed.${NC}"
else
    echo -e "${BLUE}Volumes preserved. Data will be available when you restart the containers.${NC}"
fi

# Remove any orphaned containers
echo -e "${YELLOW}Removing any orphaned containers...${NC}"
docker container prune -f

echo -e "${GREEN}=== Cleanup complete! ===${NC}" 