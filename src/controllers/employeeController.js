const Employee = require('../models/Employee');
const SalesManager = require('../models/SalesManager');
const Dsa = require('../models/Dsa');
const Bank = require('../models/Bank');
const Company = require('../models/Company');
const LoanType = require('../models/LoanType');
const User = require('../models/User');
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
exports.companyOptions = asyncHandler(async (req, res) => {
  const companies = await Company.find({
    deletedAt: null,
    status: 'live',
    enabled: true,
    blocked: false,
  }).select('name state district').sort({ name: 1 }).lean();
  res.json({ success: true, data: companies });
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
async function validateCompanyAssignments(assignments) {
  if (!assignments) return;
  const ids = assignments.map(({ companyId }) => String(companyId));
  if (new Set(ids).size !== ids.length) throw new ApiError(422, 'A company is selected more than once');
  const count = await Company.countDocuments({
    _id: { $in: ids },
    deletedAt: null,
    status: 'live',
    enabled: true,
    blocked: false,
  });
  if (count !== ids.length) throw new ApiError(422, 'One or more selected companies are unavailable');
}
exports.list = asyncHandler(async (req, res) => {
  const bank = await myBank(req);
  res.json({ success: true, data: await listTenant(Employee, req, {
    searchFields: ['name', 'employeeId', 'email', 'phone'], sortable: ['createdAt', 'name', 'employeeId', 'email', 'status'],
    extra: { bankId: bank._id, ...(req.query.loanTypeId ? { loanTypeId: req.query.loanTypeId } : {}) }, populate: [
      { path: 'loanTypeId', select: 'name' },
      { path: 'companyAssignments.companyId', select: 'name state district' },
    ],
  }) });
});
exports.create = asyncHandler(async (req, res) => {
  const bank = await myBank(req);
  const { password, confirmPassword, dsas, companyAssignments, ...f } = req.body;
  await validateCompanyAssignments(companyAssignments);
  await checkLoanType(f.loanTypeId);
  if (await User.exists({ role: 'salesManager', companyId: null, email: f.email, deletedAt: null })) {
    throw new ApiError(409, 'This email is already registered as a sales employee');
  }
  if (await SalesManager.exists({ bankId: bank._id, bankType: 'bank', employeeId: f.employeeId, deletedAt: null })) {
    throw new ApiError(409, 'This employee ID is already in use by your bank');
  }
  const rows = dsas ? await buildDsaRows(req, bank, dsas) : [];
  const { profile: manager } = await createAccount({
    Profile: SalesManager,
    user: { role: 'salesManager', name: f.name, email: f.email, phone: f.phone || undefined, password, status: 'active' },
    profile: {
      bankId: bank._id,
      bankType: 'bank',
      name: f.name,
      employeeId: f.employeeId,
      email: f.email,
      phone: f.phone,
      companyAssignments,
      loanTypeIds: [f.loanTypeId],
    },
  });
  let profile;
  try {
    profile = await Employee.create({
      ...f,
      phone: f.phone || undefined,
      dsas: rows,
      companyAssignments,
      bankId: bank._id,
      companyId: req.user.companyId,
      userId: manager.userId,
      status: 'active',
    });
  } catch (error) {
    await Promise.all([
      SalesManager.deleteOne({ _id: manager._id }),
      User.deleteOne({ _id: manager.userId }),
    ]);
    throw error;
  }
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
  const { password, confirmPassword, dsas, companyAssignments, ...f } = req.body;
  await validateCompanyAssignments(companyAssignments);
  await checkLoanType(f.loanTypeId);
  const rows = dsas ? await buildDsaRows(req, bank, dsas) : e.dsas;
  Object.assign(e, { ...f, phone: f.phone || undefined, dsas: rows, ...(companyAssignments ? { companyAssignments } : {}) }); await e.save();
  const manager = await SalesManager.findOne({ userId: e.userId, bankId: bank._id, bankType: 'bank', deletedAt: null });
  await updateAccount({
    profileDoc: e,
    userPatch: { name: f.name, email: f.email, phone: f.phone || undefined, ...(!manager ? { loginId: f.employeeId } : {}) },
    password,
  });
  if (manager) {
    Object.assign(manager, {
      name: f.name,
      employeeId: f.employeeId,
      email: f.email,
      phone: f.phone,
      ...(companyAssignments ? { companyAssignments } : {}),
      loanTypeIds: [f.loanTypeId],
    });
    await manager.save();
  }
  await audit(req, { action: 'UPDATE', entity: 'employee', entityId: e._id, meta: { name: e.name, passwordReset: !!password } });
  res.json({ success: true, message: 'Employee updated', data: e });
});
exports.setStatus = asyncHandler(async (req, res) => {
  const bank = await myBank(req);
  const e = await find(req, bank);
  const status = req.body.action === 'enable' ? 'active' : 'disabled';
  await setAccountStatus(e, status);
  await SalesManager.updateOne({ userId: e.userId, bankId: bank._id, bankType: 'bank', deletedAt: null }, { status });
  await audit(req, { action: 'STATUS_CHANGE', entity: 'employee', entityId: e._id, meta: { change: req.body.action, name: e.name } });
  res.json({ success: true, message: `Employee ${e.status === 'active' ? 'enabled' : 'disabled'}`, data: e });
});
exports.remove = asyncHandler(async (req, res) => {
  const bank = await myBank(req);
  const e = await find(req, bank);
  await SalesManager.updateOne({ userId: e.userId, bankId: bank._id, bankType: 'bank', deletedAt: null }, { deletedAt: new Date(), status: 'disabled' });
  await softDeleteAccount(e);
  await audit(req, { action: 'DELETE', entity: 'employee', entityId: e._id, meta: { name: e.name } });
  res.json({ success: true, message: 'Employee deleted' });
});
