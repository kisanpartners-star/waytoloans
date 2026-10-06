const Dsa = require('../models/Dsa');
const Bank = require('../models/Bank');
const LoanType = require('../models/LoanType');
const Employee = require('../models/Employee');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { listTenant } = require('../services/listService');
const { createAccount, updateAccount, setAccountStatus, softDeleteAccount } = require('../services/accountService');
const { audit } = require('../utils/audit');

// loan types must be published; banks must belong to THIS company (tenant isolation)
async function checkRefs(req, { loanTypeIds, bankIds }) {
  const lt = await LoanType.countDocuments({ _id: { $in: loanTypeIds }, deletedAt: null, status: 'published' });
  if (lt !== loanTypeIds.length) throw new ApiError(422, 'One or more loan types are invalid or not published');
  const bk = await Bank.countDocuments({ _id: { $in: bankIds }, companyId: req.user.companyId, deletedAt: null });
  if (bk !== bankIds.length) throw new ApiError(422, 'One or more banks are invalid');
}
const find = async (req) => {
  const d = await Dsa.findOne({ _id: req.params.id, companyId: req.user.companyId, deletedAt: null });
  if (!d) throw new ApiError(404, 'DSA not found');
  return d;
};
exports.list = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await listTenant(Dsa, req, {
    searchFields: ['name', 'dsaId', 'email', 'phone', 'branch'], sortable: ['createdAt', 'name', 'dsaId', 'branch', 'status'],
    populate: [{ path: 'loanTypeIds', select: 'name' }, { path: 'bankIds', select: 'bankName' }],
  }) });
});
exports.create = asyncHandler(async (req, res) => {
  const { password, confirmPassword, ...f } = req.body;
  await checkRefs(req, f);
  const { profile } = await createAccount({
    Profile: Dsa,
    user: { role: 'dsa', companyId: req.user.companyId, name: f.name, email: f.email || undefined, loginId: f.dsaId, phone: f.phone || undefined, password, status: 'active' },
    profile: { ...f, email: f.email || undefined, status: 'active' },
  });
  await audit(req, { action: 'CREATE', entity: 'dsa', entityId: profile._id, meta: { name: f.name, dsaId: f.dsaId } });
  res.status(201).json({ success: true, message: 'DSA created', data: profile });
});
exports.get = asyncHandler(async (req, res) => res.json({ success: true, data: await find(req) }));
exports.update = asyncHandler(async (req, res) => {
  const d = await find(req);
  const { password, confirmPassword, ...f } = req.body;
  await checkRefs(req, f);
  Object.assign(d, { ...f, email: f.email || undefined, phone: f.phone || undefined }); await d.save();
  await updateAccount({ profileDoc: d, userPatch: { name: f.name, email: f.email || undefined, loginId: f.dsaId, phone: f.phone || undefined }, password });
  await audit(req, { action: 'UPDATE', entity: 'dsa', entityId: d._id, meta: { name: d.name, passwordReset: !!password } });
  res.json({ success: true, message: 'DSA updated', data: d });
});
exports.setStatus = asyncHandler(async (req, res) => {
  const d = await find(req);
  await setAccountStatus(d, req.body.action === 'enable' ? 'active' : 'disabled');
  await audit(req, { action: 'STATUS_CHANGE', entity: 'dsa', entityId: d._id, meta: { change: req.body.action, name: d.name } });
  res.json({ success: true, message: `DSA ${d.status === 'active' ? 'enabled' : 'disabled'}`, data: d });
});
exports.remove = asyncHandler(async (req, res) => {
  const d = await find(req);
  await Employee.updateMany({ companyId: req.user.companyId }, { $pull: { dsas: { dsaId: d._id } } });
  await softDeleteAccount(d);
  await audit(req, { action: 'DELETE', entity: 'dsa', entityId: d._id, meta: { name: d.name } });
  res.json({ success: true, message: 'DSA deleted' });
});
