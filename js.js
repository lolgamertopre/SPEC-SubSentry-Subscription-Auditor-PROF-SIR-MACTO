// ── STATE ────────────────────────────────────────
let savedTotal     = 0;
let showUnusedOnly = false;
let historyVisible = false;
let subs    = JSON.parse(localStorage.getItem('subsentry-subs')     || '[]');
let history = JSON.parse(localStorage.getItem('subsentry-history')  || '[]');

// ── HELPERS ──────────────────────────────────────
const $      = id => document.getElementById(id);
const toMo   = (cost, cycle) => cycle === 'yearly' ? cost / 12 : cost;
const fmt    = n  => '$' + Number(n).toFixed(2);
const tsNow  = ()  => new Date().toLocaleString('en-US', { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' });

function sanitize(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function persist() {
  localStorage.setItem('subsentry-subs',    JSON.stringify(subs));
  localStorage.setItem('subsentry-history', JSON.stringify(history));
}

function logEvent(icon, msg) {
  history.unshift({ icon, msg, ts: tsNow() });
  if (history.length > 100) history.pop();
  persist();
  renderHistory();
}

// ── TOAST ─────────────────────────────────────────
let toastTimer;
function toast(msg, type = 'success') {
  const el = $('toast');
  el.textContent = msg;
  el.className = `show ${type}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.className = '', 3200);
}

// ── ICON HELPERS ─────────────────────────────────
const PALETTES = [
  { bg:'rgba(255,77,109,.15)',  color:'#ff4d6d' },
  { bg:'rgba(255,209,102,.15)', color:'#ffd166' },
  { bg:'rgba(6,214,160,.15)',   color:'#06d6a0' },
  { bg:'rgba(100,149,237,.15)', color:'#6495ed' },
  { bg:'rgba(200,130,255,.15)', color:'#c882ff' },
];
const iconStyle = name => PALETTES[name.charCodeAt(0) % PALETTES.length];
const initials  = name => name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

// ── ADD SUBSCRIPTION ─────────────────────────────
function addSub() {
  const name   = $('svc-name').value.trim();
  const cost   = parseFloat($('svc-cost').value);
  const cycle  = $('svc-cycle').value;
  const unused = $('mark-unused').checked;

  if (!name || isNaN(cost) || cost <= 0) {
    toast('Please fill in all fields correctly.', 'error');
    return $('svc-name').focus();
  }

  const isDuplicate = subs.some(s => s.name.toLowerCase() === name.toLowerCase());
  if (isDuplicate) {
    toast(`"${name}" already exists — added anyway.`, 'warning');
    $('svc-name').classList.add('warn');
    setTimeout(() => $('svc-name').classList.remove('warn'), 2000);
  }

  const sub = { id: crypto.randomUUID(), name, cost, cycle, unused, paused: false };
  subs.push(sub);
  logEvent('➕', `Added "${name}" — ${fmt(toMo(cost, cycle))}/mo`);
  persist();

  $('svc-name').value = $('svc-cost').value = '';
  $('mark-unused').checked = false;
  if (!isDuplicate) toast(`"${name}" added!`, 'success');
  render();
}

// ── CANCEL SUBSCRIPTION ──────────────────────────
function cancelSub(id) {
  const sub  = subs.find(s => s.id === id);
  if (!sub) return;
  const card = document.querySelector(`[data-id="${id}"]`);
  if (!card) return;

  card.classList.add('removing');
  let done = false;

  const finish = () => {
    if (done) return;
    done = true;
    if (!sub.paused) savedTotal += toMo(sub.cost, sub.cycle);
    subs = subs.filter(s => s.id !== id);
    logEvent('❌', `Cancelled "${sub.name}" — freed ${fmt(toMo(sub.cost, sub.cycle))}/mo`);
    persist();

    const banner = $('savings-banner');
    banner.style.display = 'block';
    banner.textContent = `✓ You've saved ${fmt(savedTotal)}/month by cancelling subscriptions this session.`;
    toast(`"${sub.name}" cancelled — saving ${fmt(toMo(sub.cost, sub.cycle))}/mo`, 'success');
    render();
  };

  card.addEventListener('animationend', finish, { once: true });
  setTimeout(finish, 400); // fallback for reduced-motion
}

// ── PAUSE / RESUME ────────────────────────────────
function togglePause(id) {
  const sub = subs.find(s => s.id === id);
  if (!sub) return;
  sub.paused = !sub.paused;
  if (sub.paused) {
    logEvent('⏸', `Paused "${sub.name}" — ${fmt(toMo(sub.cost, sub.cycle))}/mo on hold`);
    toast(`"${sub.name}" paused`, 'warning');
  } else {
    logEvent('▶', `Resumed "${sub.name}" — ${fmt(toMo(sub.cost, sub.cycle))}/mo active again`);
    toast(`"${sub.name}" resumed`, 'success');
  }
  persist();
  render();
}

// ── EDIT NAME INLINE ─────────────────────────────
function startEdit(id) {
  const sub    = subs.find(s => s.id === id);
  if (!sub) return;
  const nameEl = document.querySelector(`[data-id="${id}"] .sub-name`);
  if (!nameEl) return;

  const input = document.createElement('input');
  input.className = 'sub-name-input';
  input.value = sub.name;
  nameEl.replaceWith(input);
  input.focus();
  input.select();

  function commitEdit() {
    const newName = input.value.trim();
    if (newName && newName !== sub.name) {
      logEvent('✏️', `Renamed "${sub.name}" → "${newName}"`);
      sub.name = newName;
      persist();
      toast(`Renamed to "${newName}"`, 'success');
    }
    render();
  }

  input.addEventListener('blur', commitEdit);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter')  commitEdit();
    if (e.key === 'Escape') render();
  });
}

// ── FILTER TOGGLE ────────────────────────────────
function toggleFilter() {
  showUnusedOnly = !showUnusedOnly;
  $('filter-btn').textContent = showUnusedOnly ? 'Show all' : 'Show unused only';
  render();
}

// ── HISTORY PANEL ────────────────────────────────
function toggleHistory() {
  historyVisible = !historyVisible;
  $('history-toggle-btn').textContent = historyVisible ? 'Hide history' : 'Show history';
  renderHistory();
}

function clearHistory() {
  history = [];
  persist();
  renderHistory();
  toast('History cleared', 'success');
}

function renderHistory() {
  const panel = $('history-panel');
  if (!historyVisible) { panel.style.display = 'none'; return; }
  panel.style.display = 'block';

  if (!history.length) {
    panel.innerHTML = '<div class="history-empty">No actions recorded yet.</div>';
    return;
  }

  panel.innerHTML = `
    <div class="history-header">
      <span class="history-title">Action History</span>
      <button class="btn-clear-hist" onclick="clearHistory()">Clear</button>
    </div>
    <div class="history-list">
      ${history.map(e => `
        <div class="history-item">
          <span class="hist-icon">${e.icon}</span>
          <span class="hist-msg">${sanitize(e.msg)}</span>
          <span class="hist-ts">${e.ts}</span>
        </div>`).join('')}
    </div>`;
}

// ── RENDER ───────────────────────────────────────
function render() {
  const list    = $('subs-list');
  const visible = showUnusedOnly ? subs.filter(s => s.unused) : subs;

  $('count-badge').textContent = `${subs.length} sub${subs.length !== 1 ? 's' : ''}`;

  if (!subs.length) {
    list.innerHTML = '<div class="empty"><span>📋</span>No subscriptions yet. Add your first one above.</div>';
  } else if (!visible.length) {
    list.innerHTML = '<div class="empty"><span>✅</span>No unused subscriptions found.</div>';
  } else {
    list.innerHTML = visible.map(s => {
      const mo            = toMo(s.cost, s.cycle);
      const { bg, color } = iconStyle(s.name);
      const safeName      = sanitize(s.name);
      const isPaused      = s.paused;

      return `
        <div class="sub-card ${s.unused ? 'unused' : ''} ${isPaused ? 'paused' : ''}" data-id="${s.id}" role="listitem">
          <div class="sub-icon" style="background:${bg};color:${color};opacity:${isPaused?0.5:1}" aria-hidden="true">
            ${initials(s.name)}
          </div>
          <div class="sub-info">
            <div class="sub-name"
                 onclick="startEdit('${s.id}')"
                 onkeydown="if(event.key==='Enter')startEdit('${s.id}')"
                 title="Click to rename"
                 role="button"
                 tabindex="0"
                 aria-label="Rename ${safeName}">
              ${safeName}
            </div>
            <div class="sub-detail">
              ${s.cycle === 'yearly' ? `Billed yearly (${fmt(s.cost)}/yr)` : 'Billed monthly'}
              ${s.unused  ? ' · Unused 3+ months' : ''}
              ${isPaused  ? ' · <span style="color:#ffd166">Paused</span>' : ''}
            </div>
          </div>
          <div class="sub-badges">
            ${s.unused  ? '<span class="unused-badge" aria-label="Unused">Unused</span>' : ''}
            ${isPaused  ? '<span class="paused-badge" aria-label="Paused">Paused</span>' : ''}
          </div>
          <div class="sub-cost" style="opacity:${isPaused?0.45:1}">
            <div class="sub-monthly">${fmt(mo)}/mo</div>
            ${s.cycle === 'yearly' ? `<div class="sub-original">(${fmt(s.cost)}/yr ÷ 12)</div>` : ''}
          </div>
          <div class="sub-actions">
            <button class="btn-pause ${isPaused ? 'btn-resume' : ''}"
                    onclick="togglePause('${s.id}')"
                    aria-label="${isPaused ? 'Resume' : 'Pause'} ${safeName}">
              ${isPaused ? '▶ Resume' : '⏸ Pause'}
            </button>
            <button class="btn-cancel"
                    onclick="cancelSub('${s.id}')"
                    aria-label="Cancel ${safeName} subscription">
              Cancel
            </button>
          </div>
        </div>`;
    }).join('');
  }

  // Metrics: only count active (non-paused) subs for burn
  const activeSubs = subs.filter(s => !s.paused);
  const pausedSubs = subs.filter(s => s.paused);
  const total       = activeSubs.reduce((sum, s) => sum + toMo(s.cost, s.cycle), 0);
  const totalPaused = pausedSubs.reduce((sum, s) => sum + toMo(s.cost, s.cycle), 0);

  $('total-burn').textContent  = fmt(total);
  $('annual-proj').textContent = fmt(total * 12);
  $('saved').textContent       = fmt(savedTotal);
  $('paused-total').textContent = fmt(totalPaused);
}

// ── KEYBOARD SUPPORT ─────────────────────────────
['svc-name', 'svc-cost'].forEach(id =>
  $(id).addEventListener('keydown', e => e.key === 'Enter' && addSub())
);

$('svc-name').addEventListener('input', function () {
  const exists = subs.some(s => s.name.toLowerCase() === this.value.trim().toLowerCase());
  this.classList.toggle('warn', exists && this.value.trim() !== '');
});

// ── INIT ─────────────────────────────────────────
render();
renderHistory();