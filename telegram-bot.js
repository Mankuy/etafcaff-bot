const TelegramBot = require('node-telegram-bot-api');
const {
  addTransaction,
  getBalance,
  getRecentTransactions,
  getSummaryByCategory
} = require('./db');

const token = process.env.TELEGRAM_BOT_TOKEN;
const CURRENCY = process.env.CURRENCY || '$';
const WEBHOOK_URL = process.env.WEBHOOK_URL; // e.g., https://your-app.railway.app

if (!token || token === 'tu_token_aqui') {
  console.log('⚠️  TELEGRAM_BOT_TOKEN no configurado. Bot deshabilitado.');
  module.exports = null;
  return;
}

// Use webhook in production, polling in development
let bot;
if (WEBHOOK_URL) {
  bot = new TelegramBot(token);
  bot.setWebHook(`${WEBHOOK_URL}/bot${token}`);
  console.log(`🌐 Bot en modo Webhook: ${WEBHOOK_URL}`);
} else {
  bot = new TelegramBot(token, { polling: true });
  console.log('📡 Bot en modo Polling (local)');
}

// Format number with thousands separator
function formatMoney(amount) {
  return `${CURRENCY}${amount.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ─── /start ──────────────────────────────────────────────────
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId,
    `💰 *¡Bienvenido al Bot de Finanzas!*\n\n` +
    `Comandos disponibles:\n\n` +
    `📥 /ingreso \\<monto\\> \\<descripción\\> \\[categoría\\]\n` +
    `_Registrar un ingreso_\n\n` +
    `📤 /gasto \\<monto\\> \\<descripción\\> \\[categoría\\]\n` +
    `_Registrar un gasto_\n\n` +
    `💵 /balance\n` +
    `_Ver balance actual_\n\n` +
    `📋 /ultimos\n` +
    `_Ver últimos 10 movimientos_\n\n` +
    `📊 /resumen\n` +
    `_Resumen por categoría_\n\n` +
    `💡 *Ejemplo:*\n` +
    `/ingreso 50000 Cobro freelance Trabajo\n` +
    `/gasto 1500 Almuerzo Comida`,
    { parse_mode: 'MarkdownV2' }
  );
});

// ─── /ingreso ────────────────────────────────────────────────
bot.onText(/\/ingreso (.+)/, (msg, match) => {
  const chatId = msg.chat.id;
  const parts = match[1].trim().split(/\s+/);

  if (parts.length < 1) {
    return bot.sendMessage(chatId, '❌ Formato: /ingreso <monto> <descripción> [categoría]');
  }

  const amount = parseFloat(parts[0]);
  if (isNaN(amount) || amount <= 0) {
    return bot.sendMessage(chatId, '❌ El monto debe ser un número mayor a 0');
  }

  // Last word could be category if there are 3+ parts
  let description, category;
  if (parts.length >= 3) {
    category = parts[parts.length - 1];
    description = parts.slice(1, -1).join(' ');
  } else {
    description = parts.slice(1).join(' ') || 'Ingreso';
    category = 'General';
  }

  try {
    const tx = addTransaction({
      type: 'ingreso',
      amount,
      description,
      category,
      date: new Date().toISOString().split('T')[0]
    });

    const balance = getBalance();

    bot.sendMessage(chatId,
      `✅ *Ingreso registrado*\n\n` +
      `💵 Monto: ${formatMoney(amount)}\n` +
      `📝 Descripción: ${description}\n` +
      `🏷️ Categoría: ${category}\n\n` +
      `💰 Balance actual: *${formatMoney(balance.balance)}*`,
      { parse_mode: 'Markdown' }
    );
  } catch (err) {
    bot.sendMessage(chatId, `❌ Error: ${err.message}`);
  }
});

// ─── /gasto ──────────────────────────────────────────────────
bot.onText(/\/gasto (.+)/, (msg, match) => {
  const chatId = msg.chat.id;
  const parts = match[1].trim().split(/\s+/);

  if (parts.length < 1) {
    return bot.sendMessage(chatId, '❌ Formato: /gasto <monto> <descripción> [categoría]');
  }

  const amount = parseFloat(parts[0]);
  if (isNaN(amount) || amount <= 0) {
    return bot.sendMessage(chatId, '❌ El monto debe ser un número mayor a 0');
  }

  let description, category;
  if (parts.length >= 3) {
    category = parts[parts.length - 1];
    description = parts.slice(1, -1).join(' ');
  } else {
    description = parts.slice(1).join(' ') || 'Gasto';
    category = 'General';
  }

  try {
    const tx = addTransaction({
      type: 'egreso',
      amount,
      description,
      category,
      date: new Date().toISOString().split('T')[0]
    });

    const balance = getBalance();

    bot.sendMessage(chatId,
      `✅ *Gasto registrado*\n\n` +
      `💸 Monto: ${formatMoney(amount)}\n` +
      `📝 Descripción: ${description}\n` +
      `🏷️ Categoría: ${category}\n\n` +
      `💰 Balance actual: *${formatMoney(balance.balance)}*`,
      { parse_mode: 'Markdown' }
    );
  } catch (err) {
    bot.sendMessage(chatId, `❌ Error: ${err.message}`);
  }
});

// ─── /balance ────────────────────────────────────────────────
bot.onText(/\/balance/, (msg) => {
  const chatId = msg.chat.id;

  try {
    const b = getBalance();

    const balanceEmoji = b.balance >= 0 ? '🟢' : '🔴';

    bot.sendMessage(chatId,
      `💰 *Balance Actual*\n\n` +
      `📥 Ingresos: ${formatMoney(b.ingresos)}\n` +
      `📤 Egresos: ${formatMoney(b.egresos)}\n` +
      `━━━━━━━━━━━━━━━\n` +
      `${balanceEmoji} *Saldo: ${formatMoney(b.balance)}*`,
      { parse_mode: 'Markdown' }
    );
  } catch (err) {
    bot.sendMessage(chatId, `❌ Error: ${err.message}`);
  }
});

// ─── /ultimos ────────────────────────────────────────────────
bot.onText(/\/ultimos/, (msg) => {
  const chatId = msg.chat.id;

  try {
    const transactions = getRecentTransactions(10);

    if (transactions.length === 0) {
      return bot.sendMessage(chatId, '📭 No hay movimientos registrados aún.');
    }

    let text = '📋 *Últimos Movimientos*\n\n';

    transactions.forEach((tx, i) => {
      const emoji = tx.type === 'ingreso' ? '📥' : '📤';
      const sign = tx.type === 'ingreso' ? '+' : '-';
      text += `${emoji} ${sign}${formatMoney(tx.amount)}\n`;
      text += `    _${tx.description}_ · ${tx.category} · ${tx.date}\n\n`;
    });

    bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
  } catch (err) {
    bot.sendMessage(chatId, `❌ Error: ${err.message}`);
  }
});

// ─── /resumen ────────────────────────────────────────────────
bot.onText(/\/resumen/, (msg) => {
  const chatId = msg.chat.id;

  try {
    const summary = getSummaryByCategory();
    const balance = getBalance();

    if (summary.length === 0) {
      return bot.sendMessage(chatId, '📭 No hay movimientos registrados aún.');
    }

    let text = '📊 *Resumen por Categoría*\n\n';

    summary.forEach((cat) => {
      const bar = '█'.repeat(Math.min(Math.ceil(cat.total_gastos / (balance.egresos || 1) * 10), 10));
      text += `🏷️ *${cat.category}*\n`;
      if (cat.total_gastos > 0) text += `   📤 Gastos: ${formatMoney(cat.total_gastos)}\n`;
      if (cat.total_ingresos > 0) text += `   📥 Ingresos: ${formatMoney(cat.total_ingresos)}\n`;
      text += `   ${bar} (${cat.count} mov.)\n\n`;
    });

    text += `━━━━━━━━━━━━━━━\n`;
    text += `💰 *Balance: ${formatMoney(balance.balance)}*`;

    bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
  } catch (err) {
    bot.sendMessage(chatId, `❌ Error: ${err.message}`);
  }
});

module.exports = bot;
