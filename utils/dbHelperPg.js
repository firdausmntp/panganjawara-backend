// PostgreSQL version of dbHelper - Compatible with Supabase
// All queries use PostgreSQL syntax

const bcrypt = require('bcryptjs');

// Membuat tabel users (admin) - PostgreSQL version
async function createUsersTable(db) {
  const query = `
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username VARCHAR(50) UNIQUE NOT NULL,
      email VARCHAR(100) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      role VARCHAR(20) DEFAULT 'admin' CHECK (role IN ('admin', 'superadmin')),
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP,
      last_login TIMESTAMP
    )
  `;
  
  try {
    await db.execute(query);
    console.log('Users table created or already exists');
    
    // Create default admin if not exists
    const [existingAdmin] = await db.execute('SELECT id FROM users WHERE username = $1', ['admin']);
    if (existingAdmin.length === 0) {
      const hashedPassword = await bcrypt.hash('admin123', 10);
      await db.execute(
        'INSERT INTO users (username, email, password, role, created_at) VALUES ($1, $2, $3, $4, NOW())',
        ['admin', 'admin@example.com', hashedPassword, 'admin']
      );
      console.log('Default admin user created (username: admin, password: admin123)');
    }
  } catch (error) {
    console.error('Error creating users table:', error);
  }
}

// Membuat tabel posts
async function createPostsTable(db) {
  const query = `
    CREATE TABLE IF NOT EXISTS posts (
      id SERIAL PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      content TEXT NOT NULL,
      author VARCHAR(100) NOT NULL,
      image_count INT DEFAULT 0,
      view_count INT DEFAULT 0,
      like_count INT DEFAULT 0,
      share_count INT DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP
    )
  `;
  
  try {
    await db.execute(query);
    console.log('Posts table created or already exists');
  } catch (error) {
    console.error('Error creating posts table:', error);
  }
}

// Membuat tabel comments
async function createCommentsTable(db) {
  const query = `
    CREATE TABLE IF NOT EXISTS comments (
      id SERIAL PRIMARY KEY,
      post_id INT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
      author VARCHAR(100) NOT NULL,
      content TEXT NOT NULL,
      image_count INT DEFAULT 0,
      like_count INT DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP
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
      id SERIAL PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      content TEXT NOT NULL,
      excerpt TEXT,
      author VARCHAR(100) NOT NULL,
      status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
      image_count INT DEFAULT 0,
      view_count INT DEFAULT 0,
      like_count INT DEFAULT 0,
      featured BOOLEAN DEFAULT FALSE,
      tags TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP,
      published_at TIMESTAMP
    )
  `;
  
  try {
    await db.execute(query);
    console.log('Articles table created or already exists');
  } catch (error) {
    console.error('Error creating articles table:', error);
  }
}

// Membuat tabel videos
async function createVideosTable(db) {
  const query = `
    CREATE TABLE IF NOT EXISTS videos (
      id SERIAL PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      description TEXT,
      author VARCHAR(100) NOT NULL,
      status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
      tags TEXT,
      youtube_url VARCHAR(500) NOT NULL,
      youtube_video_id VARCHAR(20),
      thumbnail_url VARCHAR(500),
      duration VARCHAR(20),
      view_count INT DEFAULT 0,
      like_count INT DEFAULT 0,
      featured BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP,
      published_at TIMESTAMP
    )
  `;
  
  try {
    await db.execute(query);
    
    // Create indexes
    await db.execute('CREATE INDEX IF NOT EXISTS idx_videos_status ON videos (status)').catch(() => {});
    await db.execute('CREATE INDEX IF NOT EXISTS idx_videos_featured ON videos (featured)').catch(() => {});
    await db.execute('CREATE INDEX IF NOT EXISTS idx_videos_created ON videos (created_at)').catch(() => {});
    
    console.log('Videos table created or already exists');
  } catch (error) {
    console.error('Error creating videos table:', error);
  }
}

// Membuat tabel events
async function createEventsTable(db) {
  const query = `
    CREATE TABLE IF NOT EXISTS events (
      id SERIAL PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      description TEXT,
      event_date TIMESTAMP NOT NULL,
      duration_minutes INT DEFAULT 60,
      location VARCHAR(255),
      zoom_link VARCHAR(500),
      zoom_meeting_id VARCHAR(100),
      zoom_password VARCHAR(100),
      max_participants INT,
      current_participants INT DEFAULT 0,
      status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'cancelled', 'completed')),
      priority VARCHAR(20) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
      created_by VARCHAR(100) NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP,
      published_at TIMESTAMP
    )
  `;
  
  try {
    await db.execute(query);
    
    // Create indexes
    await db.execute('CREATE INDEX IF NOT EXISTS idx_events_status ON events (status)').catch(() => {});
    await db.execute('CREATE INDEX IF NOT EXISTS idx_events_date ON events (event_date)').catch(() => {});
    await db.execute('CREATE INDEX IF NOT EXISTS idx_events_priority ON events (priority)').catch(() => {});
    
    console.log('Events table created or already exists');
  } catch (error) {
    console.error('Error creating events table:', error);
  }
}

// Membuat tabel images
async function createImagesTable(db) {
  const query = `
    CREATE TABLE IF NOT EXISTS images (
      id SERIAL PRIMARY KEY,
      entity_type VARCHAR(20) NOT NULL CHECK (entity_type IN ('post', 'comment', 'article', 'event')),
      entity_id INT NOT NULL,
      filename VARCHAR(255) NOT NULL,
      original_name VARCHAR(255) NOT NULL,
      mimetype VARCHAR(100) NOT NULL,
      size INT NOT NULL,
      path VARCHAR(500) NOT NULL,
      storage_type VARCHAR(20) DEFAULT 'local' CHECK (storage_type IN ('local', 'supabase', 's3')),
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `;
  
  try {
    await db.execute(query);
    await db.execute('CREATE INDEX IF NOT EXISTS idx_images_entity ON images (entity_type, entity_id)').catch(() => {});
    console.log('Images table created or already exists');
  } catch (error) {
    console.error('Error creating images table:', error);
  }
}

// Membuat tabel statistics
async function createStatisticsTable(db) {
  const query = `
    CREATE TABLE IF NOT EXISTS statistics (
      id SERIAL PRIMARY KEY,
      entity_type VARCHAR(20) NOT NULL CHECK (entity_type IN ('post', 'comment', 'article', 'video', 'event')),
      entity_id INT NOT NULL,
      action VARCHAR(50) NOT NULL,
      ip_address VARCHAR(45),
      user_agent TEXT,
      country VARCHAR(10),
      city VARCHAR(100),
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `;
  
  try {
    await db.execute(query);
    await db.execute('CREATE INDEX IF NOT EXISTS idx_stats_entity ON statistics (entity_type, entity_id)').catch(() => {});
    await db.execute('CREATE INDEX IF NOT EXISTS idx_stats_action ON statistics (action)').catch(() => {});
    await db.execute('CREATE INDEX IF NOT EXISTS idx_stats_date ON statistics (created_at)').catch(() => {});
    console.log('Statistics table created or already exists');
  } catch (error) {
    console.error('Error creating statistics table:', error);
  }
}

// Membuat tabel wilayah
async function createWilayahTable(db) {
  const query = `
    CREATE TABLE IF NOT EXISTS wilayah (
      kode VARCHAR(13) PRIMARY KEY,
      nama VARCHAR(100) NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `;
  
  try {
    await db.execute(query);
    await db.execute('CREATE INDEX IF NOT EXISTS idx_wilayah_nama ON wilayah (nama)').catch(() => {});
    console.log('Wilayah table created or already exists');
  } catch (error) {
    console.error('Error creating wilayah table:', error);
  }
}

// Tabel penggunaan API key per hari
async function createApiKeyUsageTable(db) {
  const query = `
    CREATE TABLE IF NOT EXISTS api_key_usage (
      api_key VARCHAR(100) NOT NULL,
      usage_date DATE NOT NULL,
      usage_count INT NOT NULL DEFAULT 0,
      last_used_at TIMESTAMP,
      PRIMARY KEY (api_key, usage_date)
    )
  `;
  
  try {
    await db.execute(query);
    await db.execute('CREATE INDEX IF NOT EXISTS idx_api_usage_date ON api_key_usage (usage_date)').catch(() => {});
    console.log('api_key_usage table created or already exists');
  } catch (error) {
    console.error('Error creating api_key_usage table:', error);
  }
}

// Ambil usage saat ini untuk daftar key
async function getApiKeyUsages(db, apiKeys) {
  if (!apiKeys || apiKeys.length === 0) return {};
  const today = new Date().toISOString().slice(0, 10);
  
  // Build PostgreSQL placeholders ($1, $2, etc.)
  const placeholders = apiKeys.map((_, i) => `$${i + 2}`).join(',');
  const [rows] = await db.execute(
    `SELECT api_key, usage_count FROM api_key_usage WHERE usage_date = $1 AND api_key IN (${placeholders})`,
    [today, ...apiKeys]
  );
  
  const map = {};
  for (const r of rows) map[r.api_key] = r.usage_count;
  return map;
}

// Increment usage untuk key tertentu (atomic upsert) - PostgreSQL version
async function incrementApiKeyUsage(db, apiKey) {
  const today = new Date().toISOString().slice(0, 10);
  
  // PostgreSQL UPSERT syntax using ON CONFLICT
  await db.execute(
    `INSERT INTO api_key_usage (api_key, usage_date, usage_count, last_used_at) 
     VALUES ($1, $2, 1, NOW())
     ON CONFLICT (api_key, usage_date) 
     DO UPDATE SET usage_count = api_key_usage.usage_count + 1, last_used_at = NOW()`,
    [apiKey, today]
  );
}

// Pilih key yang masih tersedia
async function pickAvailableApiKey(db, apiKeys, dailyLimit = 1000) {
  const usageMap = await getApiKeyUsages(db, apiKeys);
  const candidates = apiKeys.map(k => ({ key: k, count: usageMap[k] || 0 }));
  candidates.sort((a, b) => a.count - b.count);
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
