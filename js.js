function monthlyEquiv(cost, cycle) {
  return cycle === 'yearly' ? cost / 12 : cost;
}
// Adobe at $120/year → $120 / 12 = $10.00/mo 
let subs = [];

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
let savedTotal = 0;

function cancelSub(id) {
  const sub = subs.find(s => s.id === id);
  savedTotal += monthlyEquiv(sub.cost, sub.cycle); // track savings
  subs = subs.filter(s => s.id !== id);            // remove it
  render();
}