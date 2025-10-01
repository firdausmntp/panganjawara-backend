class User {
  constructor(db) {
    this.db = db;
  }

  // Membuat user baru (admin)
  async create(userData) {
    const { username, email, password, role = 'admin' } = userData;
    const query = 'INSERT INTO users (username, email, password, role, created_at) VALUES (?, ?, ?, ?, NOW())';
    const [result] = await this.db.execute(query, [username, email, password, role]);
    return result.insertId;
  }

  // Mendapatkan user berdasarkan username
  async getByUsername(username) {
    const query = 'SELECT * FROM users WHERE username = ?';
    const [rows] = await this.db.execute(query, [username]);
    return rows[0];
  }

  // Mendapatkan user berdasarkan email
  async getByEmail(email) {
    const query = 'SELECT * FROM users WHERE email = ?';
    const [rows] = await this.db.execute(query, [email]);
    return rows[0];
  }

  // Mendapatkan user berdasarkan ID
  async getById(id) {
    const query = 'SELECT id, username, email, role, created_at, updated_at, last_login FROM users WHERE id = ?';
    const [rows] = await this.db.execute(query, [id]);
    return rows[0];
  }

  // Update last login
  async updateLastLogin(id) {
    const query = 'UPDATE users SET last_login = NOW() WHERE id = ?';
    const [result] = await this.db.execute(query, [id]);
    return result.affectedRows > 0;
  }

  // Mengubah password
  async updatePassword(id, newPassword) {
    const query = 'UPDATE users SET password = ?, updated_at = NOW() WHERE id = ?';
    const [result] = await this.db.execute(query, [newPassword, id]);
    return result.affectedRows > 0;
  }

  // Get all users (admin functionality)
  async getAll() {
    const query = 'SELECT id, username, email, role, created_at, updated_at, last_login FROM users ORDER BY created_at DESC';
    const [rows] = await this.db.execute(query);
    return rows;
  }

  // Get all users with all details (superadmin functionality)
  async getAllUsers() {
    const query = 'SELECT * FROM users ORDER BY created_at DESC';
    const [rows] = await this.db.execute(query);
    return rows;
  }

  // Update user information
  async update(id, userData) {
    const { username, email, role } = userData;
    const query = 'UPDATE users SET username = ?, email = ?, role = ?, updated_at = NOW() WHERE id = ?';
    const [result] = await this.db.execute(query, [username || null, email || null, role || null, id]);
    return result.affectedRows > 0;
  }
}

module.exports = User;
