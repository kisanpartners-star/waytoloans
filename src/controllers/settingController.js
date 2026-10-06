const Setting = require('../models/Setting');
const asyncHandler = require('../utils/asyncHandler');
const { publicPath } = require('../middleware/upload');
const { audit } = require('../utils/audit');

const getDoc = () => Setting.findOneAndUpdate({ key: 'boss' }, { $setOnInsert: { key: 'boss' } }, { upsert: true, new: true });
exports.get = asyncHandler(async (req, res) => res.json({ success: true, data: await getDoc() }));
exports.update = asyncHandler(async (req, res) => {
  const doc = await getDoc();
  Object.assign(doc, req.body); await doc.save();
  await audit(req, { action: 'UPDATE', entity: 'settings', meta: Object.keys(req.body) });
  res.json({ success: true, message: 'Settings saved', data: doc });
});
exports.uploadLogos = asyncHandler(async (req, res) => {
  const doc = await getDoc();
  const f = req.files || {};
  if (f.logo?.[0]) doc.logoUrl = publicPath(f.logo[0]);
  if (f.footerLogo?.[0]) doc.footerLogoUrl = publicPath(f.footerLogo[0]);
  await doc.save();
  await audit(req, { action: 'UPDATE', entity: 'settings', meta: { logo: !!f.logo, footerLogo: !!f.footerLogo } });
  res.json({ success: true, message: 'Logo updated', data: doc });
});
