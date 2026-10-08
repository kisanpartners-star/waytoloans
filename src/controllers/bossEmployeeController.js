const fs = require('fs/promises');
const Bank = require('../models/Bank');
const Company = require('../models/Company');
const Employee = require('../models/Employee');
const LoanType = require('../models/LoanType');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const paginate = require('../utils/pagination');
const escapeRegex = require('../utils/escapeRegex');
const { publicPath } = require('../middleware/upload');
const { audit } = require('../utils/audit');

const employeeQuery = (id) => ({ _id: id, userId: null, deletedAt: null });

exports.options = asyncHandler(async (req, res) => {
  const [companies, loanTypes] = await Promise.all([
    Company.find({ deletedAt: null, status: 'live', enabled: true, blocked: false }).select('name').sort({ name: 1 }).lean(),
    LoanType.find({ deletedAt: null, status: 'published' }).select('name code').sort({ name: 1 }).lean(),
  ]);
  const banks = companies.length
    ? await Bank.find({
      companyId: { $in: companies.map((company) => company._id) },
      deletedAt: null,
      status: 'active',
      branchName: { $exists: true, $nin: ['', null] },
    }).select('companyId branchName').sort({ branchName: 1 }).lean()
    : [];
  const branches = new Map();
  banks.forEach(({ companyId, branchName }) => {
    const key = String(companyId);
    const values = branches.get(key) || [];
    if (!values.includes(branchName)) values.push(branchName);
    branches.set(key, values);
  });
  res.json({
    success: true,
    data: {
      companies: companies.map((company) => ({ ...company, branches: branches.get(String(company._id)) || [] })),
      loanTypes,
    },
  });
});

exports.list = asyncHandler(async (req, res) => {
  const { page, limit, skip, sort } = paginate(req.query, ['createdAt', 'name', 'employeeId', 'officialEmail', 'status', 'dateOfJoining'], 'createdAt');
  const query = { userId: null, deletedAt: null };
  if (req.query.status === 'draft') query.isDraft = true;
  else {
    query.isDraft = false;
    if (req.query.status === 'disabled') query.accountDisabled = true;
    else if (req.query.status) {
      query.status = req.query.status;
      query.accountDisabled = false;
    }
  }
  if (req.query.search) {
    const regex = new RegExp(escapeRegex(req.query.search), 'i');
    query.$or = ['name', 'employeeId', 'officialEmail', 'personalEmail', 'phone'].map((field) => ({ [field]: regex }));
  }
  const [items, total] = await Promise.all([
    Employee.find(query).populate('loanTypeIds', 'name').populate('companyAssignments.companyId', 'name').sort(sort).skip(skip).limit(limit).lean(),
    Employee.countDocuments(query),
  ]);
  res.json({ success: true, data: { items, total, page, limit, pages: Math.ceil(total / limit) } });
});

async function findEmployee(id) {
  const employee = await Employee.findOne(employeeQuery(id));
  if (!employee) throw new ApiError(404, 'Employee not found');
  return employee;
}

async function validateAssignments(assignments, loanTypeIds) {
  const companyIds = assignments.map((item) => item.companyId);
  const companies = await Company.find({
    _id: { $in: companyIds },
    deletedAt: null,
    status: 'live',
    enabled: true,
    blocked: false,
  }).select('_id').lean();
  if (companies.length !== companyIds.length) throw new ApiError(422, 'One or more companies are unavailable');

  const selectedBranches = assignments.flatMap((item) => item.branches.map((branch) => ({ companyId: item.companyId, branch })));
  if (selectedBranches.length) {
    const available = await Bank.find({
      companyId: { $in: companyIds },
      deletedAt: null,
      status: 'active',
      $or: [
        { branchName: { $in: selectedBranches.map(({ branch }) => branch) } },
        { branches: { $in: selectedBranches.map(({ branch }) => branch) } },
      ],
    }).select('companyId branchName branches').lean();
    const availableByCompany = new Set(available.flatMap((item) => [
      item.branchName && `${item.companyId}:${item.branchName}`,
      ...(item.branches || []).map((branch) => `${item.companyId}:${branch}`),
    ].filter(Boolean)));
    if (selectedBranches.some(({ companyId, branch }) => !availableByCompany.has(`${companyId}:${branch}`))) {
      throw new ApiError(422, 'One or more selected branches are unavailable');
    }
  }

  if (loanTypeIds.length) {
    const published = await LoanType.countDocuments({ _id: { $in: loanTypeIds }, deletedAt: null, status: 'published' });
    if (published !== loanTypeIds.length) throw new ApiError(422, 'One or more selected loan types are unavailable');
  }
}

async function assertUnique(employeeId, officialEmail, excludeId) {
  const duplicate = await Employee.findOne({
    userId: null,
    deletedAt: null,
    ...(excludeId ? { _id: { $ne: excludeId } } : {}),
    $or: [{ employeeId }, { officialEmail }],
  }).select('_id').lean();
  if (duplicate) throw new ApiError(409, 'Employee ID or official email is already registered');
}

async function saveFields(req, employee) {
  const { saveAsDraft, ...fields } = req.body;
  const assignments = fields.companyAssignments || [];
  const loanTypeIds = fields.loanTypeIds || [];
  await validateAssignments(assignments, loanTypeIds);
  if (!saveAsDraft) await assertUnique(fields.employeeId, fields.officialEmail, employee?._id);
  Object.assign(employee || {}, {
    ...fields,
    companyAssignments: assignments,
    loanTypeIds,
    isDraft: saveAsDraft,
    ...(req.file ? { photoUrl: publicPath(req.file) } : {}),
  });
  return employee;
}

exports.create = asyncHandler(async (req, res) => {
  const employee = await saveFields(req, new Employee());
  await employee.save();
  await audit(req, { action: 'CREATE', entity: 'employee', entityId: employee._id, meta: { name: employee.name || '', draft: employee.isDraft } });
  res.status(201).json({ success: true, message: employee.isDraft ? 'Employee draft saved' : 'Employee registered', data: employee });
});

exports.update = asyncHandler(async (req, res) => {
  const employee = await findEmployee(req.params.id);
  await saveFields(req, employee);
  await employee.save();
  await audit(req, { action: 'UPDATE', entity: 'employee', entityId: employee._id, meta: { name: employee.name || '', draft: employee.isDraft } });
  res.json({ success: true, message: employee.isDraft ? 'Employee draft saved' : 'Employee updated', data: employee });
});

exports.setStatus = asyncHandler(async (req, res) => {
  const employee = await findEmployee(req.params.id);
  employee.accountDisabled = req.body.action !== 'enable';
  await employee.save();
  await audit(req, { action: 'STATUS_CHANGE', entity: 'employee', entityId: employee._id, meta: { change: req.body.action, name: employee.name || '' } });
  res.json({ success: true, message: `Employee ${employee.accountDisabled ? 'disabled' : 'enabled'}`, data: employee });
});

exports.remove = asyncHandler(async (req, res) => {
  const employee = await findEmployee(req.params.id);
  employee.deletedAt = new Date();
  await employee.save();
  await audit(req, { action: 'DELETE', entity: 'employee', entityId: employee._id, meta: { name: employee.name || '' } });
  res.json({ success: true, message: 'Employee deleted' });
});

exports.parsePayload = (req, res, next) => {
  try {
    const payload = JSON.parse(req.body.payload);
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('Employee details must be an object');
    req.body = payload;
    next();
  } catch (error) {
    if (req.file) {
      fs.unlink(req.file.path).catch((unlinkError) => {
        if (unlinkError.code !== 'ENOENT') return next(unlinkError);
        next(new ApiError(422, 'Employee details are invalid'));
      });
      return;
    }
    next(new ApiError(422, 'Employee details are invalid'));
  }
};

exports.validatePayload = (schema) => (req, res, next) => {
  const { value, error } = schema.validate(req.body, { abortEarly: false, stripUnknown: true, convert: true });
  if (!error) {
    req.body = value;
    return next();
  }
  const details = error.details.map((item) => ({ field: item.path.join('.'), message: item.message.replace(/"/g, '') }));
  const validationError = new ApiError(422, details[0].message, details);
  if (!req.file) return next(validationError);
  fs.unlink(req.file.path).then(() => next(validationError)).catch((unlinkError) => {
    if (unlinkError.code === 'ENOENT') return next(validationError);
    next(unlinkError);
  });
};
