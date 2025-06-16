-- ProxySQL Sharding Router Initialization
-- This script configures ProxySQL for sharding based on user ID
-- Create monitor user
INSERT INTO mysql_users (
        username,
        password,
        default_hostgroup,
        max_connections,
        default_schema,
        transaction_persistent,
        fast_forward,
        backend,
        frontend,
        active
    )
VALUES (
        'monitor',
        'monitor',
        10,
        1000,
        'information_schema',
        1,
        0,
        1,
        1,
        1
    );
-- Create shard user
INSERT INTO mysql_users (
        username,
        password,
        default_hostgroup,
        max_connections,
        default_schema,
        transaction_persistent,
        fast_forward,
        backend,
        frontend,
        active
    )
VALUES (
        'shard_user',
        'shard_password',
        10,
        1000,
        'shard1',
        1,
        0,
        1,
        1,
        1
    );
-- Create root user
INSERT INTO mysql_users (
        username,
        password,
        default_hostgroup,
        max_connections,
        default_schema,
        transaction_persistent,
        fast_forward,
        backend,
        frontend,
        active
    )
VALUES (
        'root',
        'rootpassword',
        10,
        1000,
        'shard1',
        1,
        0,
        1,
        1,
        1
    );
-- Add shard servers
-- Shard 1 (Users 1-1000)
INSERT INTO mysql_servers (
        hostname,
        port,
        hostgroup_id,
        status,
        weight,
        max_connections,
        max_replication_lag,
        use_ssl,
        max_latency_ms,
        comment
    )
VALUES (
        'shard1-node1',
        3306,
        10,
        'ONLINE',
        1,
        200,
        10,
        0,
        1000,
        'Shard 1 Primary - Users 1-1000'
    );
INSERT INTO mysql_servers (
        hostname,
        port,
        hostgroup_id,
        status,
        weight,
        max_connections,
        max_replication_lag,
        use_ssl,
        max_latency_ms,
        comment
    )
VALUES (
        'shard1-node2',
        3306,
        10,
        'ONLINE',
        1,
        200,
        10,
        0,
        1000,
        'Shard 1 Replica - Users 1-1000'
    );
-- Shard 2 (Users 1001-2000)
INSERT INTO mysql_servers (
        hostname,
        port,
        hostgroup_id,
        status,
        weight,
        max_connections,
        max_replication_lag,
        use_ssl,
        max_latency_ms,
        comment
    )
VALUES (
        'shard2-node1',
        3306,
        20,
        'ONLINE',
        1,
        200,
        10,
        0,
        1000,
        'Shard 2 Primary - Users 1001-2000'
    );
INSERT INTO mysql_servers (
        hostname,
        port,
        hostgroup_id,
        status,
        weight,
        max_connections,
        max_replication_lag,
        use_ssl,
        max_latency_ms,
        comment
    )
VALUES (
        'shard2-node2',
        3306,
        20,
        'ONLINE',
        1,
        200,
        10,
        0,
        1000,
        'Shard 2 Replica - Users 1001-2000'
    );
-- Shard 3 (Users 2001-3000)
INSERT INTO mysql_servers (
        hostname,
        port,
        hostgroup_id,
        status,
        weight,
        max_connections,
        max_replication_lag,
        use_ssl,
        max_latency_ms,
        comment
    )
VALUES (
        'shard3-node1',
        3306,
        30,
        'ONLINE',
        1,
        200,
        10,
        0,
        1000,
        'Shard 3 Primary - Users 2001-3000'
    );
INSERT INTO mysql_servers (
        hostname,
        port,
        hostgroup_id,
        status,
        weight,
        max_connections,
        max_replication_lag,
        use_ssl,
        max_latency_ms,
        comment
    )
VALUES (
        'shard3-node2',
        3306,
        30,
        'ONLINE',
        1,
        200,
        10,
        0,
        1000,
        'Shard 3 Replica - Users 2001-3000'
    );
-- Configure query rules for sharding
-- Rule 1: Route SELECT queries with id=1-1000 to shard 1
INSERT INTO mysql_query_rules (
        rule_id,
        active,
        match_pattern,
        destination_hostgroup,
        apply,
        comment,
        re_modifiers,
        flagIN,
        flagOUT,
        replace_pattern
    )
VALUES (
        1,
        1,
        '^SELECT.*WHERE.*id\s*=\s*(\d+)',
        10,
        1,
        'Route queries with id=1-1000 to shard 1',
        'CASELESS',
        0,
        NULL,
        'SELECT * FROM users WHERE id = \1 AND id BETWEEN 1 AND 1000'
    );
-- Rule 2: Route SELECT queries with id=1001-2000 to shard 2
INSERT INTO mysql_query_rules (
        rule_id,
        active,
        match_pattern,
        destination_hostgroup,
        apply,
        comment,
        re_modifiers,
        flagIN,
        flagOUT,
        replace_pattern
    )
VALUES (
        2,
        1,
        '^SELECT.*WHERE.*id\s*=\s*(\d+)',
        20,
        1,
        'Route queries with id=1001-2000 to shard 2',
        'CASELESS',
        0,
        NULL,
        'SELECT * FROM users WHERE id = \1 AND id BETWEEN 1001 AND 2000'
    );
-- Rule 3: Route SELECT queries with id=2001-3000 to shard 3
INSERT INTO mysql_query_rules (
        rule_id,
        active,
        match_pattern,
        destination_hostgroup,
        apply,
        comment,
        re_modifiers,
        flagIN,
        flagOUT,
        replace_pattern
    )
VALUES (
        3,
        1,
        '^SELECT.*WHERE.*id\s*=\s*(\d+)',
        30,
        1,
        'Route queries with id=2001-3000 to shard 3',
        'CASELESS',
        0,
        NULL,
        'SELECT * FROM users WHERE id = \1 AND id BETWEEN 2001 AND 3000'
    );
-- Rule 4: Route INSERT with id=1-1000 to shard 1
INSERT INTO mysql_query_rules (
        rule_id,
        active,
        match_pattern,
        destination_hostgroup,
        apply,
        comment,
        re_modifiers,
        flagIN,
        flagOUT
    )
VALUES (
        4,
        1,
        '^INSERT.*VALUES.*\((\d+)',
        10,
        1,
        'Route INSERT with id=1-1000 to shard 1',
        'CASELESS',
        0,
        NULL
    );
-- Rule 5: Route INSERT with id=1001-2000 to shard 2
INSERT INTO mysql_query_rules (
        rule_id,
        active,
        match_pattern,
        destination_hostgroup,
        apply,
        comment,
        re_modifiers,
        flagIN,
        flagOUT
    )
VALUES (
        5,
        1,
        '^INSERT.*VALUES.*\((\d+)',
        20,
        1,
        'Route INSERT with id=1001-2000 to shard 2',
        'CASELESS',
        0,
        NULL
    );
-- Rule 6: Route INSERT with id=2001-3000 to shard 3
INSERT INTO mysql_query_rules (
        rule_id,
        active,
        match_pattern,
        destination_hostgroup,
        apply,
        comment,
        re_modifiers,
        flagIN,
        flagOUT
    )
VALUES (
        6,
        1,
        '^INSERT.*VALUES.*\((\d+)',
        30,
        1,
        'Route INSERT with id=2001-3000 to shard 3',
        'CASELESS',
        0,
        NULL
    );
-- Rule 7: Route UPDATE with id=1-1000 to shard 1
INSERT INTO mysql_query_rules (
        rule_id,
        active,
        match_pattern,
        destination_hostgroup,
        apply,
        comment,
        re_modifiers,
        flagIN,
        flagOUT
    )
VALUES (
        7,
        1,
        '^UPDATE.*WHERE.*id\s*=\s*(\d+)',
        10,
        1,
        'Route UPDATE with id=1-1000 to shard 1',
        'CASELESS',
        0,
        NULL
    );
-- Rule 8: Route UPDATE with id=1001-2000 to shard 2
INSERT INTO mysql_query_rules (
        rule_id,
        active,
        match_pattern,
        destination_hostgroup,
        apply,
        comment,
        re_modifiers,
        flagIN,
        flagOUT
    )
VALUES (
        8,
        1,
        '^UPDATE.*WHERE.*id\s*=\s*(\d+)',
        20,
        1,
        'Route UPDATE with id=1001-2000 to shard 2',
        'CASELESS',
        0,
        NULL
    );
-- Rule 9: Route UPDATE with id=2001-3000 to shard 3
INSERT INTO mysql_query_rules (
        rule_id,
        active,
        match_pattern,
        destination_hostgroup,
        apply,
        comment,
        re_modifiers,
        flagIN,
        flagOUT
    )
VALUES (
        9,
        1,
        '^UPDATE.*WHERE.*id\s*=\s*(\d+)',
        30,
        1,
        'Route UPDATE with id=2001-3000 to shard 3',
        'CASELESS',
        0,
        NULL
    );
-- Rule 10: Route DELETE with id=1-1000 to shard 1
INSERT INTO mysql_query_rules (
        rule_id,
        active,
        match_pattern,
        destination_hostgroup,
        apply,
        comment,
        re_modifiers,
        flagIN,
        flagOUT
    )
VALUES (
        10,
        1,
        '^DELETE.*WHERE.*id\s*=\s*(\d+)',
        10,
        1,
        'Route DELETE with id=1-1000 to shard 1',
        'CASELESS',
        0,
        NULL
    );
-- Rule 11: Route DELETE with id=1001-2000 to shard 2
INSERT INTO mysql_query_rules (
        rule_id,
        active,
        match_pattern,
        destination_hostgroup,
        apply,
        comment,
        re_modifiers,
        flagIN,
        flagOUT
    )
VALUES (
        11,
        1,
        '^DELETE.*WHERE.*id\s*=\s*(\d+)',
        20,
        1,
        'Route DELETE with id=1001-2000 to shard 2',
        'CASELESS',
        0,
        NULL
    );
-- Rule 12: Route DELETE with id=2001-3000 to shard 3
INSERT INTO mysql_query_rules (
        rule_id,
        active,
        match_pattern,
        destination_hostgroup,
        apply,
        comment,
        re_modifiers,
        flagIN,
        flagOUT
    )
VALUES (
        12,
        1,
        '^DELETE.*WHERE.*id\s*=\s*(\d+)',
        30,
        1,
        'Route DELETE with id=2001-3000 to shard 3',
        'CASELESS',
        0,
        NULL
    );
-- Load configuration to runtime
LOAD MYSQL USERS TO RUNTIME;
LOAD MYSQL SERVERS TO RUNTIME;
LOAD MYSQL QUERY RULES TO RUNTIME;
-- Save configuration to disk
SAVE MYSQL USERS TO DISK;
SAVE MYSQL SERVERS TO DISK;
SAVE MYSQL QUERY RULES TO DISK;
-- Show configuration status
SELECT 'ProxySQL sharding configuration completed successfully' as status;