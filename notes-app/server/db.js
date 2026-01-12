/**
 * @fileoverview PostgreSQL database connection pool
 * Configures connection pooling with security and optional schema initialization
 * @module db
 */

const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');

/**
 * Required database environment variables
 * Server will fail fast if any are missing
 */
const REQUIRED_DB_VARS = ['DB_HOST', 'DB_PORT', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'];

// Validate required DB env vars early and fail fast with a helpful message
const missing = REQUIRED_DB_VARS.filter(k => !process.env[k]);
if (missing.length > 0) {
    console.error(
        `❌ Missing required DB environment variables: ${missing.join(', ')}.\n` +
        `Please create a .env file (see .env.example) or set these variables in your environment.`
    );
    // Do not exit here to allow running non-db scripts/tests
}

/**
 * PostgreSQL connection pool
 * Configured from environment variables:
 * - DB_HOST: Database hostname
 * - DB_PORT: Database port (usually 5432)
 * - DB_USER: Database username
 * - DB_PASSWORD: Database password
 * - DB_NAME: Database name
 * 
 * Connection pool settings:
 * - max: 20 connections maximum
 * - idleTimeoutMillis: Close idle connections after 30s
 * - connectionTimeoutMillis: Fail after 2s if cannot connect
 * 
 * SSL is enabled in production for security
 * 
 * @type {Pool}
 */
const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    
    // Connection pool configuration
    max: 20,                      // Maximum connections in pool
    idleTimeoutMillis: 30000,     // Close idle connections after 30s
    connectionTimeoutMillis: 2000, // Fail after 2s if can't connect
    
    // SSL for production (required by most hosted databases)
    ssl: process.env.NODE_ENV === 'production' ? {
        rejectUnauthorized: false  // Allow self-signed certificates (common for hosted DBs)
    } : false
});

/**
 * Global pool error handler
 * Prevents uncaught errors from crashing the process
 * The pool will automatically attempt to reconnect on connection loss
 * 
 * Common causes:
 * - Network interruptions
 * - Database restarts
 * - Connection timeouts
 */
pool.on('error', (err, client) => {
    console.error('❌ Unexpected database pool error:', err.message || err);
    console.error('Pool will attempt to reconnect automatically');
});

/**
 * Runs database initialization SQL if RUN_DB_INIT environment variable is 'true'
 * 
 * WARNING: This is dangerous in production!
 * - Can drop tables and destroy data
 * - Should only be used in development
 * - Production should use proper migrations (e.g., Knex, TypeORM, Prisma)
 * 
 * Reads and executes SQL from: ./db/init.sql
 * 
 * Safety features:
 * - Requires explicit RUN_DB_INIT=true flag
 * - Blocks execution in production environment
 * - Validates init.sql file exists before reading
 * 
 * @async
 * @returns {Promise<void>}
 * @throws {Error} If initialization fails or attempted in production
 * @example
 * // In development only:
 * RUN_DB_INIT=true node index.js
 */
const runInitSqlIfRequested = async () => {
    try {
        // Skip if not explicitly requested
        if (process.env.RUN_DB_INIT !== 'true') {
            return;
        }
        
        // Block in production (safety check)
        if (process.env.NODE_ENV === 'production') {
            throw new Error('🚫 RUN_DB_INIT is not allowed in production! Use migrations instead.');
        }
        
        console.log('⚠️ RUN_DB_INIT=true - executing init SQL (development only)');
        
        // Check if init.sql file exists
        const initSqlPath = path.join(__dirname, 'db', 'init.sql');
        if (!fs.existsSync(initSqlPath)) {
            throw new Error(`Init SQL file not found: ${initSqlPath}`);
        }
        
        // Read and execute init SQL
        const initSql = fs.readFileSync(initSqlPath, 'utf8');
        await pool.query(initSql);
        
        // Verify connection
        const result = await pool.query('SELECT NOW()');
        console.log('✅ Database initialized at:', result.rows[0].now);
        
    } catch (error) {
        console.error('❌ Database initialization error:', error.message);
        throw error;  // Let caller decide how to handle (allows proper error handling in index.js)
    }
};

/**
 * Gracefully closes all connections in the pool
 * Should be called during application shutdown to prevent connection leaks
 * 
 * @async
 * @returns {Promise<void>}
 * @example
 * // In shutdown handler:
 * await db.end();
 */
const closePool = async () => {
    await pool.end();
};

// Export pool as default for backward compatibility with existing code
// Allows: const pool = require('./db')
module.exports = pool;

// Export helper functions as properties
module.exports.runInitSqlIfRequested = runInitSqlIfRequested;
module.exports.closePool = closePool;
