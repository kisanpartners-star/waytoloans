const Bank = require('../models/Bank');
const Connector = require('../models/Connector');
const Dsa = require('../models/Dsa');
const Employee = require('../models/Employee');
const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');
const { audit } = require('../utils/audit');

const MODELS = { bank: Bank, connector: Connector, dsa: Dsa, employee: Employee };
const NAME_FIELD = { bank: 'bankName', connector: 'fullName', dsa: 'name', employee: 'name' };
const findProfile = (user) => (MODELS[user.role] ? MODELS[user.role].findOne({ userId: user._id, deletedAt: null }) : null);

exports.get = asyncHandler(async (req, res) => {
  const q = findProfile(req.user);
  const profile = q ? await q.populate(req.user.role === 'employee' ? [{ path: 'loanTypeId', select: 'name' }, { path: 'bankId', select: 'bankName' }] : req.user.role === 'dsa' ? [{ path: 'loanTypeIds', select: 'name' }, { path: 'bankIds', select: 'bankName' }] : []).lean() : null;
  const u = req.user;
  res.json({ success: true, data: { user: { id: u._id, role: u.role, name: u.name, email: u.email, loginId: u.loginId, phone: u.phone, status: u.status, lastLoginAt: u.lastLoginAt, createdAt: u.createdAt }, profile } });
});
// Self-service edit. Identity fields (email, IDs, loan types, banks) stay admin-controlled.
exports.update = asyncHandler(async (req, res) => {
  const { name, ...rest } = req.body;
  const role = req.user.role;
  const patch = {};
  if (name) patch.name = name;
  if (rest.phone) patch.phone = rest.phone;
  if (Object.keys(patch).length) await User.updateOne({ _id: req.user._id }, patch);
  const q = findProfile(req.user);
  if (q) {
    const doc = await q;
    const paths = doc.schema.paths;
    Object.entries(rest).forEach(([k, v]) => { if (paths[k]) doc[k] = v; });
    if (name) doc[NAME_FIELD[role]] = name;
    await doc.save();
  }
  await audit(req, { action: 'UPDATE', entity: 'profile', entityId: req.user._id, meta: Object.keys(req.body) });
  res.json({ success: true, message: 'Profile updated' });
});
