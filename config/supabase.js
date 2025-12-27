// Supabase Database Configuration for PostgreSQL
// Supports both Supabase JS client and direct PostgreSQL connection

const { createClient } = require('@supabase/supabase-js');
const { Pool } = require('pg');

let supabase = null;
let pgPool = null;

// Initialize Supabase client (for Storage, Auth, etc.)
function initSupabaseClient() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.warn('Supabase URL or Key not configured');
    return null;
  }

  supabase = createClient(supabaseUrl, supabaseKey);
  console.log('Supabase client initialized');
  return supabase;
}

// Initialize PostgreSQL pool (for direct SQL queries - more compatible with existing code)
async function initDatabase() {
  // Support both DATABASE_URL (Vercel/Supabase format) and individual vars
  const connectionString = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
  
  if (connectionString) {
    pgPool = new Pool({
      connectionString,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });
  } else {
    // Fallback to individual environment variables
    pgPool = new Pool({
      host: process.env.DB_HOST || process.env.SUPABASE_DB_HOST,
      port: parseInt(process.env.DB_PORT || '5432', 10),
      database: process.env.DB_NAME || process.env.SUPABASE_DB_NAME || 'postgres',
      user: process.env.DB_USER || process.env.SUPABASE_DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || process.env.SUPABASE_DB_PASSWORD,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });
  }

  // Test connection
  try {
    const client = await pgPool.connect();
    console.log('PostgreSQL connected successfully');
    client.release();
  } catch (err) {
    console.error('PostgreSQL connection failed:', err.message);
    throw err;
  }

  // Initialize Supabase client for storage
  initSupabaseClient();

  // Return wrapper compatible with existing mysql2 code
  const poolWrapper = {
    async execute(query, params = []) {
      try {
        // Convert MySQL ? placeholders to PostgreSQL $1, $2, etc.
        const pgQuery = convertToPostgresQuery(query);
        const result = await pgPool.query(pgQuery, params);
        // Return format compatible with mysql2: [rows, fields]
        return [result.rows, result.fields];
      } catch (error) {
        console.error('Database query error:', error.message);
        throw error;
      }
    },

    async query(sql, params = []) {
      try {
        const pgQuery = convertToPostgresQuery(sql);
        const result = await pgPool.query(pgQuery, params);
        return [result.rows, result.fields];
      } catch (error) {
        console.error('Database query error:', error.message);
        throw error;
      }
    },

    async getConnection() {
      const client = await pgPool.connect();
      return {
        execute: async (query, params) => {
          const pgQuery = convertToPostgresQuery(query);
          const result = await client.query(pgQuery, params);
          return [result.rows, result.fields];
        },
        query: async (query, params) => {
          const pgQuery = convertToPostgresQuery(query);
          const result = await client.query(pgQuery, params);
          return [result.rows, result.fields];
        },
        release: () => client.release(),
        beginTransaction: () => client.query('BEGIN'),
        commit: () => client.query('COMMIT'),
        rollback: () => client.query('ROLLBACK')
      };
    },

    end: () => pgPool.end(),
    on: (event, callback) => pgPool.on(event, callback)
  };

  return poolWrapper;
}

// Convert MySQL query syntax to PostgreSQL
function convertToPostgresQuery(query) {
  let paramIndex = 0;
  
  // Replace ? with $1, $2, etc.
  let converted = query.replace(/\?/g, () => `$${++paramIndex}`);
  
  // Replace MySQL-specific syntax
  converted = converted
    // AUTO_INCREMENT -> SERIAL (handled in table creation)
    .replace(/INT\s+AUTO_INCREMENT/gi, 'SERIAL')
    .replace(/BIGINT\s+AUTO_INCREMENT/gi, 'BIGSERIAL')
    // DATETIME -> TIMESTAMP
    .replace(/\bDATETIME\b/gi, 'TIMESTAMP')
    // NOW() is same in PostgreSQL
    // LONGTEXT -> TEXT
    .replace(/\bLONGTEXT\b/gi, 'TEXT')
    .replace(/\bMEDIUMTEXT\b/gi, 'TEXT')
    // TINYINT(1) -> BOOLEAN
    .replace(/TINYINT\s*\(\s*1\s*\)/gi, 'BOOLEAN')
    // Remove UNSIGNED
    .replace(/\bUNSIGNED\b/gi, '')
    // ON DUPLICATE KEY UPDATE -> ON CONFLICT ... DO UPDATE (needs manual handling)
    // LIMIT with OFFSET syntax is same
    // Remove engine specification
    .replace(/ENGINE\s*=\s*\w+/gi, '')
    .replace(/DEFAULT\s+CHARSET\s*=\s*\w+/gi, '')
    .replace(/COLLATE\s*=?\s*\w+/gi, '');

  return converted;
}

// Convert ENUM to CHECK constraint for PostgreSQL
function createEnumConstraint(columnName, values) {
  const valuesStr = values.map(v => `'${v}'`).join(', ');
  return `CHECK (${columnName} IN (${valuesStr}))`;
}

function getPool() {
  if (!pgPool) {
    throw new Error('Database pool not initialized. Call initDatabase() first.');
  }
  return pgPool;
}

function getSupabase() {
  if (!supabase) {
    initSupabaseClient();
  }
  return supabase;
}

async function closePool() {
  if (pgPool) {
    await pgPool.end();
    pgPool = null;
    console.log('PostgreSQL pool closed');
  }
}

module.exports = {
  initDatabase,
  getPool,
  getSupabase,
  closePool,
  initSupabaseClient,
  convertToPostgresQuery,
  createEnumConstraint
};
