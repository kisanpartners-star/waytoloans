const Bank = require('../models/Bank');
const BankRegistration = require('../models/BankRegistration');
const ConnectorLead = require('../models/ConnectorLead');
const Employee = require('../models/Employee');
const LoanSubmission = require('../models/LoanSubmission');
const SalesManager = require('../models/SalesManager');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { audit } = require('../utils/audit');
const fs = require('fs');
const path = require('path');
const { documentDirectory } = require('../middleware/connectorDocumentUpload');
const { eligibleBanks } = require('./connectorController');

const leadForConnector = async (req, id) => {
  const lead = await ConnectorLead.findOne({
    _id: id,
    companyId: req.user.companyId,
    connectorId: req.user._id,
    deletedAt: null,
    status: { $ne: 'disabled' },
  });
  if (!lead) throw new ApiError(404, 'Lead not found or disabled');
  return lead;
};

const applicationDetails = (lead) => ({
  loanType: lead.loanType,
  personalDetails: lead.personalDetails,
  incomeDetails: lead.incomeDetails,
  requestedLoanAmount: lead.requestedLoanAmount,
  requestedTenureMonths: lead.requestedTenureMonths,
  proposedEmi: lead.proposedEmi,
  latestCibilScore: lead.latestCibilScore,
  existingLoans: lead.existingLoans,
});

const activeBankMatch = async (lead, bankId) => {
  const matching = (await eligibleBanks(applicationDetails(lead), lead.documents.map((document) => document.category)))
    .find((candidate) => String(candidate.bankId) === String(bankId));
  if (!matching || matching.status === 'unavailable' || matching.score < 10) {
    throw new ApiError(422, 'Apply is available only when the active bank policy has a match score of at least 10%');
  }
  const [registration, bank] = await Promise.all([
    BankRegistration.findOne({
      _id: matching.registrationId,
      bankId,
      deletedAt: null,
      status: 'active',
      accountDisabled: { $ne: true },
    }),
    Bank.findOne({ _id: bankId, deletedAt: null, status: 'active' }).select('_id companyId bankName'),
  ]);
  if (!registration || !bank) throw new ApiError(404, 'Boss-registered bank is no longer active');
  return { registration, bank, matching };
};

const bankTeam = async (bankId, companyId) => {
  const [employees, managers] = await Promise.all([
    Employee.find({
      $or: [{ bankId }, { bankIds: bankId }],
      companyId,
      deletedAt: null,
      status: 'active',
      accountDisabled: { $ne: true },
      userId: { $ne: null },
    }).select('userId name employeeId employmentRole department email phone status').lean(),
    SalesManager.find({
      bankId,
      bankType: 'bank',
      deletedAt: null,
      status: 'active',
      userId: { $ne: null },
    }).select('userId name employeeId designation email phone status').lean(),
  ]);
  const byUser = new Map();
  employees.forEach((employee) => {
    byUser.set(String(employee.userId), {
      userId: employee.userId,
      name: employee.name,
      employeeId: employee.employeeId || '',
      designation: employee.employmentRole || employee.department || '',
      email: employee.email || '',
      phone: employee.phone || '',
      staffType: 'employee',
    });
  });
  managers.forEach((manager) => {
    byUser.set(String(manager.userId), {
      userId: manager.userId,
      name: manager.name,
      employeeId: manager.employeeId || '',
      designation: manager.designation || '',
      email: manager.email || '',
      phone: manager.phone || '',
      staffType: 'salesManager',
    });
  });
  const userIds = [...byUser.values()].map((person) => person.userId);
  const activeUsers = await User.find({ _id: { $in: userIds }, status: 'active', deletedAt: null }).select('_id').lean();
  const activeUserIds = new Set(activeUsers.map((user) => String(user._id)));
  return [...byUser.values()]
    .filter((person) => activeUserIds.has(String(person.userId)))
    .sort((a, b) => a.name.localeCompare(b.name));
};

exports.teamOptions = asyncHandler(async (req, res) => {
  const lead = await leadForConnector(req, req.params.id);
  const { bank, matching } = await activeBankMatch(lead, req.params.bankId);
  res.json({ success: true, data: { bankName: bank.bankName, matchScore: matching.score, employees: await bankTeam(bank._id, bank.companyId) } });
});

exports.create = asyncHandler(async (req, res) => {
  const lead = await leadForConnector(req, req.params.id);
  const { registration, bank, matching } = await activeBankMatch(lead, req.body.bankId);
  const team = await bankTeam(bank._id, bank.companyId);
  const selected = new Set(req.body.assigneeUserIds);
  const assignees = team.filter((person) => selected.has(String(person.userId)));
  if (assignees.length !== selected.size) throw new ApiError(422, 'One or more selected bank team members are no longer active');

  const applicationSnapshot = {
    leadId: lead.leadId,
    applicationStatus: lead.applicationStatus,
    personalDetails: lead.personalDetails.toObject ? lead.personalDetails.toObject() : lead.personalDetails,
    incomeDetails: lead.incomeDetails.toObject ? lead.incomeDetails.toObject() : lead.incomeDetails,
    requestedLoanAmount: lead.requestedLoanAmount,
    requestedTenureMonths: lead.requestedTenureMonths,
    proposedEmi: lead.proposedEmi,
    latestCibilScore: lead.latestCibilScore,
    existingLoans: lead.existingLoans,
    hasDelayedPayments: lead.hasDelayedPayments,
    delayedPayments: lead.delayedPayments,
    hasLoanSettlement: lead.hasLoanSettlement,
    settlementDetails: lead.settlementDetails,
    hasRecentApplications: lead.hasRecentApplications,
    recentApplications: lead.recentApplications,
    documents: lead.documents.map(({ _id, category, originalName, mimeType, size }) => ({
      id: String(_id), category, originalName, mimeType, size,
    })),
  };
  const submission = await LoanSubmission.create({
    leadId: lead._id,
    connectorId: lead.connectorId,
    companyId: lead.companyId,
    bankCompanyId: bank.companyId,
    bankRegistrationId: registration._id,
    bankId: bank._id,
    bankName: registration.bankName,
    connectorName: req.user.name,
    connectorEmail: req.user.email || '',
    loanType: lead.loanType,
    matchScore: matching.score,
    assignees,
    applicationSnapshot,
  });
  await audit(req, {
    action: 'CREATE',
    entity: 'loanSubmission',
    entityId: submission._id,
    meta: { leadId: lead.leadId, bankId: bank._id, bankName: registration.bankName, assigneeCount: assignees.length },
  });
  res.status(201).json({ success: true, message: 'Loan application submitted to bank', data: submission });
});

const scopeFor = async (req) => {
  if (req.user.role === 'connector') return { companyId: req.user.companyId, connectorId: req.user._id };
  if (req.user.role === 'admin') return { $or: [{ companyId: req.user.companyId }, { bankCompanyId: req.user.companyId }] };
  if (req.user.role === 'bank') {
    const bank = await Bank.findOne({ userId: req.user._id, companyId: req.user.companyId, deletedAt: null });
    if (!bank) throw new ApiError(403, 'Bank profile not found');
    return { bankId: bank._id };
  }
  if (req.user.role === 'salesManager') {
    const manager = await SalesManager.findOne({ userId: req.user._id, deletedAt: null, status: 'active' });
    if (!manager) throw new ApiError(403, 'Active bank employee profile not found');
    return { bankId: manager.bankId, 'assignees.userId': req.user._id };
  }
  if (req.user.role === 'employee') {
    const employee = await Employee.findOne({
      userId: req.user._id,
      companyId: req.user.companyId,
      deletedAt: null,
      status: 'active',
    });
    if (!employee) throw new ApiError(403, 'Active employee profile not found');
    const bankIds = [...new Set([...(employee.bankIds || []).map(String), ...(employee.bankId ? [String(employee.bankId)] : [])])];
    if (!bankIds.length) return { _id: { $exists: false } };
    return { bankId: { $in: bankIds }, 'assignees.userId': req.user._id };
  }
  throw new ApiError(403, 'Role is not permitted to view submitted applications');
};

exports.list = asyncHandler(async (req, res) => {
  const query = await scopeFor(req);
  const page = Number(req.query.page || 1);
  const limit = Number(req.query.limit || 50);
  const [items, total] = await Promise.all([
    LoanSubmission.find(query).sort({ submittedAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    LoanSubmission.countDocuments(query),
  ]);
  res.json({ success: true, data: { items, total, page, limit, pages: Math.ceil(total / limit) } });
});

exports.downloadDocument = asyncHandler(async (req, res) => {
  const scope = await scopeFor(req);
  const submission = await LoanSubmission.findOne({
    $and: [scope, { _id: req.params.id }],
  }).select('leadId');
  if (!submission) throw new ApiError(404, 'Submitted application not found');
  const lead = await ConnectorLead.findOne({ _id: submission.leadId, deletedAt: null });
  const document = lead?.documents.id(req.params.documentId);
  if (!document) throw new ApiError(404, 'Submitted document not found');
  const filePath = path.join(documentDirectory, path.basename(document.storageName));
  if (!fs.existsSync(filePath)) throw new ApiError(404, 'Stored document is unavailable');
  res.download(filePath, document.originalName);
});
