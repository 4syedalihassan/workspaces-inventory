const db = require('./database');
const bcrypt = require('bcryptjs');

class User {
  static init() {
    // Create users table
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'USER',
        last_login TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    `);

    // Create default admin user if no users exist
    const count = db.prepare('SELECT COUNT(*) as count FROM users').get();
    if (count.count === 0) {
      const defaultPassword = process.env.DEFAULT_ADMIN_PASSWORD || 'Admin@2024';
      console.log('Creating default admin user...');
      console.warn('WARNING: Using default admin credentials. Change the password immediately after first login!');
      this.create({
        username: 'admin',
        email: 'admin@workspaces-inventory.local',
        password: defaultPassword,
        role: 'ADMIN'
      });
      console.log('Default admin user created: username=admin, password=******');
      console.log('IMPORTANT: Change the admin password immediately!');
    }
  }

  static create({ username, email, password, role = 'USER' }) {
    const passwordHash = bcrypt.hashSync(password, 10);
    const stmt = db.prepare(`
      INSERT INTO users (username, email, password_hash, role)
      VALUES (?, ?, ?, ?)
    `);
    
    try {
      const result = stmt.run(username, email, passwordHash, role);
      return this.findById(result.lastInsertRowid);
    } catch (error) {
      if (error.message.includes('UNIQUE constraint failed')) {
        throw new Error('Username or email already exists');
      }
      throw error;
    }
  }

  static findById(id) {
    const stmt = db.prepare('SELECT * FROM users WHERE id = ?');
    return stmt.get(id);
  }

  static findByUsername(username) {
    const stmt = db.prepare('SELECT * FROM users WHERE username = ?');
    return stmt.get(username);
  }

  static findByEmail(email) {
    const stmt = db.prepare('SELECT * FROM users WHERE email = ?');
    return stmt.get(email);
  }

  static getAll() {
    const stmt = db.prepare('SELECT id, username, email, role, last_login, created_at FROM users ORDER BY created_at DESC');
    return stmt.all();
  }

  static validatePassword(plainPassword, passwordHash) {
    return bcrypt.compareSync(plainPassword, passwordHash);
  }

  static updateLastLogin(userId) {
    const stmt = db.prepare('UPDATE users SET last_login = ? WHERE id = ?');
    stmt.run(new Date().toISOString(), userId);
  }

  static updatePassword(userId, newPassword) {
    const passwordHash = bcrypt.hashSync(newPassword, 10);
    const stmt = db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?');
    stmt.run(passwordHash, new Date().toISOString(), userId);
  }

  static delete(userId) {
    const stmt = db.prepare('DELETE FROM users WHERE id = ?');
    return stmt.run(userId);
  }

  static getSafeUser(user) {
    if (!user) return null;
    const { password_hash, ...safeUser } = user;
    return safeUser;
  }
}

// Initialize the table and create default admin
User.init();

module.exports = User;
