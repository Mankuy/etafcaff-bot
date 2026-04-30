// ═══════════════════════════════════════════════════
//  CAJA ETAFCAFF - App Logic
// ═══════════════════════════════════════════════════

const API = '';

// ─── State ───────────────────────────────────────
let transactions = [];

// ─── DOM Elements ────────────────────────────────
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const balanceEl = $('#balance-amount');
const balanceSubEl = $('#balance-subtitle');
const incomeEl = $('#income-amount');
const expenseEl = $('#expense-amount');
const txListEl = $('#transactions-list');
const txCountEl = $('#transaction-count');
const chartEl = $('#category-chart');
const form = $('#transaction-form');
const dateInput = $('#input-date');
const btnSubmit = $('#btn-submit');
const btnTextEl = $('.btn-text');
const themeToggleBtn = $('#theme-toggle');

// ─── Init ────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  setDefaultDate();
  setHeaderDate();
  setupForm();
  loadData();
});

// ─── Theme Management ────────────────────────────
function initTheme() {
  const savedTheme = localStorage.getItem('etafcaff-theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  
  const theme = savedTheme || (prefersDark ? 'dark' : 'light');
  document.documentElement.setAttribute('data-theme', theme);

  themeToggleBtn.addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('etafcaff-theme', newTheme);
  });
}

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

// ─── Form Submit ─────────────────────────────────
function setupForm() {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const typeRadios = document.getElementsByName('tx-type');
    let currentType = 'egreso';
    for (const radio of typeRadios) {
      if (radio.checked) currentType = radio.value;
    }

    const amount = parseFloat($('#input-amount').value);
    const description = $('#input-description').value.trim();
    const category = $('#input-category').value;
    const date = dateInput.value;

    if (!amount || amount <= 0) return showToast('Ingresa un monto válido', '⚠️');
    if (!description) return showToast('Ingresa una descripción', '⚠️');

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
      btnTextEl.textContent = 'Registrar';
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
    showToast('Error de conexión', '❌');
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
  
  if (data.ingresos === 0) {
    balanceSubEl.textContent = 'Sin ingresos registrados';
  } else {
    balanceSubEl.textContent = pct > 100 
      ? `Excediste tus ingresos en un ${pct - 100}%` 
      : `Has gastado el ${pct}% de tus ingresos`;
  }

  // Update balance card style dynamically based on negative/positive
  const balanceCard = $('.balance-kpi');
  if (data.balance < 0) {
    balanceCard.style.boxShadow = 'inset 0 4px 20px rgba(244, 63, 94, 0.1)';
    balanceEl.style.background = 'linear-gradient(135deg, var(--accent-expense), #be123c)';
    balanceEl.style.webkitBackgroundClip = 'text';
  } else {
    balanceCard.style.boxShadow = 'none';
    balanceEl.style.background = 'linear-gradient(135deg, var(--text-primary), var(--text-secondary))';
    balanceEl.style.webkitBackgroundClip = 'text';
  }
}

function animateNumber(el, target, showSign = false) {
  const duration = 800; // Smoother duration
  const start = performance.now();
  const from = parseFloat(el.dataset.current || '0');
  el.dataset.current = target;

  function update(now) {
    const elapsed = now - start;
    const progress = Math.min(elapsed / duration, 1);
    // Custom easing: easeOutQuart
    const eased = 1 - Math.pow(1 - progress, 4);
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
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="1.5" style="margin-bottom: 1rem; opacity: 0.5;">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
          <line x1="3" y1="9" x2="21" y2="9"></line>
          <line x1="9" y1="21" x2="9" y2="9"></line>
        </svg>
        <p>Tu caja está vacía</p>
        <span>Registra tu primer movimiento</span>
      </div>`;
    return;
  }

  const categoryEmojis = {
    'General': '📌', 'Comida': '🍔', 'Transporte': '🚕',
    'Servicios': '📱', 'Entretenimiento': '🎬', 'Salud': '🏥',
    'Trabajo': '💼', 'Educacion': '📚', 'Hogar': '🏠', 'Otro': '📦'
  };

  txListEl.innerHTML = txList.map((tx, index) => {
    const isIncome = tx.type === 'ingreso';
    const sign = isIncome ? '+' : '-';
    const catEmoji = categoryEmojis[tx.category] || '📌';
    const dateFormatted = formatDate(tx.date);
    const delay = index * 0.05; // Staggered animation

    return `
      <div class="tx-item ${tx.type}" data-id="${tx.id}" style="animation-delay: ${delay}s">
        <div class="tx-icon-circle">${catEmoji}</div>
        <div class="tx-info">
          <div class="tx-desc">${escapeHtml(tx.description)}</div>
          <div class="tx-meta">
            <span>${tx.category}</span>
            <span>·</span>
            <span>${dateFormatted}</span>
          </div>
        </div>
        <div class="tx-amount ${tx.type}">${sign}$${parseFloat(tx.amount).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</div>
        <button class="tx-delete" onclick="deleteTx(${tx.id})" aria-label="Eliminar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
        </button>
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

window.deleteTx = async function(id) {
  if(!confirm('¿Eliminar este movimiento?')) return;
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
    chartEl.innerHTML = `
      <div class="empty-state" style="padding: 2rem;">
        <span style="color: var(--text-muted); font-size: 0.9rem;">No hay gastos registrados</span>
      </div>`;
    return;
  }

  const maxVal = Math.max(...expenses.map(s => s.total_gastos));

  // CSS variables for chart colors to adapt automatically
  const colors = [
    'var(--accent-expense)', 
    '#f59e0b', '#8b5cf6', '#14b8a6', '#ec4899', '#3b82f6'
  ];

  chartEl.innerHTML = expenses.map((cat, i) => {
    const pct = (cat.total_gastos / maxVal) * 100;
    const color = colors[i % colors.length];
    const formatted = `$${cat.total_gastos.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;

    return `
      <div class="chart-bar-row">
        <span class="chart-bar-label">${cat.category}</span>
        <div class="chart-bar-track">
          <div class="chart-bar-fill" style="width: ${pct}%; background: ${color}; animation-delay: ${i * 0.1}s"></div>
        </div>
        <span class="chart-bar-value">${formatted}</span>
      </div>`;
  }).join('');
}

// ─── Toast Notifications ─────────────────────────
function showToast(message, icon = '✅') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
  
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('hiding');
    toast.addEventListener('animationend', () => toast.remove());
  }, 3000);
}
