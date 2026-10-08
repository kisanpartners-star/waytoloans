const crypto = require('crypto');
const BankPortal = require('../models/BankPortal');
const Company = require('../models/Company');
const LoanType = require('../models/LoanType');
const SalesManager = require('../models/SalesManager');
const SalesLead = require('../models/SalesLead');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { createAccount, setAccountStatus, softDeleteAccount } = require('../services/accountService');
const { hashPassword } = require('../utils/password');
const escapeRegex = require('../utils/escapeRegex');
const { audit } = require('../utils/audit');
const { sendMail } = require('../services/mailService');
const paginate = require('../utils/pagination');

const bankFor = async (userId) => {
  const bank = await BankPortal.findOne({ userId, deletedAt: null });
  if (!bank) throw new ApiError(404, 'Bank portal profile not found');
  return bank;
};
const activeCompanies = async (ids) => {
  const companies = await Company.find({ _id: { $in: ids }, deletedAt: null, status: 'live', enabled: true, blocked: false }).select('_id name slug').lean();
  if (companies.length !== new Set(ids.map(String)).size) throw new ApiError(422, 'Select only active companies');
  return companies;
};
const activeCompanyIds = async (assignments) => {
  const companyIds = assignments.map((item) => item.companyId?._id || item.companyId);
  const active = await Company.find({
    _id: { $in: companyIds },
    deletedAt: null,
    status: 'live',
    enabled: true,
    blocked: false,
  }).select('_id').lean();
  return active.map((company) => String(company._id));
};
const managerFor = async (userId) => {
  const manager = await SalesManager.findOne({ userId, deletedAt: null });
  if (!manager) throw new ApiError(404, 'Sales employee profile not found');
  const bank = await BankPortal.findOne({ _id: manager.bankId, deletedAt: null, status: 'active' });
  if (!bank) throw new ApiError(403, 'The bank portal for this account is not active');
  const bankCompanyIds = new Set(bank.companyAssignments.map((item) => String(item.companyId)));
  const activeIds = new Set(await activeCompanyIds(manager.companyAssignments));
  manager.companyAssignments = manager.companyAssignments.filter((item) => {
    const companyId = String(item.companyId);
    if (!bankCompanyIds.has(companyId) || !activeIds.has(companyId)) return false;
    const bankAssignment = bank.companyAssignments.find((assigned) => String(assigned.companyId) === companyId);
    if (bankAssignment.branches.length) {
      const previouslyLimited = item.branches.length > 0;
      const branches = previouslyLimited
        ? item.branches.filter((branch) => bankAssignment.branches.includes(branch))
        : bankAssignment.branches;
      if (previouslyLimited && !branches.length) return false;
      item.branches = branches;
    }
    return true;
  });
  const bankLoanTypeIds = new Set(bank.loanTypeIds.map(String));
  manager.loanTypeIds = manager.loanTypeIds.filter((item) => bankLoanTypeIds.has(String(item)));
  return manager;
};
const leadScope = (manager) => {
  const assignments = manager.companyAssignments.map((assignment) => ({
    companyId: assignment.companyId,
    ...(assignment.branches.length ? { branch: { $in: assignment.branches } } : {}),
  }));
  return {
    managerId: manager._id,
    deletedAt: null,
    loanTypeId: { $in: manager.loanTypeIds },
    $or: assignments.length ? assignments : [{ companyId: null }],
  };
};

exports.options = asyncHandler(async (req, res) => {
  const [companies, loanTypes] = await Promise.all([
    Company.find({ deletedAt: null, status: 'live', enabled: true, blocked: false }).select('name slug').sort({ name: 1 }).lean(),
    LoanType.find({ deletedAt: null, status: 'published' }).select('name code').sort({ name: 1 }).lean(),
  ]);
  res.json({ success: true, data: { companies, loanTypes } });
});

exports.register = asyncHandler(async (req, res) => {
  const { bankName, authorisedPersonName, phone, employeeId, email, password, companyAssignments = [], loanTypeIds = [] } = req.body;
  const companyIds = companyAssignments.map((item) => item.companyId);
  if (!companyIds.length) throw new ApiError(422, 'Assign at least one company');
  await activeCompanies(companyIds);
  const types = await LoanType.countDocuments({ _id: { $in: loanTypeIds }, status: 'published', deletedAt: null });
  if (!loanTypeIds.length || types !== new Set(loanTypeIds.map(String)).size) throw new ApiError(422, 'Select available loan types');
  if (await User.exists({ role: 'bankPortal', companyId: null, email, deletedAt: null })) throw new ApiError(409, 'This email is already registered for a bank portal');
  if (await BankPortal.exists({ employeeId, deletedAt: null })) throw new ApiError(409, 'This employee ID is already registered');
  let user;
  try {
    user = await User.create({ role: 'bankPortal', name: bankName, email, phone, passwordHash: await hashPassword(password), status: 'active' });
  } catch (error) {
    if (error.code === 11000) throw new ApiError(409, 'This email is already registered for a bank portal');
    throw error;
  }
  try {
    const bank = await BankPortal.create({ userId: user._id, bankName, authorisedPersonName, email, phone, employeeId, companyAssignments, loanTypeIds });
    await audit(req, { action: 'REGISTER', entity: 'bankPortal', entityId: bank._id, meta: { bankName }, user });
    res.status(201).json({ success: true, message: 'Bank portal account created', data: { id: bank._id } });
  } catch (error) {
    await BankPortal.deleteOne({ userId: user._id });
    await User.deleteOne({ _id: user._id });
    if (error.code === 11000) throw new ApiError(409, 'This email or employee ID is already registered');
    throw error;
  }
});

exports.dashboard = asyncHandler(async (req, res) => {
  const bank = await bankFor(req.user._id);
  const [managers, leads, stages] = await Promise.all([
    SalesManager.countDocuments({ bankId: bank._id, deletedAt: null }),
    SalesLead.countDocuments({ bankId: bank._id, deletedAt: null }),
    SalesLead.aggregate([{ $match: { bankId: bank._id, deletedAt: null } }, { $group: { _id: '$stage', count: { $sum: 1 } } }]),
  ]);
  const companyIds = await activeCompanyIds(bank.companyAssignments);
  const companies = await Company.find({ _id: { $in: companyIds }, deletedAt: null, status: 'live', enabled: true, blocked: false }).select('name').lean();
  res.json({ success: true, data: {
    bank, cards: [
      { label: 'Companies', value: companies.length }, { label: 'Sales employees', value: managers },
      { label: 'Total leads', value: leads }, { label: 'Approved loans', value: stages.find((row) => row._id === 'Approved')?.count || 0 },
    ],
    companies, stages: stages.map((row) => ({ name: row._id, value: row.count })),
  } });
});

exports.salesDashboard = asyncHandler(async (req, res) => {
  const manager = await managerFor(req.user._id);
  const companyIds = await activeCompanyIds(manager.companyAssignments);
  const match = { ...leadScope(manager), companyId: { $in: companyIds } };
  const [total, stages, companies, recent] = await Promise.all([
    SalesLead.countDocuments(match),
    SalesLead.aggregate([{ $match: match }, { $group: { _id: '$stage', count: { $sum: 1 } } }]),
    Company.find({ _id: { $in: companyIds }, deletedAt: null, status: 'live', enabled: true, blocked: false }).select('name').lean(),
    SalesLead.find(match).populate('companyId', 'name').populate('loanTypeId', 'name').sort({ createdAt: -1 }).limit(8).lean(),
  ]);
  const count = (stage) => stages.find((row) => row._id === stage)?.count || 0;
  const companyRows = await Promise.all(companies.map(async (company) => {
    const companyMatch = { ...match, companyId: company._id };
    const [applied, pending, approved, disbursed] = await Promise.all([
      SalesLead.countDocuments(companyMatch),
      SalesLead.countDocuments({ ...companyMatch, stage: { $nin: ['Approved', 'Disbursed', 'Rejected'] } }),
      SalesLead.countDocuments({ ...companyMatch, stage: 'Approved' }),
      SalesLead.countDocuments({ ...companyMatch, stage: 'Disbursed' }),
    ]);
    return { ...company, applied, pending, approved, disbursed };
  }));
  res.json({ success: true, data: {
    manager, companies: companyRows,
    cards: [
      { label: 'Total companies', value: companies.length }, { label: 'Total loans applied', value: total },
      { label: 'New leads', value: count('Lead Created') }, { label: 'Confirmation pending', value: count('Confirmation Requested') },
      { label: 'Documents pending', value: count('Documents Requested') }, { label: 'Applications processing', value: count('Application Processing') + count('Credit Verification') },
      { label: 'Approved loans', value: count('Approved') }, { label: 'Disbursed loans', value: count('Disbursed') },
    ],
    stages: stages.map((row) => ({ name: row._id, value: row.count })),
    recent,
  } });
});

exports.updateBank = asyncHandler(async (req, res) => {
  const bank = await bankFor(req.user._id);
  const { bankName, authorisedPersonName, email, phone, employeeId, companyAssignments, loanTypeIds, loanPolicies } = req.body;
  if (bankName !== undefined) bank.bankName = bankName;
  if (authorisedPersonName !== undefined) bank.authorisedPersonName = authorisedPersonName;
  if (phone !== undefined) bank.phone = phone;
  if (employeeId !== undefined) bank.employeeId = employeeId;
  if (employeeId !== undefined && await BankPortal.exists({ employeeId, deletedAt: null, _id: { $ne: bank._id } })) throw new ApiError(409, 'This employee ID is already registered');
  if (email !== undefined) {
    if (await User.exists({ role: 'bankPortal', companyId: null, email, deletedAt: null, _id: { $ne: req.user._id } })) throw new ApiError(409, 'This email is already registered for a bank portal');
    bank.email = email;
    await User.updateOne({ _id: req.user._id }, { email, name: bankName || bank.bankName });
  }
  if (companyAssignments) {
    await activeCompanies(companyAssignments.map((item) => item.companyId));
    bank.companyAssignments = companyAssignments;
  }
  if (loanTypeIds) {
    const count = await LoanType.countDocuments({ _id: { $in: loanTypeIds }, status: 'published', deletedAt: null });
    if (count !== new Set(loanTypeIds.map(String)).size) throw new ApiError(422, 'Select available loan types');
    bank.loanTypeIds = loanTypeIds;
  }
  if (loanPolicies) bank.loanPolicies = loanPolicies;
  if (loanPolicies?.some((policy) => !bank.loanTypeIds.some((loanTypeId) => String(loanTypeId) === String(policy.loanTypeId)))) {
    throw new ApiError(422, 'Policies can only be configured for assigned loan types');
  }
  await bank.save();
  await audit(req, { action: 'UPDATE', entity: 'bankPortal', entityId: bank._id });
  res.json({ success: true, message: 'Bank settings updated', data: bank });
});

exports.listEmployees = asyncHandler(async (req, res) => {
  const bank = await bankFor(req.user._id);
  const query = { bankId: bank._id, deletedAt: null };
  if (req.query.search) {
    const regex = new RegExp(escapeRegex(req.query.search), 'i');
    query.$or = [{ name: regex }, { employeeId: regex }, { email: regex }];
  }
  const items = await SalesManager.find(query).populate('companyAssignments.companyId', 'name').populate('loanTypeIds', 'name').sort({ createdAt: -1 }).lean();
  res.json({ success: true, data: { items, total: items.length, page: 1, limit: 100, pages: 1 } });
});

exports.saveEmployee = asyncHandler(async (req, res) => {
  const bank = await bankFor(req.user._id);
  const { name, employeeId, email, phone, password, companyAssignments = [], loanTypeIds = [], designation } = req.body;
  if (!req.params.id && !password) throw new ApiError(422, 'A password is required for a new sales employee');
  if (!companyAssignments.length || !loanTypeIds.length) throw new ApiError(422, 'Assign at least one company and loan type');
  const allowedCompanyIds = bank.companyAssignments.map((item) => String(item.companyId));
  if (companyAssignments.some((item) => !allowedCompanyIds.includes(String(item.companyId)))) throw new ApiError(403, 'Employees can only be assigned to your companies');
  await activeCompanies(companyAssignments.map((item) => item.companyId));
  for (const assignment of companyAssignments) {
    const bankAssignment = bank.companyAssignments.find((item) => String(item.companyId) === String(assignment.companyId));
    if (bankAssignment?.branches?.length && assignment.branches.some((branch) => !bankAssignment.branches.includes(branch))) {
      throw new ApiError(403, 'Employees can only be assigned to branches registered for your bank');
    }
  }
  const allowedTypes = bank.loanTypeIds.map(String);
  if (loanTypeIds.some((typeId) => !allowedTypes.includes(String(typeId)))) throw new ApiError(403, 'Employees can only be assigned to your loan types');
  if (req.params.id) {
    const employee = await SalesManager.findOne({ _id: req.params.id, bankId: bank._id, deletedAt: null });
    if (!employee) throw new ApiError(404, 'Sales employee not found');
    if (await User.exists({ role: 'salesManager', companyId: null, email, deletedAt: null, _id: { $ne: employee.userId } })) throw new ApiError(409, 'This email is already registered as a sales employee');
    if (await SalesManager.exists({ bankId: bank._id, employeeId, deletedAt: null, _id: { $ne: employee._id } })) throw new ApiError(409, 'This employee ID is already in use by your bank');
    Object.assign(employee, { name, employeeId, email, phone, designation, companyAssignments, loanTypeIds });
    await employee.save();
    await User.updateOne({ _id: employee.userId }, { name, email, phone, ...(password ? { passwordHash: await hashPassword(password), passwordChangedAt: new Date() } : {}) });
    return res.json({ success: true, message: 'Sales employee updated', data: employee });
  }
  if (await User.exists({ role: 'salesManager', companyId: null, email, deletedAt: null })) throw new ApiError(409, 'This email is already registered as a sales employee');
  if (await SalesManager.exists({ bankId: bank._id, employeeId, deletedAt: null })) throw new ApiError(409, 'This employee ID is already in use by your bank');
  let profile;
  try {
    ({ profile } = await createAccount({
      Profile: SalesManager,
      user: { role: 'salesManager', name, email, phone, password, status: 'active' },
      profile: { bankId: bank._id, name, employeeId, email, phone, designation, companyAssignments, loanTypeIds },
    }));
  } catch (error) {
    if (error.code === 11000) throw new ApiError(409, 'This email or employee ID is already in use');
    throw error;
  }
  await audit(req, { action: 'CREATE', entity: 'salesManager', entityId: profile._id });
  res.status(201).json({ success: true, message: 'Sales employee created', data: profile });
});

exports.employeeStatus = asyncHandler(async (req, res) => {
  const bank = await bankFor(req.user._id);
  const employee = await SalesManager.findOne({ _id: req.params.id, bankId: bank._id, deletedAt: null });
  if (!employee) throw new ApiError(404, 'Sales employee not found');
  await setAccountStatus(employee, req.body.action === 'disable' ? 'disabled' : 'active');
  res.json({ success: true, message: `Sales employee ${req.body.action}d`, data: employee });
});

exports.removeEmployee = asyncHandler(async (req, res) => {
  const bank = await bankFor(req.user._id);
  const employee = await SalesManager.findOne({ _id: req.params.id, bankId: bank._id, deletedAt: null });
  if (!employee) throw new ApiError(404, 'Sales employee not found');
  await softDeleteAccount(employee);
  res.json({ success: true, message: 'Sales employee deleted' });
});

exports.companyOptions = asyncHandler(async (req, res) => {
  const profile = await managerFor(req.user._id);
  await profile.populate('companyAssignments.companyId', 'name slug');
  await profile.populate('loanTypeIds', 'name code');
  res.json({ success: true, data: { assignments: profile.companyAssignments, loanTypes: profile.loanTypeIds } });
});

exports.leads = asyncHandler(async (req, res) => {
  const profile = await managerFor(req.user._id);
  const { page, limit, skip, sort } = paginate(req.query, ['createdAt', 'leadId', 'stage'], 'createdAt');
  const companies = await activeCompanyIds(profile.companyAssignments);
  const query = { ...leadScope(profile), companyId: { $in: companies } };
  if (req.query.companyId) {
    if (!companies.includes(String(req.query.companyId))) throw new ApiError(403, 'You are not assigned to this company');
    query.companyId = req.query.companyId;
  }
  for (const key of ['stage']) if (req.query[key]) query[key] = req.query[key];
  if (req.query.loanTypeId) {
    if (!profile.loanTypeIds.some((loanTypeId) => String(loanTypeId) === String(req.query.loanTypeId))) throw new ApiError(403, 'You are not assigned to this loan type');
    query.loanTypeId = req.query.loanTypeId;
  }
  if (req.query.branch) query.branch = req.query.branch;
  if (req.query.dateFrom || req.query.dateTo) {
    query.createdAt = {};
    if (req.query.dateFrom) query.createdAt.$gte = new Date(req.query.dateFrom);
    if (req.query.dateTo) {
      const end = new Date(req.query.dateTo);
      end.setUTCHours(23, 59, 59, 999);
      query.createdAt.$lte = end;
    }
  }
  if (req.query.search) {
    const regex = new RegExp(escapeRegex(req.query.search), 'i');
    query.$or = [{ leadId: regex }, { customerName: regex }, { connector: regex }];
  }
  const [items, total] = await Promise.all([
    SalesLead.find(query).populate('companyId', 'name').populate('loanTypeId', 'name').sort(sort).skip(skip).limit(limit).lean(),
    SalesLead.countDocuments(query),
  ]);
  res.json({ success: true, data: { items, total, page, limit, pages: Math.ceil(total / limit) } });
});

exports.saveLead = asyncHandler(async (req, res) => {
  const manager = await managerFor(req.user._id);
  const companyId = String(req.body.companyId);
  if (!manager.companyAssignments.some((item) => String(item.companyId) === companyId)) throw new ApiError(403, 'You are not assigned to this company');
  await activeCompanies([companyId]);
  const loanTypeId = String(req.body.loanTypeId);
  if (!manager.loanTypeIds.some((typeId) => String(typeId) === loanTypeId)) throw new ApiError(403, 'You are not assigned to this loan type');
  const assignment = manager.companyAssignments.find((item) => String(item.companyId) === companyId);
  if (req.body.branch && assignment.branches.length && !assignment.branches.includes(req.body.branch)) throw new ApiError(403, 'You are not assigned to this branch');
  const payload = { ...req.body, bankId: manager.bankId, managerId: manager._id, stageHistory: [{ stage: req.body.stage || 'Lead Created', remarks: req.body.remarks || '' }] };
  if (req.params.id) {
    const lead = await SalesLead.findOne({ _id: req.params.id, ...leadScope(manager) });
    if (!lead) throw new ApiError(404, 'Lead not found');
    if (req.body.stage && req.body.stage !== lead.stage) lead.stageHistory.push({ stage: req.body.stage, remarks: req.body.remarks || '' });
    Object.assign(lead, req.body);
    await lead.save();
    return res.json({ success: true, message: 'Lead updated', data: lead });
  }
  const leadId = `L-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
  const lead = await SalesLead.create({ ...payload, leadId });
  res.status(201).json({ success: true, message: 'Lead created', data: lead });
});

exports.deleteLead = asyncHandler(async (req, res) => {
  const manager = await managerFor(req.user._id);
  const lead = await SalesLead.findOne({ _id: req.params.id, ...leadScope(manager) });
  if (!lead) throw new ApiError(404, 'Lead not found');
  lead.deletedAt = new Date();
  await lead.save();
  res.json({ success: true, message: 'Lead deleted' });
});

exports.requestConfirmation = asyncHandler(async (req, res) => {
  const manager = await managerFor(req.user._id);
  const lead = await SalesLead.findOne({ _id: req.params.id, ...leadScope(manager) });
  if (!lead) throw new ApiError(404, 'Lead not found');
  if (!lead.email) throw new ApiError(422, 'Add the customer email before sending a confirmation request');
  const message = req.body.message?.trim() || `Please confirm the details for loan lead ${lead.leadId}.`;
  await sendMail({ to: lead.email, subject: `Confirmation required for ${lead.leadId}`, text: message });
  lead.stage = 'Confirmation Requested';
  lead.stageHistory.push({ stage: lead.stage, remarks: message });
  lead.emailLog.push({ subject: `Confirmation required for ${lead.leadId}`, message });
  await lead.save();
  res.json({ success: true, message: 'Confirmation request sent', data: lead });
});

exports.requestDocument = asyncHandler(async (req, res) => {
  const manager = await managerFor(req.user._id);
  const lead = await SalesLead.findOne({ _id: req.params.id, ...leadScope(manager) });
  if (!lead) throw new ApiError(404, 'Lead not found');
  if (!['PAN Card', 'Aadhaar Card', 'Salary Slip', 'Bank Statement', 'Employment Proof', 'Address Proof', 'Property Documents'].includes(req.body.name)) {
    throw new ApiError(422, 'Select a supported document');
  }
  const document = lead.documents.find((item) => item.name === req.body.name);
  if (document) document.status = 'Requested';
  else lead.documents.push({ name: req.body.name, status: 'Requested' });
  lead.stage = 'Documents Requested';
  lead.stageHistory.push({ stage: lead.stage, remarks: `Requested ${req.body.name}` });
  await lead.save();
  res.json({ success: true, message: `${req.body.name} requested`, data: lead });
});

exports.sendEmail = asyncHandler(async (req, res) => {
  const manager = await managerFor(req.user._id);
  const lead = await SalesLead.findOne({ _id: req.params.id, ...leadScope(manager) });
  if (!lead) throw new ApiError(404, 'Lead not found');
  if (!lead.email) throw new ApiError(422, 'Add the customer email before sending an email');
  await sendMail({ to: lead.email, subject: req.body.subject, text: req.body.message });
  lead.emailLog.push({ subject: req.body.subject, message: req.body.message });
  await lead.save();
  res.json({ success: true, message: 'Email sent', data: lead });
});
