require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const {
  addTransaction,
  getAllTransactions,
  getRecentTransactions,
  deleteTransaction,
  getBalance,
  getSummaryByCategory,
  getMonthlyTotals
} = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ─── API Routes ──────────────────────────────────────────────

// Get all transactions
app.get('/api/transactions', (req, res) => {
  try {
    const transactions = getAllTransactions();
    res.json(transactions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get recent transactions
app.get('/api/transactions/recent/:limit?', (req, res) => {
  try {
    const limit = parseInt(req.params.limit) || 10;
    const transactions = getRecentTransactions(limit);
    res.json(transactions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create a transaction
app.post('/api/transactions', (req, res) => {
  try {
    const { type, amount, description, category, date } = req.body;

    if (!type || !['ingreso', 'egreso'].includes(type)) {
      return res.status(400).json({ error: 'Tipo debe ser "ingreso" o "egreso"' });
    }
    if (!amount || parseFloat(amount) <= 0) {
      return res.status(400).json({ error: 'El monto debe ser mayor a 0' });
    }

    const transaction = addTransaction({ type, amount, description, category, date });
    res.status(201).json(transaction);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete a transaction
app.delete('/api/transactions/:id', (req, res) => {
  try {
    const deleted = deleteTransaction(parseInt(req.params.id));
    if (!deleted) {
      return res.status(404).json({ error: 'Transacción no encontrada' });
    }
    res.json({ message: 'Eliminada', transaction: deleted });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get balance
app.get('/api/balance', (req, res) => {
  try {
    const balance = getBalance();
    res.json(balance);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get summary by category
app.get('/api/summary', (req, res) => {
  try {
    const summary = getSummaryByCategory();
    res.json(summary);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get monthly totals
app.get('/api/monthly', (req, res) => {
  try {
    const monthly = getMonthlyTotals();
    res.json(monthly);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ─── Start Server ────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 Servidor corriendo en http://localhost:${PORT}`);
  console.log(`📊 Dashboard disponible en http://localhost:${PORT}\n`);

  // Start Telegram bot if token is configured
  if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_BOT_TOKEN !== 'tu_token_aqui') {
    try {
      require('./telegram-bot');
      console.log('🤖 Bot de Telegram activo\n');
    } catch (err) {
      console.error('⚠️  Error al iniciar el bot de Telegram:', err.message);
    }
  } else {
    console.log('💡 Bot de Telegram deshabilitado. Configurá TELEGRAM_BOT_TOKEN en .env\n');
  }
});
