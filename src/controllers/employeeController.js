const Employee = require('../models/Employee');
const Dsa = require('../models/Dsa');
const Bank = require('../models/Bank');
const LoanType = require('../models/LoanType');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { listTenant } = require('../services/listService');
const { createAccount, updateAccount, setAccountStatus, softDeleteAccount } = require('../services/accountService');
const { audit } = require('../utils/audit');

// the logged-in bank's profile document
const myBank = async (req) => {
  const b = await Bank.findOne({ userId: req.user._id, companyId: req.user.companyId, deletedAt: null });
  if (!b) throw new ApiError(403, 'Bank profile not found');
  return b;
};
// DSAs that the admin has linked to this bank
exports.dsaOptions = asyncHandler(async (req, res) => {
  const bank = await myBank(req);
  const items = await Dsa.find({ companyId: req.user.companyId, deletedAt: null, status: 'active', bankIds: bank._id }).select('name dsaId branch').sort({ name: 1 }).lean();
  res.json({ success: true, data: items });
});
async function buildDsaRows(req, bank, rows) {
  const ids = rows.map((r) => r.dsaId);
  if (new Set(ids).size !== ids.length) throw new ApiError(422, 'The same DSA is added more than once');
  const dsas = await Dsa.find({ _id: { $in: ids }, companyId: req.user.companyId, deletedAt: null, bankIds: bank._id });
  if (dsas.length !== ids.length) throw new ApiError(422, 'One or more DSAs are not linked to your bank');
  const byId = Object.fromEntries(dsas.map((d) => [String(d._id), d]));
  return rows.map((r) => ({ dsaId: r.dsaId, dsaName: byId[r.dsaId].name, branch: r.branch || byId[r.dsaId].branch }));
}
async function checkLoanType(id) {
  if (!(await LoanType.exists({ _id: id, deletedAt: null, status: 'published' }))) throw new ApiError(422, 'Loan type is invalid or not published');
}
const find = async (req, bank) => {
  const e = await Employee.findOne({ _id: req.params.id, companyId: req.user.companyId, bankId: bank._id, deletedAt: null });
  if (!e) throw new ApiError(404, 'Employee not found');
  return e;
};
exports.list = asyncHandler(async (req, res) => {
  const bank = await myBank(req);
  res.json({ success: true, data: await listTenant(Employee, req, {
    searchFields: ['name', 'employeeId', 'email', 'phone'], sortable: ['createdAt', 'name', 'employeeId', 'email', 'status'],
    extra: { bankId: bank._id, ...(req.query.loanTypeId ? { loanTypeId: req.query.loanTypeId } : {}) }, populate: [{ path: 'loanTypeId', select: 'name' }],
  }) });
});
exports.create = asyncHandler(async (req, res) => {
  const bank = await myBank(req);
  const { password, confirmPassword, dsas, ...f } = req.body;
  await checkLoanType(f.loanTypeId);
  const rows = await buildDsaRows(req, bank, dsas);
  const { profile } = await createAccount({
    Profile: Employee,
    user: { role: 'employee', companyId: req.user.companyId, name: f.name, email: f.email, loginId: f.employeeId, phone: f.phone || undefined, password, status: 'active' },
    profile: { ...f, phone: f.phone || undefined, dsas: rows, bankId: bank._id, status: 'active' },
  });
  await audit(req, { action: 'CREATE', entity: 'employee', entityId: profile._id, meta: { name: f.name, employeeId: f.employeeId } });
  res.status(201).json({ success: true, message: 'Employee created', data: profile });
});
exports.get = asyncHandler(async (req, res) => {
  const bank = await myBank(req);
  res.json({ success: true, data: await find(req, bank) });
});
exports.update = asyncHandler(async (req, res) => {
  const bank = await myBank(req);
  const e = await find(req, bank);
  const { password, confirmPassword, dsas, ...f } = req.body;
  await checkLoanType(f.loanTypeId);
  const rows = await buildDsaRows(req, bank, dsas);
  Object.assign(e, { ...f, phone: f.phone || undefined, dsas: rows }); await e.save();
  await updateAccount({ profileDoc: e, userPatch: { name: f.name, email: f.email, loginId: f.employeeId, phone: f.phone || undefined }, password });
  await audit(req, { action: 'UPDATE', entity: 'employee', entityId: e._id, meta: { name: e.name, passwordReset: !!password } });
  res.json({ success: true, message: 'Employee updated', data: e });
});
exports.setStatus = asyncHandler(async (req, res) => {
  const bank = await myBank(req);
  const e = await find(req, bank);
  await setAccountStatus(e, req.body.action === 'enable' ? 'active' : 'disabled');
  await audit(req, { action: 'STATUS_CHANGE', entity: 'employee', entityId: e._id, meta: { change: req.body.action, name: e.name } });
  res.json({ success: true, message: `Employee ${e.status === 'active' ? 'enabled' : 'disabled'}`, data: e });
});
exports.remove = asyncHandler(async (req, res) => {
  const bank = await myBank(req);
  const e = await find(req, bank);
  await softDeleteAccount(e);
  await audit(req, { action: 'DELETE', entity: 'employee', entityId: e._id, meta: { name: e.name } });
  res.json({ success: true, message: 'Employee deleted' });
});
