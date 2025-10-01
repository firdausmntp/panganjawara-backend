// Inisialisasi connection pool MySQL dan memastikan database ada.
// Mengekspor connection pool yang dapat digunakan berulang kali tanpa error connection closed.
const mysql = require('mysql2/promise');

let pool = null;

async function initDatabase() {
  const host = process.env.DB_HOST || 'localhost';
  const user = process.env.DB_USER || 'root';
  const password = process.env.DB_PASSWORD || '';
  const database = process.env.DB_NAME || 'posting_db';
  const port = parseInt(process.env.DB_PORT || '3306', 10);

  try {
    // Buat connection pool untuk mengatasi masalah connection closed
    pool = mysql.createPool({
      host, 
      user, 
      password, 
      database, 
      port,
      // Pool configuration - only valid pool options
      connectionLimit: 15,          // Maksimal 15 koneksi aktif
      queueLimit: 0,               // Tidak ada limit antrian
      // Connection options
      connectTimeout: 60000,
      // Pool-specific options
      idleTimeout: 300000,         // 5 menit idle timeout
      maxIdle: 5,                  // Maksimal 5 idle connections
      enableKeepAlive: true,
      keepAliveInitialDelay: 0
    });

    // Test koneksi pool
    const connection = await pool.getConnection();
    console.log(`Connected to database '${database}' on ${host}:${port} with connection pool`);
    connection.release(); // Kembalikan koneksi ke pool
    
    // Monitor pool events
    pool.on('connection', function (connection) {
      console.log('New connection established as id ' + connection.threadId);
    });
    
    pool.on('error', function(err) {
      console.error('Database pool error:', err);
      if(err.code === 'PROTOCOL_CONNECTION_LOST') {
        console.log('Database connection was closed. Pool will reconnect automatically.');
      }
    });
    
    // Wrap pool dengan error handling untuk compatibility
    const poolWrapper = {
      async execute(query, params) {
        try {
          return await pool.execute(query, params);
        } catch (error) {
          console.error('Database query error:', error.message);
          // Auto retry sekali untuk connection errors
          if (error.code === 'PROTOCOL_CONNECTION_LOST' || 
              error.code === 'ECONNRESET' || 
              error.fatal) {
            console.log('Retrying query after connection error...');
            return await pool.execute(query, params);
          }
          throw error;
        }
      },
      
      async query(sql, params) {
        try {
          return await pool.query(sql, params);
        } catch (error) {
          console.error('Database query error:', error.message);
          // Auto retry sekali untuk connection errors
          if (error.code === 'PROTOCOL_CONNECTION_LOST' || 
              error.code === 'ECONNRESET' || 
              error.fatal) {
            console.log('Retrying query after connection error...');
            return await pool.query(sql, params);
          }
          throw error;
        }
      },
      
      // Pass through other pool methods
      getConnection: () => pool.getConnection(),
      end: () => pool.end(),
      on: (event, callback) => pool.on(event, callback)
    };
    
    return poolWrapper;
  } catch (err) {
    console.error('Database connection pool failed:', err);
    console.error(`Attempted connection: ${user}@${host}:${port}/${database}`);
    console.error('Make sure:');
    console.error('1. Database exists');
    console.error('2. User has correct permissions');
    console.error('3. Password is correct');
    console.error('4. Host is accessible');
    throw err;
  }
}

// Fungsi untuk mendapatkan pool instance
function getPool() {
  if (!pool) {
    throw new Error('Database pool not initialized. Call initDatabase() first.');
  }
  return pool;
}

// Fungsi untuk menutup pool dengan graceful shutdown
async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
    console.log('Database pool closed gracefully');
  }
}

module.exports = { initDatabase, getPool, closePool };