const LoanType = require('../models/LoanType');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const paginate = require('../utils/pagination');
const dateRange = require('../utils/dateRange');
const escapeRegex = require('../utils/escapeRegex');
const { audit } = require('../utils/audit');

exports.list = asyncHandler(async (req, res) => {
  const { page, limit, skip, sort } = paginate(req.query, ['createdAt', 'name', 'code', 'status'], 'createdAt');
  const q = { deletedAt: null, ...dateRange(req.query) };
  if (['draft', 'published'].includes(req.query.status)) q.status = req.query.status;
  if (req.query.search) { const r = new RegExp(escapeRegex(req.query.search), 'i'); q.$or = [{ name: r }, { code: r }]; }
  const [items, total] = await Promise.all([LoanType.find(q).sort(sort).skip(skip).limit(limit).lean(), LoanType.countDocuments(q)]);
  res.json({ success: true, data: { items, total, page, limit, pages: Math.ceil(total / limit) } });
});
// published loan types for dropdowns used by admin / bank / dsa panels
exports.options = asyncHandler(async (req, res) => {
  const items = await LoanType.find({ deletedAt: null, status: 'published' }).select('name code').sort({ name: 1 }).lean();
  res.json({ success: true, data: items });
});
exports.create = asyncHandler(async (req, res) => {
  if (await LoanType.exists({ name: new RegExp(`^${escapeRegex(req.body.name)}$`, 'i'), deletedAt: null })) throw new ApiError(409, 'Loan type already exists');
  const doc = await LoanType.create({ ...req.body, createdBy: req.user._id });
  await audit(req, { action: 'CREATE', entity: 'loanType', entityId: doc._id, meta: { name: doc.name } });
  res.status(201).json({ success: true, message: 'Loan type created', data: doc });
});
exports.update = asyncHandler(async (req, res) => {
  const doc = await LoanType.findOne({ _id: req.params.id, deletedAt: null });
  if (!doc) throw new ApiError(404, 'Loan type not found');
  Object.assign(doc, req.body); await doc.save();
  await audit(req, { action: 'UPDATE', entity: 'loanType', entityId: doc._id, meta: { name: doc.name } });
  res.json({ success: true, message: 'Loan type updated', data: doc });
});
exports.setStatus = asyncHandler(async (req, res) => {
  const doc = await LoanType.findOne({ _id: req.params.id, deletedAt: null });
  if (!doc) throw new ApiError(404, 'Loan type not found');
  doc.status = req.body.status; await doc.save();
  await audit(req, { action: 'STATUS_CHANGE', entity: 'loanType', entityId: doc._id, meta: { status: doc.status } });
  res.json({ success: true, message: `Loan type ${doc.status}`, data: doc });
});
exports.remove = asyncHandler(async (req, res) => {
  const doc = await LoanType.findOne({ _id: req.params.id, deletedAt: null });
  if (!doc) throw new ApiError(404, 'Loan type not found');
  doc.deletedAt = new Date(); await doc.save();
  await audit(req, { action: 'DELETE', entity: 'loanType', entityId: doc._id, meta: { name: doc.name } });
  res.json({ success: true, message: 'Loan type deleted' });
});
