// builds a createdAt range filter from ?from=YYYY-MM-DD&to=YYYY-MM-DD
module.exports = (q, field = 'createdAt') => {
  const r = {};
  if (q.from && !isNaN(new Date(q.from))) r.$gte = new Date(q.from);
  if (q.to && !isNaN(new Date(q.to))) { const d = new Date(q.to); d.setHours(23, 59, 59, 999); r.$lte = d; }
  return Object.keys(r).length ? { [field]: r } : {};
};
