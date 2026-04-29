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