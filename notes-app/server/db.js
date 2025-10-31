// db.js
const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');

// Validate required DB env vars early and fail fast with a helpful message.
const requiredDbVars = ['DB_HOST', 'DB_PORT', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'];
const missing = requiredDbVars.filter(k => !process.env[k]);
if (missing.length > 0) {
  console.error(`❌ Missing required DB environment variables: ${missing.join(', ')}.\nPlease create a .env file (see .env.example) or set these variables in your environment.`);
  // Do not exit here to allow running non-db scripts/tests, but throw to fail fast when code attempts DB operations.
}

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

// Expose a function to run the initialization SQL explicitly. This will not run automatically
// unless the environment variable RUN_DB_INIT is set to 'true'. Running initialization
// in production is dangerous; prefer migrations for schema upgrades.
const runInitSqlIfRequested = async () => {
  try {
    if (process.env.RUN_DB_INIT !== 'true') return;
    console.log('⚠️ RUN_DB_INIT=true - executing init SQL (dangerous in production)');
    const initSql = fs.readFileSync(path.join(__dirname, 'db', 'init.sql'), 'utf8');
    await pool.query(initSql);
    const result = await pool.query('SELECT NOW()');
    console.log('✅ Connected to DB at:', result.rows[0].now);
  } catch (error) {
    console.error('❌ Database initialization error:', error);
    process.exit(1);
  }
};

// Export the pool as the module default for backwards compatibility with
// existing requires (e.g. `const pool = require('./db')`). Attach the
// runInitSqlIfRequested helper as a property so callers can opt-in to init.
module.exports = pool;
module.exports.runInitSqlIfRequested = runInitSqlIfRequested;
