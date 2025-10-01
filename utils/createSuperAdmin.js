// Superadmin Creation Utility
// Run this file to create a new superadmin user

const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');

async function createSuperAdmin() {
  try {
    console.log('🔧 Creating Superadmin User: josski\n');

    // Superadmin credentials
    const username = 'josski';
    const email = 'josski@fsu.my.id';
    const password = 'Oke12345';
    const role = 'superadmin'; // Set as superadmin

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Connect to database
    const db = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'expressjs_db',
      port: parseInt(process.env.DB_PORT || '3306', 10)
    });

    // Check if username already exists
    const [existingUser] = await db.execute('SELECT id FROM users WHERE username = ?', [username]);
    if (existingUser.length > 0) {
      console.log('❌ Username already exists!');
      await db.end();
      process.exit(1);
    }

    // Create superadmin user
    const [result] = await db.execute(
      'INSERT INTO users (username, email, password, role, created_at, updated_at) VALUES (?, ?, ?, ?, current_timestamp(), current_timestamp())',
      [username, email, hashedPassword, role]
    );

    console.log('\n✅ Superadmin user created successfully!');
    console.log(`👤 Username: ${username}`);
    console.log(`🔐 Password: ${password}`);
    console.log(`👑 Role: ${role}`);
    console.log(`🆔 User ID: ${result.insertId}`);
    
    await db.end();
    
  } catch (error) {
    console.error('❌ Error creating superadmin:', error.message);
  }
}

// Run if called directly
if (require.main === module) {
  createSuperAdmin();
}

module.exports = createSuperAdmin;
