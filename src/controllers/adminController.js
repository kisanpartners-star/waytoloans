// Company-admin extras: branding, logo and the company's own audit trail.
const Company = require('../models/Company');
const AuditLog = require('../models/AuditLog');
const asyncHandler = require('../utils/asyncHandler');
const paginate = require('../utils/pagination');
const dateRange = require('../utils/dateRange');
const escapeRegex = require('../utils/escapeRegex');
const { publicPath } = require('../middleware/upload');
const { audit } = require('../utils/audit');

exports.getBranding = asyncHandler(async (req, res) => {
  const c = req.company;
  res.json({ success: true, data: { name: c.name, slug: c.slug, brandName: c.brandName || c.name, brandTagline: c.brandTagline || '', logoUrl: c.logoUrl } });
});
exports.updateBranding = asyncHandler(async (req, res) => {
  const c = await Company.findById(req.user.companyId);
  c.brandName = req.body.brandName; c.brandTagline = req.body.brandTagline || '';
  await c.save();
  await audit(req, { action: 'UPDATE', entity: 'branding', entityId: c._id, meta: { brandName: c.brandName } });
  res.json({ success: true, message: 'Branding saved', data: { brandName: c.brandName, brandTagline: c.brandTagline, logoUrl: c.logoUrl } });
});
exports.uploadLogo = asyncHandler(async (req, res) => {
  if (!req.file) return res.status(422).json({ success: false, message: 'Choose an image to upload' });
  const c = await Company.findById(req.user.companyId);
  c.logoUrl = publicPath(req.file); await c.save();
  await audit(req, { action: 'UPDATE', entity: 'logo', entityId: c._id });
  res.json({ success: true, message: 'Logo updated', data: { logoUrl: c.logoUrl } });
});
exports.auditLogs = asyncHandler(async (req, res) => {
  const { page, limit, skip, sort } = paginate(req.query, ['createdAt', 'action', 'role', 'userName'], 'createdAt');
  const q = { companyId: req.user.companyId, ...dateRange(req.query) };
  if (req.query.action) q.action = req.query.action;
  if (req.query.role) q.role = req.query.role;
  if (req.query.search) { const r = new RegExp(escapeRegex(req.query.search), 'i'); q.$or = [{ userName: r }, { entity: r }]; }
  const [items, total] = await Promise.all([AuditLog.find(q).sort(sort).skip(skip).limit(limit).lean(), AuditLog.countDocuments(q)]);
  res.json({ success: true, data: { items, total, page, limit, pages: Math.ceil(total / limit) } });
});
