const db = require('./database');

class WorkspaceUsage {
  static getAll(filters = {}) {
    let query = `
      SELECT wu.*, w.user_name, w.bundle_id, w.running_mode
      FROM workspace_usage wu
      LEFT JOIN workspaces w ON wu.workspace_id = w.id
      WHERE 1=1
    `;
    const params = [];

    if (filters.workspace_id) {
      query += ' AND wu.workspace_id = ?';
      params.push(filters.workspace_id);
    }

    if (filters.month) {
      query += ' AND wu.month = ?';
      params.push(filters.month);
    }

    if (filters.month_from) {
      query += ' AND wu.month >= ?';
      params.push(filters.month_from);
    }

    if (filters.month_to) {
      query += ' AND wu.month <= ?';
      params.push(filters.month_to);
    }

    if (filters.user_name) {
      query += ' AND w.user_name LIKE ?';
      params.push(`%${filters.user_name}%`);
    }

    query += ' ORDER BY wu.month DESC, wu.workspace_id';

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

  static getByWorkspaceId(workspaceId) {
    return db.prepare(`
      SELECT * FROM workspace_usage 
      WHERE workspace_id = ? 
      ORDER BY month DESC
    `).all(workspaceId);
  }

  static upsert(usage) {
    const stmt = db.prepare(`
      INSERT INTO workspace_usage (workspace_id, month, usage_hours, updated_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(workspace_id, month) DO UPDATE SET
        usage_hours = excluded.usage_hours,
        updated_at = CURRENT_TIMESTAMP
    `);

    return stmt.run(usage.workspace_id, usage.month, usage.usage_hours);
  }

  static getMonthlySummary(month) {
    return db.prepare(`
      SELECT 
        COUNT(DISTINCT workspace_id) as total_workspaces,
        SUM(usage_hours) as total_hours,
        AVG(usage_hours) as avg_hours
      FROM workspace_usage
      WHERE month = ?
    `).get(month);
  }
}

module.exports = WorkspaceUsage;
