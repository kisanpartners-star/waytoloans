const Employee = require('../models/Employee');
const Bank = require('../models/Bank');
const LoanType = require('../models/LoanType');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const paginate = require('../utils/pagination');
const escapeRegex = require('../utils/escapeRegex');
const { createAccount, updateAccount, setAccountStatus, softDeleteAccount } = require('../services/accountService');
const { publicPath } = require('../middleware/upload');
const { audit } = require('../utils/audit');

const findEmployee = async (req) => {
  const employee = await Employee.findOne({ _id: req.params.id, companyId: req.user.companyId, deletedAt: null });
  if (!employee) throw new ApiError(404, 'Employee not found');
  return employee;
};

const validateReferences = async (companyId, loanTypeId, bankIds) => {
  if (!await LoanType.exists({ _id: loanTypeId, deletedAt: null, status: 'published' })) {
    throw new ApiError(422, 'Select a published loan type');
  }
  if (bankIds.length) {
    const count = await Bank.countDocuments({ _id: { $in: bankIds }, companyId, deletedAt: null, status: 'active' });
    if (count !== bankIds.length) throw new ApiError(422, 'Select only active banks from this company');
  }
};

exports.options = asyncHandler(async (req, res) => {
  const [banks, loanTypes] = await Promise.all([
    Bank.find({ companyId: req.user.companyId, deletedAt: null, status: 'active' })
      .select('_id bankName branchName').sort({ bankName: 1 }).lean(),
    LoanType.find({ deletedAt: null, status: 'published' }).select('_id name').sort({ name: 1 }).lean(),
  ]);
  res.json({ success: true, data: { banks, loanTypes } });
});

exports.list = asyncHandler(async (req, res) => {
  const { page, limit, skip, sort } = paginate(req.query, ['createdAt', 'name', 'employeeId', 'email', 'status'], 'createdAt');
  const users = await User.find({ companyId: req.user.companyId, role: 'employee', deletedAt: null }).select('_id').lean();
  const query = { companyId: req.user.companyId, userId: { $in: users.map((user) => user._id) }, deletedAt: null };
  if (req.query.registration === 'self') query.selfRegistered = true;
  else if (req.query.registration === 'admin') query.selfRegistered = { $ne: true };
  if (req.query.status) query.status = req.query.status;
  if (req.query.search) {
    const regex = new RegExp(escapeRegex(req.query.search), 'i');
    query.$or = ['name', 'employeeId', 'email', 'phone', 'employmentRole'].map((field) => ({ [field]: regex }));
  }
  const [items, total] = await Promise.all([
    Employee.find(query).populate('loanTypeId', 'name').populate('bankIds', 'bankName')
      .sort(sort).skip(skip).limit(limit).lean(),
    Employee.countDocuments(query),
  ]);
  res.json({ success: true, data: { items, total, page, limit, pages: Math.ceil(total / limit) } });
});

exports.create = asyncHandler(async (req, res) => {
  const { password, confirmPassword, ...fields } = req.body;
  await validateReferences(req.user.companyId, fields.loanTypeId, fields.bankIds || []);
  if (await User.exists({
    companyId: req.user.companyId,
    role: 'employee',
    deletedAt: null,
    $or: [{ email: fields.email }, { loginId: fields.employeeId }],
  })) throw new ApiError(409, 'An employee with this email or ID already exists');
  const { profile, user } = await createAccount({
    Profile: Employee,
    user: {
      role: 'employee',
      companyId: req.user.companyId,
      name: fields.name,
      email: fields.email,
      loginId: fields.employeeId,
      phone: fields.phone,
      password,
      status: 'active',
    },
    profile: {
      ...fields,
      bankIds: fields.bankIds || [],
      photoUrl: req.file ? publicPath(req.file) : '',
      status: 'active',
      selfRegistered: false,
    },
  });
  await audit(req, { action: 'CREATE', entity: 'employee', entityId: profile._id, meta: { name: profile.name, employeeId: profile.employeeId }, user, companyId: req.user.companyId });
  res.status(201).json({ success: true, message: 'Employee created', data: profile });
});

exports.update = asyncHandler(async (req, res) => {
  const employee = await findEmployee(req);
  const { password, confirmPassword, ...fields } = req.body;
  await validateReferences(req.user.companyId, fields.loanTypeId, fields.bankIds || []);
  const duplicate = await User.exists({
    companyId: req.user.companyId,
    role: 'employee',
    deletedAt: null,
    _id: { $ne: employee.userId },
    $or: [{ email: fields.email }, { loginId: fields.employeeId }],
  });
  if (duplicate) throw new ApiError(409, 'An employee with this email or ID already exists');
  const previousStatus = employee.status;
  Object.assign(employee, {
    ...fields,
    bankIds: fields.bankIds || [],
    ...(req.file ? { photoUrl: publicPath(req.file) } : {}),
  });
  await employee.save();
  await updateAccount({
    profileDoc: employee,
    userPatch: {
      name: fields.name,
      email: fields.email,
      loginId: fields.employeeId,
      phone: fields.phone,
      status: previousStatus,
    },
    password,
  });
  await audit(req, { action: 'UPDATE', entity: 'employee', entityId: employee._id, meta: { name: employee.name, employeeId: employee.employeeId, passwordReset: !!password } });
  res.json({ success: true, message: 'Employee updated', data: employee });
});

exports.setStatus = asyncHandler(async (req, res) => {
  const employee = await findEmployee(req);
  const { action } = req.body;
  if (action === 'approve' && employee.status !== 'pending') throw new ApiError(400, 'Only pending employee registrations can be approved');
  if (action === 'reject' && employee.status !== 'pending') throw new ApiError(400, 'Only pending employee registrations can be rejected');
  if (action === 'enable' && ['pending', 'rejected'].includes(employee.status)) throw new ApiError(400, 'Approve the registration before enabling it');
  const status = action === 'approve' || action === 'enable' ? 'active'
    : action === 'reject' ? 'rejected' : 'disabled';
  await setAccountStatus(employee, status);
  await audit(req, {
    action: action === 'approve' || action === 'reject' ? action.toUpperCase() : 'STATUS_CHANGE',
    entity: 'employee',
    entityId: employee._id,
    meta: { status, employeeId: employee.employeeId },
  });
  res.json({ success: true, message: `Employee ${action}d`, data: employee });
});

exports.remove = asyncHandler(async (req, res) => {
  const employee = await findEmployee(req);
  await softDeleteAccount(employee);
  await audit(req, { action: 'DELETE', entity: 'employee', entityId: employee._id, meta: { employeeId: employee.employeeId } });
  res.json({ success: true, message: 'Employee deleted' });
});
