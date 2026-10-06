const mongoose = require('mongoose');
const Company = require('../models/Company');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const paginate = require('../utils/pagination');
const dateRange = require('../utils/dateRange');
const escapeRegex = require('../utils/escapeRegex');
const { makeCompanySlug } = require('../utils/slug');
const { hashPassword } = require('../utils/password');
const { audit } = require('../utils/audit');

const statusFilter = {
  draft: { status: 'draft' }, live: { status: 'live' }, enabled: { enabled: true }, disabled: { enabled: false },
  blocked: { blocked: true }, loginDisabled: { loginDisabled: true }, maintenance: { maintenanceMode: true },
};

exports.list = asyncHandler(async (req, res) => {
  const { page, limit, skip, sort } = paginate(req.query, ['createdAt', 'name', 'email', 'status', 'phone'], 'createdAt');
  const q = { deletedAt: null, ...dateRange(req.query) };
  if (req.query.status && statusFilter[req.query.status]) Object.assign(q, statusFilter[req.query.status]);
  if (req.query.search) {
    const r = new RegExp(escapeRegex(req.query.search), 'i');
    q.$or = [{ name: r }, { email: r }, { phone: r }, { gstin: r }, { slug: r }];
  }
  const [items, total] = await Promise.all([Company.find(q).sort(sort).skip(skip).limit(limit).lean(), Company.countDocuments(q)]);
  // per-company role counts for the current page only
  const counts = await User.aggregate([
    { $match: { companyId: { $in: items.map((c) => c._id) }, deletedAt: null } },
    { $group: { _id: { c: '$companyId', r: '$role' }, n: { $sum: 1 } } },
  ]);
  const map = {};
  counts.forEach((c) => { (map[c._id.c] = map[c._id.c] || {})[c._id.r] = c.n; });
  items.forEach((c) => { const m = map[c._id] || {}; c.counts = { banks: m.bank || 0, dsas: m.dsa || 0, connectors: m.connector || 0, employees: m.employee || 0 }; });
  res.json({ success: true, data: { items, total, page, limit, pages: Math.ceil(total / limit) } });
});

exports.get = asyncHandler(async (req, res) => {
  const c = await Company.findOne({ _id: req.params.id, deletedAt: null });
  if (!c) throw new ApiError(404, 'Company not found');
  res.json({ success: true, data: c });
});

exports.create = asyncHandler(async (req, res) => {
  const { password, saveAsDraft, ...fields } = req.body;
  delete fields.confirmPassword;
  if (await Company.exists({ gstin: fields.gstin, deletedAt: null })) throw new ApiError(409, 'A company with this GSTIN already exists');
  if (await Company.exists({ email: fields.email, deletedAt: null })) throw new ApiError(409, 'A company with this email already exists');
  const company = await Company.create({ ...fields, slug: makeCompanySlug(fields.name), brandName: fields.name, status: saveAsDraft ? 'draft' : 'live', createdBy: req.user._id });
  try {
    const admin = await User.create({ role: 'admin', companyId: company._id, name: `${fields.name} Admin`, email: fields.email, phone: fields.phone, passwordHash: await hashPassword(password), status: 'active' });
    company.adminUserId = admin._id;
    await company.save();
  } catch (e) { await Company.deleteOne({ _id: company._id }); throw e; }
  await audit(req, { action: 'CREATE', entity: 'company', entityId: company._id, meta: { name: company.name, slug: company.slug, draft: !!saveAsDraft }, companyId: company._id });
  res.status(201).json({ success: true, message: 'Company created', data: company });
});

exports.update = asyncHandler(async (req, res) => {
  const company = await Company.findOne({ _id: req.params.id, deletedAt: null });
  if (!company) throw new ApiError(404, 'Company not found');
  const { password, confirmPassword, ...fields } = req.body;
  if (await Company.exists({ _id: { $ne: company._id }, gstin: fields.gstin, deletedAt: null })) throw new ApiError(409, 'Another company uses this GSTIN');
  if (await Company.exists({ _id: { $ne: company._id }, email: fields.email, deletedAt: null })) throw new ApiError(409, 'Another company uses this email');
  Object.assign(company, fields);
  await company.save();
  const adminUpdate = { email: fields.email, phone: fields.phone, name: `${fields.name} Admin` };
  if (password) { adminUpdate.passwordHash = await hashPassword(password); adminUpdate.passwordChangedAt = new Date(); adminUpdate.refreshTokens = []; }
  await User.updateOne({ _id: company.adminUserId }, adminUpdate);
  await audit(req, { action: 'UPDATE', entity: 'company', entityId: company._id, meta: { name: company.name, passwordReset: !!password }, companyId: company._id });
  res.json({ success: true, message: 'Company updated', data: company });
});

const ACTIONS = {
  draft: { status: 'draft' }, publish: { status: 'live' }, enable: { enabled: true }, disable: { enabled: false },
  block: { blocked: true }, unblock: { blocked: false }, disableLogin: { loginDisabled: true }, enableLogin: { loginDisabled: false },
};
exports.action = asyncHandler(async (req, res) => {
  const company = await Company.findOne({ _id: req.params.id, deletedAt: null });
  if (!company) throw new ApiError(404, 'Company not found');
  Object.assign(company, ACTIONS[req.body.action]);
  await company.save();
  await audit(req, { action: 'STATUS_CHANGE', entity: 'company', entityId: company._id, meta: { change: req.body.action, name: company.name }, companyId: company._id });
  res.json({ success: true, message: 'Company updated', data: company });
});

exports.remove = asyncHandler(async (req, res) => {
  const company = await Company.findOne({ _id: req.params.id, deletedAt: null });
  if (!company) throw new ApiError(404, 'Company not found');
  company.deletedAt = new Date(); company.enabled = false;
  await company.save();
  await audit(req, { action: 'DELETE', entity: 'company', entityId: company._id, meta: { name: company.name }, companyId: company._id });
  res.json({ success: true, message: 'Company deleted' });
});
