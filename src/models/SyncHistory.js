const db = require('./database');

class SyncHistory {
  static create(syncType) {
    const stmt = db.prepare(`
      INSERT INTO sync_history (sync_type, status)
      VALUES (?, 'running')
    `);
    return stmt.run(syncType);
  }

  static complete(id, recordsProcessed) {
    const stmt = db.prepare(`
      UPDATE sync_history
      SET status = 'completed', records_processed = ?, completed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    return stmt.run(recordsProcessed, id);
  }

  static fail(id, errorMessage) {
    const stmt = db.prepare(`
      UPDATE sync_history
      SET status = 'failed', error_message = ?, completed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    return stmt.run(errorMessage, id);
  }

  static getRecent(limit = 20) {
    return db.prepare(`
      SELECT * FROM sync_history
      ORDER BY started_at DESC
      LIMIT ?
    `).all(limit);
  }

  static getLastSuccessful(syncType) {
    return db.prepare(`
      SELECT * FROM sync_history
      WHERE sync_type = ? AND status = 'completed'
      ORDER BY completed_at DESC
      LIMIT 1
    `).get(syncType);
  }
}

module.exports = SyncHistory;
