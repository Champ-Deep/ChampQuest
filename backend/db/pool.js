const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/champquest',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: parseInt(process.env.PG_POOL_MAX || '20'),  // max pooled connections
  idleTimeoutMillis: 30000,                         // close idle connections after 30s
  connectionTimeoutMillis: 2000,                    // fail fast if DB unreachable
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

module.exports = pool;