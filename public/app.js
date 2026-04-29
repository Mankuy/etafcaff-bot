// ═══════════════════════════════════════════════════
//  FINANZAS DASHBOARD - App Logic
// ═══════════════════════════════════════════════════

const API = '';

// ─── State ───────────────────────────────────────
let currentType = 'egreso';
let transactions = [];

// ─── DOM Elements ────────────────────────────────
const $ = (sel) => document.querySelector(sel);
const balanceEl = $('#balance-amount');
const balanceSubEl = $('#balance-subtitle');
const incomeEl = $('#income-amount');
const expenseEl = $('#expense-amount');
const txListEl = $('#transactions-list');
const txCountEl = $('#transaction-count');
const chartEl = $('#category-chart');
const form = $('#transaction-form');
const dateInput = $('#input-date');
const toastEl = $('#toast');
const toastIconEl = $('#toast-icon');
const toastMsgEl = $('#toast-message');
const btnSubmit = $('#btn-submit');
const btnTextEl = $('.btn-text');

// ─── Init ────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  setDefaultDate();
  setHeaderDate();
  setupTypeToggle();
  setupForm();
  loadData();
});

function setDefaultDate() {
  const today = new Date().toISOString().split('T')[0];
  dateInput.value = today;
}

function setHeaderDate() {
  const now = new Date();
  const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  const dateStr = now.toLocaleDateString('es-AR', options);
  $('#header-date').textContent = dateStr.charAt(0).toUpperCase() + dateStr.slice(1);
}

// ─── Type Toggle ─────────────────────────────────
function setupTypeToggle() {
  const btns = document.querySelectorAll('.type-btn');
  btns.forEach(btn => {
    btn.addEventListener('click', () => {
      btns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentType = btn.dataset.type;
      btnTextEl.textContent = currentType === 'egreso' ? 'Agregar Gasto' : 'Agregar Ingreso';
    });
  });
}

// ─── Form Submit ─────────────────────────────────
function setupForm() {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const amount = parseFloat($('#input-amount').value);
    const description = $('#input-description').value.trim();
    const category = $('#input-category').value;
    const date = dateInput.value;

    if (!amount || amount <= 0) return showToast('Ingresá un monto válido', '⚠️');
    if (!description) return showToast('Ingresá una descripción', '⚠️');

    btnSubmit.disabled = true;
    btnTextEl.textContent = 'Guardando...';

    try {
      const res = await fetch(`${API}/api/transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: currentType,
          amount,
          description,
          category,
          date
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Error al guardar');
      }

      form.reset();
      setDefaultDate();
      showToast(
        currentType === 'egreso' ? 'Gasto registrado' : 'Ingreso registrado',
        currentType === 'egreso' ? '📤' : '📥'
      );
      await loadData();
    } catch (err) {
      showToast(err.message, '❌');
    } finally {
      btnSubmit.disabled = false;
      btnTextEl.textContent = currentType === 'egreso' ? 'Agregar Gasto' : 'Agregar Ingreso';
    }
  });
}

// ─── Load All Data ───────────────────────────────
async function loadData() {
  try {
    const [balRes, txRes, summaryRes] = await Promise.all([
      fetch(`${API}/api/balance`),
      fetch(`${API}/api/transactions`),
      fetch(`${API}/api/summary`)
    ]);

    const balance = await balRes.json();
    const txData = await txRes.json();
    const summary = await summaryRes.json();

    transactions = txData;

    renderBalance(balance);
    renderTransactions(txData);
    renderChart(summary);
  } catch (err) {
    console.error('Error loading data:', err);
    showToast('Error al cargar datos', '❌');
  }
}

// ─── Render Balance Cards ────────────────────────
function renderBalance(data) {
  animateNumber(balanceEl, data.balance, true);
  animateNumber(incomeEl, data.ingresos);
  animateNumber(expenseEl, data.egresos);

  const pct = data.ingresos > 0
    ? Math.round((data.egresos / data.ingresos) * 100)
    : 0;
  balanceSubEl.textContent = data.ingresos > 0
    ? `Gastaste el ${pct}% de tus ingresos`
    : 'Sin ingresos registrados';

  // Color change if negative
  if (data.balance < 0) {
    balanceEl.style.background = 'linear-gradient(135deg, #f43f5e, #fb7185)';
    balanceEl.style.webkitBackgroundClip = 'text';
  } else {
    balanceEl.style.background = 'linear-gradient(135deg, #34d399, #22d3ee)';
    balanceEl.style.webkitBackgroundClip = 'text';
  }
}

function animateNumber(el, target, showSign = false) {
  const duration = 600;
  const start = performance.now();
  const from = parseFloat(el.dataset.current || '0');
  el.dataset.current = target;

  function update(now) {
    const elapsed = now - start;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = from + (target - from) * eased;

    const prefix = showSign && current < 0 ? '-$' : '$';
    const absVal = Math.abs(current);
    el.textContent = `${prefix}${absVal.toLocaleString('es-AR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;

    if (progress < 1) requestAnimationFrame(update);
  }

  requestAnimationFrame(update);
}

// ─── Render Transactions ─────────────────────────
function renderTransactions(txList) {
  txCountEl.textContent = txList.length;

  if (txList.length === 0) {
    txListEl.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📭</div>
        <p>No hay movimientos registrados</p>
        <p class="empty-hint">Agregá tu primer ingreso o gasto</p>
      </div>`;
    return;
  }

  const categoryEmojis = {
    'General': '📌', 'Comida': '🍔', 'Transporte': '🚗',
    'Servicios': '📱', 'Entretenimiento': '🎬', 'Salud': '🏥',
    'Trabajo': '💼', 'Educacion': '📚', 'Hogar': '🏠', 'Otro': '📦'
  };

  txListEl.innerHTML = txList.map(tx => {
    const emoji = tx.type === 'ingreso' ? '📥' : '📤';
    const sign = tx.type === 'ingreso' ? '+' : '-';
    const catEmoji = categoryEmojis[tx.category] || '📌';
    const dateFormatted = formatDate(tx.date);

    return `
      <div class="tx-item" data-id="${tx.id}">
        <div class="tx-type-indicator ${tx.type}">${emoji}</div>
        <div class="tx-info">
          <div class="tx-description">${escapeHtml(tx.description)}</div>
          <div class="tx-meta">
            <span>${catEmoji} ${tx.category}</span>
            <span>·</span>
            <span>${dateFormatted}</span>
          </div>
        </div>
        <div class="tx-amount ${tx.type}">${sign}$${parseFloat(tx.amount).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</div>
        <button class="tx-delete" onclick="deleteTx(${tx.id})" title="Eliminar">✕</button>
      </div>`;
  }).join('');
}

function formatDate(dateStr) {
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ─── Delete Transaction ──────────────────────────
async function deleteTx(id) {
  try {
    const res = await fetch(`${API}/api/transactions/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Error al eliminar');
    showToast('Movimiento eliminado', '🗑️');
    await loadData();
  } catch (err) {
    showToast(err.message, '❌');
  }
}

// ─── Render Category Chart ──────────────────────
function renderChart(summary) {
  const expenses = summary.filter(s => s.total_gastos > 0);

  if (expenses.length === 0) {
    chartEl.innerHTML = '<div class="chart-empty">Sin datos de gastos aún</div>';
    return;
  }

  const maxVal = Math.max(...expenses.map(s => s.total_gastos));

  const colors = [
    'linear-gradient(90deg, #f43f5e, #fb7185)',
    'linear-gradient(90deg, #6366f1, #818cf8)',
    'linear-gradient(90deg, #f59e0b, #fbbf24)',
    'linear-gradient(90deg, #8b5cf6, #a78bfa)',
    'linear-gradient(90deg, #ec4899, #f472b6)',
    'linear-gradient(90deg, #14b8a6, #2dd4bf)',
    'linear-gradient(90deg, #60a5fa, #93c5fd)',
    'linear-gradient(90deg, #f97316, #fb923c)',
  ];

  chartEl.innerHTML = expenses.map((cat, i) => {
    const pct = (cat.total_gastos / maxVal) * 100;
    const color = colors[i % colors.length];
    const formatted = `$${cat.total_gastos.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;

    return `
      <div class="chart-bar-row">
        <span class="chart-bar-label">${cat.category}</span>
        <div class="chart-bar-track">
          <div class="chart-bar-fill" style="width: ${pct}%; background: ${color};"></div>
        </div>
        <span class="chart-bar-value">${formatted}</span>
      </div>`;
  }).join('');
}

// ─── Toast ───────────────────────────────────────
function showToast(message, icon = '✅') {
  toastIconEl.textContent = icon;
  toastMsgEl.textContent = message;
  toastEl.classList.add('show');
  setTimeout(() => toastEl.classList.remove('show'), 3000);
}
