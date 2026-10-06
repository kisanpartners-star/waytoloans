const paginate = require('../utils/pagination');
const dateRange = require('../utils/dateRange');
const escapeRegex = require('../utils/escapeRegex');
// Tenant-scoped table query shared by every list endpoint.
async function listTenant(Model, req, { searchFields, sortable, extra = {}, populate, select }) {
  const { page, limit, skip, sort } = paginate(req.query, sortable, 'createdAt');
  const q = { companyId: req.user.companyId, deletedAt: null, ...extra, ...dateRange(req.query) };
  if (req.query.status) q.status = req.query.status;
  if (req.query.search) { const r = new RegExp(escapeRegex(req.query.search), 'i'); q.$or = searchFields.map((f) => ({ [f]: r })); }
  let cursor = Model.find(q).sort(sort).skip(skip).limit(limit);
  if (select) cursor = cursor.select(select);
  (populate || []).forEach((p) => { cursor = cursor.populate(p); });
  const [items, total] = await Promise.all([cursor.lean(), Model.countDocuments(q)]);
  return { items, total, page, limit, pages: Math.ceil(total / limit) };
}
module.exports = { listTenant };
