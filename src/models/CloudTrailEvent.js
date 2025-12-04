const db = require('./database');

class CloudTrailEvent {
  static getAll(filters = {}) {
    let query = 'SELECT * FROM cloudtrail_events WHERE 1=1';
    const params = [];

    if (filters.event_name) {
      query += ' AND event_name LIKE ?';
      params.push(`%${filters.event_name}%`);
    }

    if (filters.workspace_id) {
      query += ' AND workspace_id = ?';
      params.push(filters.workspace_id);
    }

    if (filters.event_from) {
      query += ' AND event_time >= ?';
      params.push(filters.event_from);
    }

    if (filters.event_to) {
      query += ' AND event_time <= ?';
      params.push(filters.event_to);
    }

    if (filters.event_source) {
      query += ' AND event_source = ?';
      params.push(filters.event_source);
    }

    query += ' ORDER BY event_time DESC';

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
      SELECT * FROM cloudtrail_events 
      WHERE workspace_id = ? 
      ORDER BY event_time DESC
    `).all(workspaceId);
  }

  static insert(event) {
    const stmt = db.prepare(`
      INSERT OR IGNORE INTO cloudtrail_events (
        event_id, event_name, event_time, event_source, aws_region,
        source_ip_address, user_identity, request_parameters,
        response_elements, workspace_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    return stmt.run(
      event.event_id,
      event.event_name,
      event.event_time,
      event.event_source,
      event.aws_region,
      event.source_ip_address,
      JSON.stringify(event.user_identity || {}),
      JSON.stringify(event.request_parameters || {}),
      JSON.stringify(event.response_elements || {}),
      event.workspace_id
    );
  }

  static getEventNames() {
    return db.prepare('SELECT DISTINCT event_name FROM cloudtrail_events ORDER BY event_name').all();
  }
}

module.exports = CloudTrailEvent;
