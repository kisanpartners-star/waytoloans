const sanitizeHtml = require('sanitize-html');
const Policy = require('../models/Policy');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const paginate = require('../utils/pagination');
const dateRange = require('../utils/dateRange');
const escapeRegex = require('../utils/escapeRegex');
const { slugify } = require('../utils/slug');
const { audit } = require('../utils/audit');

const clean = (html) => sanitizeHtml(html || '', {
  allowedTags: ['h1', 'h2', 'h3', 'h4', 'p', 'br', 'b', 'strong', 'i', 'em', 'u', 'ul', 'ol', 'li', 'a', 'blockquote', 'hr', 'span', 'table', 'thead', 'tbody', 'tr', 'th', 'td'],
  allowedAttributes: { a: ['href', 'target', 'rel'] },
  allowedSchemes: ['http', 'https', 'mailto'],
  transformTags: { a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer', target: '_blank' }) },
});

exports.list = asyncHandler(async (req, res) => {
  const { page, limit, skip, sort } = paginate(req.query, ['createdAt', 'title', 'status', 'updatedAt'], 'createdAt');
  const q = { deletedAt: null, ...dateRange(req.query) };
  if (['draft', 'published'].includes(req.query.status)) q.status = req.query.status;
  if (req.query.search) q.title = new RegExp(escapeRegex(req.query.search), 'i');
  const [items, total] = await Promise.all([Policy.find(q).select('-content').sort(sort).skip(skip).limit(limit).lean(), Policy.countDocuments(q)]);
  res.json({ success: true, data: { items, total, page, limit, pages: Math.ceil(total / limit) } });
});
exports.get = asyncHandler(async (req, res) => {
  const doc = await Policy.findOne({ _id: req.params.id, deletedAt: null });
  if (!doc) throw new ApiError(404, 'Policy not found');
  res.json({ success: true, data: doc });
});
exports.create = asyncHandler(async (req, res) => {
  const doc = await Policy.create({ ...req.body, content: clean(req.body.content), slug: slugify(req.body.title), createdBy: req.user._id });
  await audit(req, { action: 'CREATE', entity: 'policy', entityId: doc._id, meta: { title: doc.title } });
  res.status(201).json({ success: true, message: 'Policy created', data: doc });
});
exports.update = asyncHandler(async (req, res) => {
  const doc = await Policy.findOne({ _id: req.params.id, deletedAt: null });
  if (!doc) throw new ApiError(404, 'Policy not found');
  const content = clean(req.body.content);
  if (content !== doc.content) doc.version += 1;
  Object.assign(doc, { title: req.body.title, status: req.body.status, content, slug: slugify(req.body.title) });
  await doc.save();
  await audit(req, { action: 'UPDATE', entity: 'policy', entityId: doc._id, meta: { title: doc.title, version: doc.version } });
  res.json({ success: true, message: 'Policy updated', data: doc });
});
exports.setStatus = asyncHandler(async (req, res) => {
  const doc = await Policy.findOne({ _id: req.params.id, deletedAt: null });
  if (!doc) throw new ApiError(404, 'Policy not found');
  doc.status = req.body.status; await doc.save();
  await audit(req, { action: 'STATUS_CHANGE', entity: 'policy', entityId: doc._id, meta: { status: doc.status } });
  res.json({ success: true, message: `Policy ${doc.status}`, data: doc });
});
exports.remove = asyncHandler(async (req, res) => {
  const doc = await Policy.findOne({ _id: req.params.id, deletedAt: null });
  if (!doc) throw new ApiError(404, 'Policy not found');
  doc.deletedAt = new Date(); await doc.save();
  await audit(req, { action: 'DELETE', entity: 'policy', entityId: doc._id, meta: { title: doc.title } });
  res.json({ success: true, message: 'Policy deleted' });
});
// public: only published policies
exports.publicList = asyncHandler(async (req, res) => {
  const items = await Policy.find({ deletedAt: null, status: 'published' }).select('title slug content updatedAt').sort({ title: 1 }).lean();
  res.json({ success: true, data: items });
});
