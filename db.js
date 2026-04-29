const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'data.db');
const db = new Database(dbPath);

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL CHECK(type IN ('ingreso', 'egreso')),
    amount REAL NOT NULL CHECK(amount > 0),
    description TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL DEFAULT 'General',
    date TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
  );
`);

// Prepared statements for performance
const stmts = {
  insert: db.prepare(`
    INSERT INTO transactions (type, amount, description, category, date)
    VALUES (@type, @amount, @description, @category, @date)
  `),

  getAll: db.prepare(`
    SELECT * FROM transactions ORDER BY date DESC, created_at DESC
  `),

  getRecent: db.prepare(`
    SELECT * FROM transactions ORDER BY date DESC, created_at DESC LIMIT @limit
  `),

  getById: db.prepare(`
    SELECT * FROM transactions WHERE id = ?
  `),

  deleteById: db.prepare(`
    DELETE FROM transactions WHERE id = ?
  `),

  getBalance: db.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN type = 'ingreso' THEN amount ELSE 0 END), 0) as total_ingresos,
      COALESCE(SUM(CASE WHEN type = 'egreso' THEN amount ELSE 0 END), 0) as total_egresos
    FROM transactions
  `),

  getSummaryByCategory: db.prepare(`
    SELECT
      category,
      SUM(CASE WHEN type = 'egreso' THEN amount ELSE 0 END) as total_gastos,
      SUM(CASE WHEN type = 'ingreso' THEN amount ELSE 0 END) as total_ingresos,
      COUNT(*) as count
    FROM transactions
    GROUP BY category
    ORDER BY total_gastos DESC
  `),

  getByDateRange: db.prepare(`
    SELECT * FROM transactions
    WHERE date BETWEEN @startDate AND @endDate
    ORDER BY date DESC, created_at DESC
  `),

  getMonthlyTotals: db.prepare(`
    SELECT
      strftime('%Y-%m', date) as month,
      SUM(CASE WHEN type = 'ingreso' THEN amount ELSE 0 END) as ingresos,
      SUM(CASE WHEN type = 'egreso' THEN amount ELSE 0 END) as egresos
    FROM transactions
    GROUP BY strftime('%Y-%m', date)
    ORDER BY month DESC
    LIMIT 6
  `)
};

module.exports = {
  db,
  addTransaction({ type, amount, description, category, date }) {
    const result = stmts.insert.run({
      type,
      amount: parseFloat(amount),
      description: description || '',
      category: category || 'General',
      date: date || new Date().toISOString().split('T')[0]
    });
    return { id: result.lastInsertRowid, ...stmts.getById.get(result.lastInsertRowid) };
  },

  getAllTransactions() {
    return stmts.getAll.all();
  },

  getRecentTransactions(limit = 10) {
    return stmts.getRecent.all({ limit });
  },

  deleteTransaction(id) {
    const tx = stmts.getById.get(id);
    if (!tx) return null;
    stmts.deleteById.run(id);
    return tx;
  },

  getBalance() {
    const row = stmts.getBalance.get();
    return {
      ingresos: row.total_ingresos,
      egresos: row.total_egresos,
      balance: row.total_ingresos - row.total_egresos
    };
  },

  getSummaryByCategory() {
    return stmts.getSummaryByCategory.all();
  },

  getByDateRange(startDate, endDate) {
    return stmts.getByDateRange.all({ startDate, endDate });
  },

  getMonthlyTotals() {
    return stmts.getMonthlyTotals.all();
  }
};
