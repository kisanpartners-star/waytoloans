const startOfDay = (d = new Date()) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const daysAgo = (n) => { const x = startOfDay(); x.setDate(x.getDate() - n); return x; };
// one aggregate -> total / per-status / created today|week|month for a tenant collection
async function summary(Model, match) {
  const t = startOfDay(), w = daysAgo(6), m = daysAgo(29);
  const c = (cond) => ({ $sum: { $cond: [cond, 1, 0] } });
  const [r] = await Model.aggregate([
    { $match: { deletedAt: null, ...match } },
    { $group: { _id: null, total: { $sum: 1 },
      active: c({ $eq: ['$status', 'active'] }), disabled: c({ $eq: ['$status', 'disabled'] }), blocked: c({ $eq: ['$status', 'blocked'] }),
      pending: c({ $eq: ['$status', 'pending'] }), rejected: c({ $eq: ['$status', 'rejected'] }), selfRegistered: c({ $eq: ['$selfRegistered', true] }),
      today: c({ $gte: ['$createdAt', t] }), week: c({ $gte: ['$createdAt', w] }), month: c({ $gte: ['$createdAt', m] }) } },
  ]);
  return { total: 0, active: 0, disabled: 0, blocked: 0, pending: 0, rejected: 0, selfRegistered: 0, today: 0, week: 0, month: 0, ...(r || {}) };
}
async function dailySeries(Model, match, days) {
  const rows = await Model.aggregate([
    { $match: { ...match, createdAt: { $gte: daysAgo(days - 1) } } },
    { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, n: { $sum: 1 } } },
  ]);
  const m = {}; rows.forEach((r) => { m[r._id] = r.n; });
  return Array.from({ length: days }, (_, i) => {
    const d = daysAgo(days - 1 - i);
    const k = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    return { date: k, value: m[k] || 0 };
  });
}
const ageInDays = (d) => Math.max(0, Math.floor((Date.now() - new Date(d).getTime()) / 86400000));
module.exports = { startOfDay, daysAgo, summary, dailySeries, ageInDays };
