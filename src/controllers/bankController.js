const Bank = require('../models/Bank');
const BankRegistration = require('../models/BankRegistration');
const Dsa = require('../models/Dsa');
const Employee = require('../models/Employee');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { listTenant } = require('../services/listService');
const { createAccount, updateAccount, setAccountStatus, softDeleteAccount } = require('../services/accountService');
const { audit } = require('../utils/audit');

const find = async (req) => {
  const b = await Bank.findOne({ _id: req.params.id, companyId: req.user.companyId, deletedAt: null });
  if (!b) throw new ApiError(404, 'Bank not found');
  return b;
};
exports.list = asyncHandler(async (req, res) => {
  const extra = {}; if (req.query.registration === 'self') extra.selfRegistered = true;
  res.json({ success: true, data: await listTenant(Bank, req, { searchFields: ['bankName', 'email', 'phone', 'contactPerson', 'city'], sortable: ['createdAt', 'bankName', 'email', 'status', 'city'], extra }) });
});
exports.options = asyncHandler(async (req, res) => {
  const items = await Bank.find({ companyId: req.user.companyId, deletedAt: null, status: 'active' }).select('bankName branchName').sort({ bankName: 1 }).lean();
  res.json({ success: true, data: items });
});
exports.create = asyncHandler(async (req, res) => {
  const { password, confirmPassword, ...f } = req.body;
  const { profile } = await createAccount({
    Profile: Bank,
    user: { role: 'bank', companyId: req.user.companyId, name: f.bankName, email: f.email, phone: f.phone, password, status: 'active' },
    profile: { ...f, status: 'active' },
  });
  await audit(req, { action: 'CREATE', entity: 'bank', entityId: profile._id, meta: { bankName: f.bankName } });
  res.status(201).json({ success: true, message: 'Bank created', data: profile });
});
exports.get = asyncHandler(async (req, res) => res.json({ success: true, data: await find(req) }));
exports.update = asyncHandler(async (req, res) => {
  const b = await find(req);
  const { password, confirmPassword, ...f } = req.body;
  Object.assign(b, f); await b.save();
  await updateAccount({ profileDoc: b, userPatch: { name: f.bankName, email: f.email, phone: f.phone }, password });
  await audit(req, { action: 'UPDATE', entity: 'bank', entityId: b._id, meta: { bankName: b.bankName, passwordReset: !!password } });
  res.json({ success: true, message: 'Bank updated', data: b });
});
const MAP = { enable: 'active', disable: 'disabled', approve: 'active', reject: 'rejected' };
exports.setStatus = asyncHandler(async (req, res) => {
  const b = await find(req);
  const { action } = req.body;
  if ((action === 'approve' || action === 'reject') && b.status !== 'pending') throw new ApiError(400, 'Only pending registrations can be approved or rejected');
  if (action === 'enable' && ['pending', 'rejected'].includes(b.status)) throw new ApiError(400, 'Approve the registration first');
  if (action === 'approve' || action === 'reject') { b.reviewedAt = new Date(); b.reviewedBy = req.user._id; }
  await setAccountStatus(b, MAP[action]);
  if (b.registrationId) await BankRegistration.updateOne({ _id: b.registrationId, deletedAt: null }, { status: MAP[action], accountDisabled: action === 'disable' });
  await audit(req, { action: 'STATUS_CHANGE', entity: 'bank', entityId: b._id, meta: { change: action, bankName: b.bankName } });
  res.json({ success: true, message: `Bank ${MAP[action]}`, data: b });
});
exports.remove = asyncHandler(async (req, res) => {
  const b = await find(req);
  const emps = await Employee.find({ bankId: b._id, deletedAt: null });
  for (const e of emps) await softDeleteAccount(e);
  await Dsa.updateMany({ companyId: req.user.companyId }, { $pull: { bankIds: b._id } });
  await softDeleteAccount(b);
  if (b.registrationId) await BankRegistration.updateOne({ _id: b.registrationId }, { deletedAt: new Date() });
  await audit(req, { action: 'DELETE', entity: 'bank', entityId: b._id, meta: { bankName: b.bankName, employeesRemoved: emps.length } });
  res.json({ success: true, message: 'Bank deleted' });
});
