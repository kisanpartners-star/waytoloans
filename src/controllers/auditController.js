const AuditLog = require('../models/AuditLog');
const asyncHandler = require('../utils/asyncHandler');
const paginate = require('../utils/pagination');
const dateRange = require('../utils/dateRange');
const escapeRegex = require('../utils/escapeRegex');

exports.list = asyncHandler(async (req, res) => {
  const { page, limit, skip, sort } = paginate(req.query, ['createdAt', 'action', 'role', 'userName'], 'createdAt');
  const q = { ...dateRange(req.query) };
  if (req.query.action) q.action = req.query.action;
  if (req.query.role) q.role = req.query.role;
  if (req.query.companyId) q.companyId = req.query.companyId;
  if (req.query.search) { const r = new RegExp(escapeRegex(req.query.search), 'i'); q.$or = [{ userName: r }, { entity: r }, { ip: r }]; }
  const [items, total] = await Promise.all([AuditLog.find(q).sort(sort).skip(skip).limit(limit).lean(), AuditLog.countDocuments(q)]);
  res.json({ success: true, data: { items, total, page, limit, pages: Math.ceil(total / limit) } });
});
