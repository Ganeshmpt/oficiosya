const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool(
  process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
      }
    : {
        host:     process.env.DB_HOST     || 'localhost',
        database: process.env.DB_NAME     || 'oficiosya_db',
        user:     process.env.DB_USER     || 'postgres',
        password: process.env.DB_PASSWORD || '',
        port:     parseInt(process.env.DB_PORT) || 5432,
      }
);

pool.on('connect', () => {
  console.log('✅ Conectado a PostgreSQL:', process.env.DB_NAME || 'neondb');
});

pool.on('error', (err) => {
  console.error('❌ Error en pool de PostgreSQL:', err.message);
});

module.exports = pool;