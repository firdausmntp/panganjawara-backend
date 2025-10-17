// Fungsi utilitas untuk database operations

// Membuat tabel users (admin)
async function createUsersTable(db) {
  const query = `
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(50) UNIQUE NOT NULL,
      email VARCHAR(100) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      role ENUM('admin') DEFAULT 'admin',
      created_at DATETIME NOT NULL,
      updated_at DATETIME,
      last_login DATETIME
    )
  `;
  
  try {
    await db.execute(query);
    console.log('Users table created or already exists');
    
    // Create default admin if not exists
    const [existingAdmin] = await db.execute('SELECT id FROM users WHERE username = ?', ['admin']);
    if (existingAdmin.length === 0) {
      const bcrypt = require('bcryptjs');
      const hashedPassword = await bcrypt.hash('admin123', 10);
      await db.execute(
        'INSERT INTO users (username, email, password, role, created_at) VALUES (?, ?, ?, ?, NOW())',
        ['admin', 'admin@example.com', hashedPassword, 'admin']
      );
      console.log('Default admin user created (username: admin, password: admin123)');
    }
  } catch (error) {
    console.error('Error creating users table:', error);
  }
}

// Membuat tabel posts jika belum ada
async function createPostsTable(db) {
  const query = `
    CREATE TABLE IF NOT EXISTS posts (
      id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      content TEXT NOT NULL,
      author VARCHAR(100) NOT NULL,
      image_count INT DEFAULT 0,
      view_count INT DEFAULT 0,
      created_at DATETIME NOT NULL,
      updated_at DATETIME
    )
  `;
  
  try {
    await db.execute(query);
    console.log('Posts table created or already exists');
  } catch (error) {
    console.error('Error creating posts table:', error);
  }
}

// Membuat tabel comments jika belum ada
async function createCommentsTable(db) {
  const query = `
    CREATE TABLE IF NOT EXISTS comments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      post_id INT NOT NULL,
      author VARCHAR(100) NOT NULL,
      content TEXT NOT NULL,
      image_count INT DEFAULT 0,
      created_at DATETIME NOT NULL,
      updated_at DATETIME,
      FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
    )
  `;
  
  try {
    await db.execute(query);
    console.log('Comments table created or already exists');
  } catch (error) {
    console.error('Error creating comments table:', error);
  }
}

// Membuat tabel articles
async function createArticlesTable(db) {
  const query = `
    CREATE TABLE IF NOT EXISTS articles (
      id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      content LONGTEXT NOT NULL,
      excerpt TEXT,
      author VARCHAR(100) NOT NULL,
      status ENUM('draft', 'published', 'archived') DEFAULT 'draft',
      image_count INT DEFAULT 0,
      view_count INT DEFAULT 0,
      featured BOOLEAN DEFAULT FALSE,
      tags TEXT,
      created_at DATETIME NOT NULL,
      updated_at DATETIME,
      published_at DATETIME
    )
  `;
  
  try {
    await db.execute(query);
    console.log('Articles table created or already exists');
  } catch (error) {
    console.error('Error creating articles table:', error);
  }
}

// Membuat tabel videos untuk menyimpan video YouTube (admin only)
async function createVideosTable(db) {
  const query = `
    CREATE TABLE IF NOT EXISTS videos (
      id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      description LONGTEXT,
      author VARCHAR(100) NOT NULL,
      status ENUM('draft', 'published', 'archived') DEFAULT 'draft',
      tags TEXT,
      youtube_url VARCHAR(500) NOT NULL,
      youtube_video_id VARCHAR(20),
      thumbnail_url VARCHAR(500),
      duration VARCHAR(20),
      view_count INT DEFAULT 0,
      like_count INT DEFAULT 0,
      featured BOOLEAN DEFAULT FALSE,
      created_at DATETIME NOT NULL,
      updated_at DATETIME,
      published_at DATETIME,
      INDEX idx_status (status),
      INDEX idx_featured (featured),
      INDEX idx_created (created_at),
      INDEX idx_published (published_at)
    )
  `;
  
  try {
    await db.execute(query);
    console.log('Videos table created or already exists');
  } catch (error) {
    console.error('Error creating videos table:', error);
  }
}

// Membuat tabel events untuk menyimpan event/webinar
async function createEventsTable(db) {
  const query = `
    CREATE TABLE IF NOT EXISTS events (
      id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      description LONGTEXT,
      event_date DATETIME NOT NULL,
      duration_minutes INT DEFAULT 60,
      location VARCHAR(255),
      zoom_link VARCHAR(500),
      zoom_meeting_id VARCHAR(100),
      zoom_password VARCHAR(100),
      max_participants INT,
      current_participants INT DEFAULT 0,
      status ENUM('draft', 'published', 'cancelled', 'completed') DEFAULT 'draft',
      priority ENUM('low', 'normal', 'high', 'urgent') DEFAULT 'normal',
      created_by VARCHAR(100) NOT NULL,
      created_at DATETIME NOT NULL,
      updated_at DATETIME,
      published_at DATETIME,
      INDEX idx_status (status),
      INDEX idx_event_date (event_date),
      INDEX idx_priority (priority),
      INDEX idx_created (created_at)
    )
  `;
  
  try {
    await db.execute(query);
    console.log('Events table created or already exists');
  } catch (error) {
    console.error('Error creating events table:', error);
  }
}

// Membuat tabel images untuk menyimpan semua gambar
async function createImagesTable(db) {
  const query = `
    CREATE TABLE IF NOT EXISTS images (
      id INT AUTO_INCREMENT PRIMARY KEY,
      entity_type ENUM('post', 'comment', 'article', 'event') NOT NULL,
      entity_id INT NOT NULL,
      filename VARCHAR(255) NOT NULL,
      original_name VARCHAR(255) NOT NULL,
      mimetype VARCHAR(100) NOT NULL,
      size INT NOT NULL,
      path VARCHAR(500) NOT NULL,
      created_at DATETIME NOT NULL,
      INDEX idx_entity (entity_type, entity_id)
    )
  `;
  
  try {
    await db.execute(query);
    console.log('Images table created or already exists');
  } catch (error) {
    console.error('Error creating images table:', error);
  }
}

// Membuat tabel statistics untuk analitik
async function createStatisticsTable(db) {
  const query = `
    CREATE TABLE IF NOT EXISTS statistics (
      id INT AUTO_INCREMENT PRIMARY KEY,
      entity_type ENUM('post', 'comment', 'article', 'video', 'event') NOT NULL,
      entity_id INT NOT NULL,
      action VARCHAR(50) NOT NULL,
      ip_address VARCHAR(45),
      user_agent TEXT,
      country VARCHAR(10),
      city VARCHAR(100),
      created_at DATETIME NOT NULL,
      INDEX idx_entity_stats (entity_type, entity_id),
      INDEX idx_action (action),
      INDEX idx_date (created_at)
    )
  `;
  
  try {
    await db.execute(query);
    console.log('Statistics table created or already exists');
  } catch (error) {
    console.error('Error creating statistics table:', error);
  }
}

// Membuat tabel wilayah untuk hierarki provinsi/kabupaten/kecamatan/kelurahan
async function createWilayahTable(db) {
  const query = `
    CREATE TABLE IF NOT EXISTS wilayah (
      kode VARCHAR(13) PRIMARY KEY,
      nama VARCHAR(100) NOT NULL,
      created_at DATETIME NOT NULL
    )
  `;
  try {
    await db.execute(query);
    
    // Check if index exists before creating it
    const [indexRows] = await db.execute(`
      SELECT COUNT(*) as count 
      FROM information_schema.statistics 
      WHERE table_schema = DATABASE() 
      AND table_name = 'wilayah' 
      AND index_name = 'idx_wilayah_nama'
    `);
    
    if (indexRows[0].count === 0) {
      try {
        await db.execute('CREATE INDEX idx_wilayah_nama ON wilayah (nama)');
        console.log('Wilayah table index created');
      } catch (indexError) {
        // Only log if it's not a duplicate key error
        if (!indexError.message.includes('Duplicate key name')) {
          console.error('Error creating wilayah index:', indexError.message);
        }
      }
    }
    
    console.log('Wilayah table created or already exists');
  } catch (error) {
    console.error('Error creating wilayah table:', error);
  }
}

// Tabel penggunaan API key per hari (misal limit 1000/hari per key)
async function createApiKeyUsageTable(db) {
  const query = `
    CREATE TABLE IF NOT EXISTS api_key_usage (
      api_key VARCHAR(100) NOT NULL,
      usage_date DATE NOT NULL,
      usage_count INT NOT NULL DEFAULT 0,
      last_used_at DATETIME,
      PRIMARY KEY (api_key, usage_date),
      INDEX idx_usage_date (usage_date)
    )
  `;
  try {
    await db.execute(query);
    console.log('api_key_usage table created or already exists');
  } catch (error) {
    console.error('Error creating api_key_usage table:', error);
  }
}

// Ambil usage saat ini untuk daftar key (kembalikan map)
async function getApiKeyUsages(db, apiKeys) {
  if (!apiKeys || apiKeys.length === 0) return {};
  const today = new Date().toISOString().slice(0,10);
  const placeholders = apiKeys.map(() => '?').join(',');
  const [rows] = await db.execute(`SELECT api_key, usage_count FROM api_key_usage WHERE usage_date = ? AND api_key IN (${placeholders})`, [today, ...apiKeys]);
  const map = {};
  for (const r of rows) map[r.api_key] = r.usage_count;
  return map;
}

// Increment usage untuk key tertentu (atomic upsert)
async function incrementApiKeyUsage(db, apiKey) {
  const today = new Date().toISOString().slice(0,10);
  await db.execute(`INSERT INTO api_key_usage (api_key, usage_date, usage_count, last_used_at) VALUES (?, ?, 1, NOW())
    ON DUPLICATE KEY UPDATE usage_count = usage_count + 1, last_used_at = NOW()` , [apiKey, today]);
}

// Pilih key yang masih tersedia (< limit). Strategi: ambil usage, sort ascending, pilih pertama yg < limit.
async function pickAvailableApiKey(db, apiKeys, dailyLimit = 1000) {
  const usageMap = await getApiKeyUsages(db, apiKeys);
  // isi default 0
  const candidates = apiKeys.map(k => ({ key: k, count: usageMap[k] || 0 }));
  candidates.sort((a,b) => a.count - b.count);
  const available = candidates.find(c => c.count < dailyLimit);
  return available ? available.key : null;
}

module.exports = {
  createUsersTable,
  createPostsTable,
  createCommentsTable,
  createArticlesTable,
  createVideosTable,
  createEventsTable,
  createImagesTable,
  createStatisticsTable,
  createWilayahTable,
  createApiKeyUsageTable,
  getApiKeyUsages,
  incrementApiKeyUsage,
  pickAvailableApiKey
};