const Connector = require('../models/Connector');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { listTenant } = require('../services/listService');
const { createAccount, updateAccount, setAccountStatus, softDeleteAccount } = require('../services/accountService');
const { audit } = require('../utils/audit');

const find = async (req) => {
  const c = await Connector.findOne({ _id: req.params.id, companyId: req.user.companyId, deletedAt: null });
  if (!c) throw new ApiError(404, 'Connector not found');
  return c;
};
exports.list = asyncHandler(async (req, res) => {
  const extra = {}; if (req.query.registration === 'self') extra.selfRegistered = true;
  res.json({ success: true, data: await listTenant(Connector, req, { searchFields: ['fullName', 'email', 'phone'], sortable: ['createdAt', 'fullName', 'email', 'status'], extra }) });
});
exports.create = asyncHandler(async (req, res) => {
  const { password, confirmPassword, ...f } = req.body;
  const { profile } = await createAccount({
    Profile: Connector,
    user: { role: 'connector', companyId: req.user.companyId, name: f.fullName, email: f.email, phone: f.phone, password, status: 'active' },
    profile: { ...f, status: 'active' },
  });
  await audit(req, { action: 'CREATE', entity: 'connector', entityId: profile._id, meta: { fullName: f.fullName } });
  res.status(201).json({ success: true, message: 'Connector created', data: profile });
});
exports.get = asyncHandler(async (req, res) => res.json({ success: true, data: await find(req) }));
exports.update = asyncHandler(async (req, res) => {
  const c = await find(req);
  const { password, confirmPassword, ...f } = req.body;
  Object.assign(c, f); await c.save();
  await updateAccount({ profileDoc: c, userPatch: { name: f.fullName, email: f.email, phone: f.phone }, password });
  await audit(req, { action: 'UPDATE', entity: 'connector', entityId: c._id, meta: { fullName: c.fullName, passwordReset: !!password } });
  res.json({ success: true, message: 'Connector updated', data: c });
});
const MAP = { enable: 'active', disable: 'disabled', approve: 'active', reject: 'rejected' };
exports.setStatus = asyncHandler(async (req, res) => {
  const c = await find(req);
  const { action } = req.body;
  if ((action === 'approve' || action === 'reject') && c.status !== 'pending') throw new ApiError(400, 'Only pending registrations can be approved or rejected');
  if (action === 'enable' && ['pending', 'rejected'].includes(c.status)) throw new ApiError(400, 'Approve the registration first');
  if (action === 'approve' || action === 'reject') { c.reviewedAt = new Date(); c.reviewedBy = req.user._id; }
  await setAccountStatus(c, MAP[action]);
  await audit(req, { action: 'STATUS_CHANGE', entity: 'connector', entityId: c._id, meta: { change: action, fullName: c.fullName } });
  res.json({ success: true, message: `Connector ${MAP[action]}`, data: c });
});
exports.remove = asyncHandler(async (req, res) => {
  const c = await find(req);
  await softDeleteAccount(c);
  await audit(req, { action: 'DELETE', entity: 'connector', entityId: c._id, meta: { fullName: c.fullName } });
  res.json({ success: true, message: 'Connector deleted' });
});
