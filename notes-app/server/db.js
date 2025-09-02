// db.js
const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

// Initialize database
const initializeDb = async () => {
  try {
    // Read and execute initialization SQL
    const initSql = fs.readFileSync(path.join(__dirname, 'db', 'init.sql'), 'utf8');
    await pool.query(initSql);

    // Test connection
    const result = await pool.query('SELECT NOW()');
    console.log('✅ Connected to DB at:', result.rows[0].now);
  } catch (error) {
    console.error('❌ Database initialization error:', error);
    process.exit(1); // Exit if database initialization fails
  }
};

initializeDb();

module.exports = pool;
