
// ── STATE ────────────────────────────────────────
  let savedTotal     = 0;
  let showUnusedOnly = false;

  // Load from localStorage on start, or use empty array
  let subs = JSON.parse(localStorage.getItem('subsentry-subs') || '[]');

  // ── HELPERS ──────────────────────────────────────

  const $ = id => document.getElementById(id);
  const toMo  = (cost, cycle) => cycle === 'yearly' ? cost / 12 : cost;
  const fmt   = n => '$' + n.toFixed(2);

  // Sanitize a string to prevent XSS when injecting into innerHTML
  function sanitize(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // Save current subs array to localStorage
  function persist() {
    localStorage.setItem('subsentry-subs', JSON.stringify(subs));
  }

  // Show a temporary toast notification
  let toastTimer;
  function toast(msg, type = 'success') {
    const el = $('toast');
    el.textContent = msg;
    el.className = `show ${type}`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.className = '', 3000);
  }

  // Color palettes for subscription icons
  const PALETTES = [
    { bg: 'rgba(255,77,109,.15)',  color: '#ff4d6d' },
    { bg: 'rgba(255,209,102,.15)', color: '#ffd166' },
    { bg: 'rgba(6,214,160,.15)',   color: '#06d6a0' },
    { bg: 'rgba(100,149,237,.15)', color: '#6495ed' },
    { bg: 'rgba(200,130,255,.15)', color: '#c882ff' },
  ];

  const iconStyle = name => PALETTES[name.charCodeAt(0) % PALETTES.length];
  const initials  = name => name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

  // ── ADD SUBSCRIPTION ─────────────────────────────
  function addSub() {
    const name   = $('svc-name').value.trim();
    const cost   = parseFloat($('svc-cost').value);
    const cycle  = $('svc-cycle').value;
    const unused = $('mark-unused').checked;

    // Validate inputs
    if (!name || isNaN(cost) || cost <= 0) {
      toast('Please fill in all fields correctly.', 'error');
      return $('svc-name').focus();
    }

    // Warn if duplicate name exists (but still allow)
    const isDuplicate = subs.some(s => s.name.toLowerCase() === name.toLowerCase());
    if (isDuplicate) {
      toast(`"${name}" already exists — added anyway.`, 'warning');
      $('svc-name').classList.add('warn');
      setTimeout(() => $('svc-name').classList.remove('warn'), 2000);
    }

    // Use crypto.randomUUID() for unique IDs — safer than Date.now()
    subs.push({
      id: crypto.randomUUID(),
      name, cost, cycle, unused
    });

    persist(); // save to localStorage

    // Clear form
    $('svc-name').value = $('svc-cost').value = '';
    $('mark-unused').checked = false;

    if (!isDuplicate) toast(`"${name}" added!`, 'success');

    render();
  }

  // ── CANCEL SUBSCRIPTION ──────────────────────────
  function cancelSub(id) {
    const sub = subs.find(s => s.id === id);
    if (!sub) return;

    // Animate card out before removing from DOM
    const card = document.querySelector(`[data-id="${id}"]`);
    if (card) {
      card.classList.add('removing');
      card.addEventListener('animationend', () => {
        savedTotal += toMo(sub.cost, sub.cycle);
        subs = subs.filter(s => s.id !== id);
        persist();

        // Update savings banner
        const banner = $('savings-banner');
        banner.style.display = 'block';
        banner.textContent = `✓ You've saved ${fmt(savedTotal)}/month by cancelling subscriptions this session.`;

        toast(`"${sub.name}" cancelled — saving ${fmt(toMo(sub.cost, sub.cycle))}/mo`, 'success');
        render();
      }, { once: true });
    }
  }

  // ── EDIT SUBSCRIPTION NAME INLINE ────────────────
  function startEdit(id) {
    const sub  = subs.find(s => s.id === id);
    if (!sub) return;

    const nameEl = document.querySelector(`[data-id="${id}"] .sub-name`);
    if (!nameEl) return;

    // Replace the name div with an input field
    const input = document.createElement('input');
    input.className = 'sub-name-input';
    input.value = sub.name;
    nameEl.replaceWith(input);
    input.focus();
    input.select();

    // Commit edit on blur or Enter
    function commitEdit() {
      const newName = input.value.trim();
      if (newName && newName !== sub.name) {
        sub.name = newName;
        persist();
        toast(`Renamed to "${newName}"`, 'success');
      }
      render();
    }

    input.addEventListener('blur', commitEdit);
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter')  commitEdit();
      if (e.key === 'Escape') render(); // cancel edit
    });
  }

  // ── FILTER TOGGLE ────────────────────────────────
  function toggleFilter() {
    showUnusedOnly = !showUnusedOnly;
    $('filter-btn').textContent = showUnusedOnly ? 'Show all' : 'Show unused only';
    render();
  }

  // ── RENDER ───────────────────────────────────────
  function render() {
    const list    = $('subs-list');
    const visible = showUnusedOnly ? subs.filter(s => s.unused) : subs;

    // Update sub count badge
    $('count-badge').textContent = `${subs.length} sub${subs.length !== 1 ? 's' : ''}`;

    // Empty states
    if (!subs.length) {
      list.innerHTML = '<div class="empty"><span>📋</span>No subscriptions yet. Add your first one above.</div>';

    } else if (!visible.length) {
      list.innerHTML = '<div class="empty"><span>✅</span>No unused subscriptions found.</div>';

    } else {
      list.innerHTML = visible.map(s => {
        const mo            = toMo(s.cost, s.cycle);
        const { bg, color } = iconStyle(s.name);
        const safeName      = sanitize(s.name); // XSS protection

        return `
          <div class="sub-card ${s.unused ? 'unused' : ''}" data-id="${s.id}" role="listitem">

            <div class="sub-icon" style="background:${bg};color:${color}" aria-hidden="true">
              ${initials(s.name)}
            </div>

            <div class="sub-info">
              <div class="sub-name"
                   onclick="startEdit('${s.id}')"
                   title="Click to rename"
                   role="button"
                   tabindex="0"
                   aria-label="Rename ${safeName}">
                ${safeName}
              </div>
              <div class="sub-detail">
                ${s.cycle === 'yearly' ? `Billed yearly (${fmt(s.cost)}/yr)` : 'Billed monthly'}
                ${s.unused ? ' · Unused 3+ months' : ''}
              </div>
            </div>

            ${s.unused ? '<span class="unused-badge" aria-label="Unused">Unused</span>' : ''}

            <div class="sub-cost">
              <div class="sub-monthly">${fmt(mo)}/mo</div>
              ${s.cycle === 'yearly' ? `<div class="sub-original">(${fmt(s.cost)}/yr ÷ 12)</div>` : ''}
            </div>

            <button class="btn-cancel"
                    onclick="cancelSub('${s.id}')"
                    aria-label="Cancel ${safeName} subscription">
              Cancel
            </button>

          </div>`;
      }).join('');
    }

    // Update dashboard metrics
    const total = subs.reduce((sum, s) => sum + toMo(s.cost, s.cycle), 0);
    $('total-burn').textContent  = fmt(total);
    $('annual-proj').textContent = fmt(total * 12);
    $('saved').textContent       = fmt(savedTotal);
  }

  // ── KEYBOARD SUPPORT ─────────────────────────────
  ['svc-name', 'svc-cost'].forEach(id =>
    $(id).addEventListener('keydown', e => e.key === 'Enter' && addSub())
  );

  // Duplicate warning: highlight field when name already exists while typing
  $('svc-name').addEventListener('input', function () {
    const exists = subs.some(s => s.name.toLowerCase() === this.value.trim().toLowerCase());
    this.classList.toggle('warn', exists && this.value.trim() !== '');
  });

  // Initial render (loads persisted data on page load)
  render();

function monthlyEquiv(cost, cycle) {
  return cycle === 'yearly' ? cost / 12 : cost;
}
// Adobe at $120/year → $120 / 12 = $10.00/mo

function addSub() {
  const name = document.getElementById('svc-name').value.trim();
  const cost = parseFloat(document.getElementById('svc-cost').value);
  const cycle = document.getElementById('svc-cycle').value;
  const unused = document.getElementById('mark-unused').checked;

  if (!name || isNaN(cost) || cost <= 0) return; // validation

  subs.push({ id: Date.now(), name, cost, cycle, unused });
  render(); // re-draw everything
}
function render() {
  // 1. Calculate total burn
  const total = subs.reduce((sum, s) => sum + monthlyEquiv(s.cost, s.cycle), 0);
  document.getElementById('total-burn').textContent = '$' + total.toFixed(2);

  // 2. Rebuild the subscription cards
  document.getElementById('subs-list').innerHTML = subs.map(s => `
    <div class="sub-card">
      <span>${s.name}</span>
      <span>$${monthlyEquiv(s.cost, s.cycle).toFixed(2)}/mo</span>
      <button onclick="cancelSub(${s.id})">Cancel</button>
    </div>
  `).join('');
}
function render() {
  // 1. Calculate total burn
  const total = subs.reduce((sum, s) => sum + monthlyEquiv(s.cost, s.cycle), 0);
  document.getElementById('total-burn').textContent = '$' + total.toFixed(2);

  // 2. Rebuild the subscription cards
  document.getElementById('subs-list').innerHTML = subs.map(s => `
    <div class="sub-card">
      <span>${s.name}</span>
      <span>$${monthlyEquiv(s.cost, s.cycle).toFixed(2)}/mo</span>
      <button onclick="cancelSub(${s.id})">Cancel</button>
    </div>
  `).join('');
}
function cancelSub(id) {
  const sub = subs.find(s => s.id === id);
  savedTotal += monthlyEquiv(sub.cost, sub.cycle); // track savings
  subs = subs.filter(s => s.id !== id);            // remove it
  render();
}
d45b78684fc4c8b49062eea39d5375ac2073adc4
