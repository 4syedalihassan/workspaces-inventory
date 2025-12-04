const db = require('./database');

class Workspace {
  static getAll(filters = {}) {
    let query = 'SELECT * FROM workspaces WHERE 1=1';
    const params = [];

    if (filters.user_name) {
      query += ' AND user_name LIKE ?';
      params.push(`%${filters.user_name}%`);
    }

    if (filters.state) {
      query += ' AND state = ?';
      params.push(filters.state);
    }

    if (filters.bundle_id) {
      query += ' AND bundle_id = ?';
      params.push(filters.bundle_id);
    }

    if (filters.running_mode) {
      query += ' AND running_mode = ?';
      params.push(filters.running_mode);
    }

    if (filters.created_from) {
      query += ' AND created_at >= ?';
      params.push(filters.created_from);
    }

    if (filters.created_to) {
      query += ' AND created_at <= ?';
      params.push(filters.created_to);
    }

    if (filters.terminated) {
      if (filters.terminated === 'true') {
        query += ' AND terminated_at IS NOT NULL';
      } else {
        query += ' AND terminated_at IS NULL';
      }
    }

    query += ' ORDER BY created_at DESC';

    if (filters.limit) {
      query += ' LIMIT ?';
      params.push(parseInt(filters.limit, 10));
    }

    if (filters.offset) {
      query += ' OFFSET ?';
      params.push(parseInt(filters.offset, 10));
    }

    return db.prepare(query).all(...params);
  }

  static getById(id) {
    return db.prepare('SELECT * FROM workspaces WHERE id = ?').get(id);
  }

  static upsert(workspace) {
    const stmt = db.prepare(`
      INSERT INTO workspaces (
        id, directory_id, user_name, ip_address, state, bundle_id,
        subnet_id, computer_name, running_mode, running_mode_auto_stop_timeout_in_minutes,
        root_volume_size_gib, user_volume_size_gib, created_at, terminated_at,
        last_known_user_connection_timestamp, tags, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(id) DO UPDATE SET
        directory_id = excluded.directory_id,
        user_name = excluded.user_name,
        ip_address = excluded.ip_address,
        state = excluded.state,
        bundle_id = excluded.bundle_id,
        subnet_id = excluded.subnet_id,
        computer_name = excluded.computer_name,
        running_mode = excluded.running_mode,
        running_mode_auto_stop_timeout_in_minutes = excluded.running_mode_auto_stop_timeout_in_minutes,
        root_volume_size_gib = excluded.root_volume_size_gib,
        user_volume_size_gib = excluded.user_volume_size_gib,
        terminated_at = excluded.terminated_at,
        last_known_user_connection_timestamp = excluded.last_known_user_connection_timestamp,
        tags = excluded.tags,
        updated_at = CURRENT_TIMESTAMP
    `);

    return stmt.run(
      workspace.id,
      workspace.directory_id,
      workspace.user_name,
      workspace.ip_address,
      workspace.state,
      workspace.bundle_id,
      workspace.subnet_id,
      workspace.computer_name,
      workspace.running_mode,
      workspace.running_mode_auto_stop_timeout_in_minutes,
      workspace.root_volume_size_gib,
      workspace.user_volume_size_gib,
      workspace.created_at,
      workspace.terminated_at,
      workspace.last_known_user_connection_timestamp,
      JSON.stringify(workspace.tags || {})
    );
  }

  static getCount(filters = {}) {
    let query = 'SELECT COUNT(*) as count FROM workspaces WHERE 1=1';
    const params = [];

    if (filters.user_name) {
      query += ' AND user_name LIKE ?';
      params.push(`%${filters.user_name}%`);
    }

    if (filters.state) {
      query += ' AND state = ?';
      params.push(filters.state);
    }

    if (filters.bundle_id) {
      query += ' AND bundle_id = ?';
      params.push(filters.bundle_id);
    }

    if (filters.running_mode) {
      query += ' AND running_mode = ?';
      params.push(filters.running_mode);
    }

    return db.prepare(query).get(...params);
  }

  static getStates() {
    return db.prepare('SELECT DISTINCT state FROM workspaces WHERE state IS NOT NULL').all();
  }

  static getBundles() {
    return db.prepare('SELECT DISTINCT bundle_id FROM workspaces WHERE bundle_id IS NOT NULL').all();
  }

  static getRunningModes() {
    return db.prepare('SELECT DISTINCT running_mode FROM workspaces WHERE running_mode IS NOT NULL').all();
  }
}

module.exports = Workspace;
