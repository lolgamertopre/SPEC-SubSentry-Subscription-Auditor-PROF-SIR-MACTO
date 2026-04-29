function monthlyEquiv(cost, cycle) {
  return cycle === 'yearly' ? cost / 12 : cost;
}
// Adobe at $120/year → $120 / 12 = $10.00/mo 