#!/usr/bin/env node
// deleteUser.js
// Usage: node deleteUser.js user@example.com

const pool = require('../db');

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error('Usage: node deleteUser.js <email>');
    process.exit(2);
  }

  try {
    console.log(`Deleting user and related data for email: ${email}`);
    const res = await pool.query('DELETE FROM users WHERE email = $1 RETURNING id, email', [email]);
    if (res.rowCount === 0) {
      console.log('No user found with that email.');
      process.exit(0);
    }
    console.log('Deleted user:', res.rows[0]);
    process.exit(0);
  } catch (err) {
    console.error('Error deleting user:', err);
    process.exit(1);
  }
}

main();
