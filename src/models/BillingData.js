const db = require('./database');

class BillingData {
  static getAll(filters = {}) {
    let query = `
      SELECT bd.*, w.user_name, w.bundle_id
      FROM billing_data bd
      LEFT JOIN workspaces w ON bd.workspace_id = w.id
      WHERE 1=1
    `;
    const params = [];

    if (filters.workspace_id) {
      query += ' AND bd.workspace_id = ?';
      params.push(filters.workspace_id);
    }

    if (filters.service) {
      query += ' AND bd.service = ?';
      params.push(filters.service);
    }

    if (filters.start_date) {
      query += ' AND bd.start_date >= ?';
      params.push(filters.start_date);
    }

    if (filters.end_date) {
      query += ' AND bd.end_date <= ?';
      params.push(filters.end_date);
    }

    if (filters.user_name) {
      query += ' AND w.user_name LIKE ?';
      params.push(`%${filters.user_name}%`);
    }

    query += ' ORDER BY bd.start_date DESC';

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

  static upsert(billing) {
    const stmt = db.prepare(`
      INSERT INTO billing_data (
        workspace_id, service, usage_type, start_date, end_date,
        amount, unit, currency
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(workspace_id, service, usage_type, start_date, end_date) DO UPDATE SET
        amount = excluded.amount,
        unit = excluded.unit,
        currency = excluded.currency
    `);

    return stmt.run(
      billing.workspace_id,
      billing.service,
      billing.usage_type,
      billing.start_date,
      billing.end_date,
      billing.amount,
      billing.unit,
      billing.currency || 'USD'
    );
  }

  static getMonthlySummary(startDate, endDate) {
    return db.prepare(`
      SELECT 
        service,
        SUM(amount) as total_amount,
        currency
      FROM billing_data
      WHERE start_date >= ? AND end_date <= ?
      GROUP BY service, currency
      ORDER BY total_amount DESC
    `).all(startDate, endDate);
  }

  static getServices() {
    return db.prepare('SELECT DISTINCT service FROM billing_data ORDER BY service').all();
  }
}

module.exports = BillingData;
