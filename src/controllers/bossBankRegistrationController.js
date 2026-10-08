const Bank = require('../models/Bank');
const BankRegistration = require('../models/BankRegistration');
const Company = require('../models/Company');
const Dsa = require('../models/Dsa');
const Employee = require('../models/Employee');
const LoanType = require('../models/LoanType');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const paginate = require('../utils/pagination');
const escapeRegex = require('../utils/escapeRegex');
const { hashPassword } = require('../utils/password');
const { audit } = require('../utils/audit');
const { createAccount, updateAccount, softDeleteAccount } = require('../services/accountService');

const findRegistration = async (id, includePassword = false) => {
  let query = BankRegistration.findOne({ _id: id, deletedAt: null });
  if (includePassword) query = query.select('+loginPasswordHash');
  const registration = await query;
  if (!registration) throw new ApiError(404, 'Bank registration not found');
  return registration;
};

async function companyFor(id) {
  const company = await Company.findOne({ _id: id, deletedAt: null, status: 'live', enabled: true, blocked: false });
  if (!company) throw new ApiError(422, 'Select an active company for this bank');
  return company;
}

function recordStatus(registration) {
  if (registration.accountDisabled) return 'disabled';
  return registration.bankId?.status || registration.status;
}

exports.list = asyncHandler(async (req, res) => {
  const { page, limit, skip, sort } = paginate(req.query, ['createdAt', 'bankName', 'status', 'updatedAt'], 'updatedAt');
  const query = { deletedAt: null };
  if (req.query.status === 'draft') query.status = 'draft';
  else if (req.query.status === 'disabled') query.accountDisabled = true;
  else if (req.query.status && req.query.status !== 'all') {
    query.status = req.query.status;
    query.accountDisabled = false;
  }
  if (req.query.search) {
    const regex = new RegExp(escapeRegex(req.query.search), 'i');
    query.$or = [{ bankName: regex }, { authorisedPersonName: regex }, { employeeId: regex }, { mobileNumber: regex }];
  }
  const [items, total] = await Promise.all([
    BankRegistration.find(query).populate('companyId', 'name slug').populate('bankId', 'status email').sort(sort).skip(skip).limit(limit).lean(),
    BankRegistration.countDocuments(query),
  ]);
  items.forEach((item) => { item.displayStatus = recordStatus(item); });
  res.json({ success: true, data: { items, total, page, limit, pages: Math.ceil(total / limit) } });
});

exports.options = asyncHandler(async (req, res) => {
  const jobs = [
    Company.find({ deletedAt: null, status: 'live', enabled: true, blocked: false }).select('name slug').sort({ name: 1 }).lean(),
    req.query.companyId && /^[a-f\d]{24}$/i.test(req.query.companyId)
      ? Employee.find({
        deletedAt: null,
        isDraft: false,
        status: 'active',
        accountDisabled: false,
        $or: [
          { companyId: req.query.companyId },
          { 'companyAssignments.companyId': req.query.companyId },
        ],
      }).populate('bankId', 'bankName branchName').populate('loanTypeIds', 'name').populate('companyAssignments.companyId', 'name').select('name employeeId email officialEmail phone altPhone personalEmail department employmentRole reportingManager loanTypeIds photoUrl companyAssignments bankId status').sort({ name: 1 }).limit(200).lean()
      : Promise.resolve([]),
    LoanType.find({ deletedAt: null }).select('name code status').sort({ name: 1 }).lean(),
    req.query.companyId && /^[a-f\d]{24}$/i.test(req.query.companyId)
      ? Bank.find({ companyId: req.query.companyId, deletedAt: null, status: 'active' }).select('branchName branches designations').lean()
      : Promise.resolve([]),
  ];
  const [companies, employees, loanTypes, banks] = await Promise.all(jobs);
  const search = (req.query.search || '').trim();
  const regex = search ? new RegExp(escapeRegex(search), 'i') : null;
  const items = employees.filter((employee) => !regex || [employee.name, employee.employeeId, employee.email, employee.officialEmail, employee.phone].some((value) => regex.test(value || '')))
    .map((employee) => ({
      _id: employee._id,
      name: employee.name,
      staffId: employee.employeeId || '',
      phone: employee.phone || '',
      email: employee.officialEmail || employee.email || '',
      altPhone: employee.altPhone || '',
      personalEmail: employee.personalEmail || '',
      department: employee.department || '',
      designation: employee.employmentRole || '',
      employmentRole: employee.employmentRole || '',
      reportingManager: employee.reportingManager || '',
      loanTypeIds: (employee.loanTypeIds || []).map((loanType) => loanType._id),
      photoUrl: employee.photoUrl || '',
      companyAssignments: (employee.companyAssignments || []).map((assignment) => ({
        companyId: assignment.companyId?._id || assignment.companyId,
        branches: assignment.branches || [],
      })),
      branch: employee.bankId?.branchName || employee.companyAssignments?.find((assignment) => String(assignment.companyId) === req.query.companyId)?.branches?.[0] || '',
      department: '',
      dateOfJoining: employee.dateOfJoining || null,
      status: employee.status,
    }));
  const branches = [...new Set(banks.flatMap((bank) => [...(bank.branches || []), bank.branchName].filter(Boolean)))].sort((a, b) => a.localeCompare(b));
  const designations = [...new Set(banks.flatMap((bank) => bank.designations || []))].sort((a, b) => a.localeCompare(b));
  res.json({ success: true, data: { companies, employees: items, branches, designations, loanTypes } });
});

function versionPolicies(previousPolicies, nextPolicies) {
  return nextPolicies.map((next) => {
    const previous = previousPolicies.find((item) => item.loanType === next.loanType);
    if (!previous) return { ...next, currentVersion: 1, versionHistory: [] };
    const comparable = (item) => ({
      minimumAge: item.minimumAge ?? null,
      maximumAge: item.maximumAge ?? null,
      minimumMonthlyIncome: item.minimumMonthlyIncome ?? null,
      minimumCibilScore: item.minimumCibilScore ?? null,
      maximumFoir: item.maximumFoir ?? null,
      maximumTenure: item.maximumTenure ?? null,
      minimumLoanAmount: item.minimumLoanAmount ?? null,
      maximumLoanAmount: item.maximumLoanAmount ?? null,
      cityStateRestriction: item.cityStateRestriction || '',
      employmentTypeRestriction: item.employmentTypeRestriction || '',
      requiredDocuments: item.requiredDocuments || [],
      manualReview: !!item.manualReview,
      active: item.active !== false,
    });
    const priorHistory = previous.versionHistory || [];
    if (JSON.stringify(comparable(previous)) === JSON.stringify(comparable(next))) {
      return { ...next, currentVersion: previous.currentVersion || priorHistory.length + 1, versionHistory: priorHistory };
    }
    return {
      ...next,
      currentVersion: (previous.currentVersion || priorHistory.length + 1) + 1,
      versionHistory: [...priorHistory, { version: previous.currentVersion || priorHistory.length + 1, updatedAt: new Date(), settings: comparable(previous) }],
    };
  });
}

async function saveRegistration(registration, value) {
  const { loginPassword, confirmPassword, ...registrationValues } = value;
  await companyFor(registrationValues.companyId);
  const nextPolicies = versionPolicies(registration.loanPolicies || [], registrationValues.loanPolicies || []);
  Object.assign(registration, registrationValues, { loanPolicies: nextPolicies });
  await registration.save();
  if (loginPassword) {
    await BankRegistration.updateOne(
      { _id: registration._id },
      { $set: { loginPasswordHash: await hashPassword(loginPassword) } },
    );
  }
}

exports.create = asyncHandler(async (req, res) => {
  await companyFor(req.body.companyId);
  const { loginPassword, confirmPassword, ...registrationValues } = req.body;
  const registration = await BankRegistration.create({
    ...registrationValues,
    createdBy: req.user._id,
    loanPolicies: versionPolicies([], req.body.loanPolicies || []),
    ...(loginPassword ? { loginPasswordHash: await hashPassword(loginPassword) } : {}),
  });
  delete registration._doc.loginPasswordHash;
  await audit(req, { action: 'CREATE', entity: 'bankRegistration', entityId: registration._id, meta: { bankName: registration.bankName, draft: true } });
  res.status(201).json({ success: true, message: 'Bank registration draft saved', data: registration });
});

exports.update = asyncHandler(async (req, res) => {
  const registration = await findRegistration(req.params.id);
  if (registration.bankId && String(registration.companyId) !== req.body.companyId) {
    throw new ApiError(422, 'The company cannot be changed after the bank registration is submitted');
  }
  const loginEmail = req.body.loginEmail;
  if (registration.bankId && !loginEmail) throw new ApiError(422, 'A bank login email is required');
  if (registration.bankId) {
    const bank = await Bank.findById(registration.bankId);
    if (bank && loginEmail) {
      const duplicate = await User.exists({ role: 'bank', companyId: req.body.companyId, email: loginEmail, deletedAt: null, _id: { $ne: bank.userId } });
      if (duplicate) throw new ApiError(409, 'This bank login email already has an account in this company');
    }
  }
  await saveRegistration(registration, req.body);
  if (registration.bankId) {
    const bank = await Bank.findById(registration.bankId);
    if (bank) {
      bank.bankName = registration.bankName;
      bank.contactPerson = registration.authorisedPersonName;
      bank.employeeId = registration.employeeId;
      bank.phone = registration.mobileNumber;
      bank.branches = registration.branches;
      bank.branchName = registration.branches[0] || '';
      bank.designations = registration.designations;
      bank.loanTypes = registration.loanTypes;
      bank.authorisedEmployees = registration.authorisedEmployees;
      bank.loanPolicies = registration.loanPolicies;
      bank.termsAccepted = registration.termsAccepted;
      bank.informationAccuracyConfirmed = registration.informationAccuracyConfirmed;
      bank.authorisationConfirmed = registration.authorisationConfirmed;
      bank.dataProtectionAccepted = registration.dataProtectionAccepted;
      bank.email = registration.loginEmail;
      await bank.save();
      const user = await User.findById(bank.userId);
      if (user) await updateAccount({
        profileDoc: bank,
        userPatch: {
          name: registration.authorisedPersonName,
          email: registration.loginEmail,
          phone: registration.mobileNumber,
        },
        password: req.body.loginPassword,
      });
    }
  }
  await audit(req, { action: 'UPDATE', entity: 'bankRegistration', entityId: registration._id, meta: { bankName: registration.bankName, draft: registration.status === 'draft' } });
  res.json({ success: true, message: registration.status === 'draft' ? 'Bank registration draft saved' : 'Bank registration updated', data: registration });
});

async function validateForSubmission(registration) {
  if (!registration.bankName?.trim()) throw new ApiError(422, 'Bank name is required');
  if (!registration.authorisedPersonName?.trim()) throw new ApiError(422, 'Authorised person name is required');
  if (!registration.mobileNumber?.trim()) throw new ApiError(422, 'Mobile number is required');
  if (!registration.employeeId?.trim()) throw new ApiError(422, 'Employee ID is required');
  if (!registration.loanTypes.length) throw new ApiError(422, 'Select at least one loan type');
  const existingLoanTypes = await LoanType.countDocuments({ name: { $in: registration.loanTypes }, deletedAt: null });
  if (existingLoanTypes !== registration.loanTypes.length) throw new ApiError(422, 'One or more selected loan types are no longer available');
  if (!registration.branches.length) throw new ApiError(422, 'Add or select at least one branch');
  if (!registration.designations.length) throw new ApiError(422, 'Add or select at least one designation');
  if (!registration.authorisedEmployees.length) throw new ApiError(422, 'Add at least one authorised employee');
  for (const employee of registration.authorisedEmployees) {
    if (!employee.name || !employee.staffId || !employee.phone || !employee.email || !employee.designation || !employee.branch) {
      throw new ApiError(422, 'Each authorised employee needs a name, employee ID, mobile, email, designation and branch');
    }
    if (employee.branch && !registration.branches.includes(employee.branch)) throw new ApiError(422, `Add employee branch "${employee.branch}" to the bank branches first`);
    if (employee.designation && !registration.designations.includes(employee.designation)) throw new ApiError(422, `Add employee designation "${employee.designation}" to the designation list first`);
  }
  if (!registration.loanPolicies.length || registration.loanTypes.some((name) => !registration.loanPolicies.some((policy) => policy.loanType === name))) {
    throw new ApiError(422, 'Add a policy configuration for every selected loan type');
  }
  const requiredNumbers = ['minimumAge', 'maximumAge', 'minimumMonthlyIncome', 'minimumCibilScore', 'maximumFoir', 'maximumTenure', 'minimumLoanAmount', 'maximumLoanAmount'];
  for (const policy of registration.loanPolicies) {
    if (requiredNumbers.some((key) => policy[key] === undefined || policy[key] === null)) {
      throw new ApiError(422, `Complete all required policy settings for ${policy.loanType}`);
    }
    if (policy.minimumAge > policy.maximumAge) throw new ApiError(422, `Minimum age must not exceed maximum age for ${policy.loanType}`);
    if (policy.minimumLoanAmount > policy.maximumLoanAmount) throw new ApiError(422, `Minimum loan amount must not exceed maximum loan amount for ${policy.loanType}`);
  }
  if (!registration.loginEmail) throw new ApiError(422, 'A bank login email is required');
  if (!registration.loginPasswordHash) throw new ApiError(422, 'Set a bank login password before submitting');
  if (!registration.informationAccuracyConfirmed || !registration.authorisationConfirmed || !registration.termsAccepted || !registration.dataProtectionAccepted) {
    throw new ApiError(422, 'Confirm all terms and authorisations before submitting');
  }
}

exports.submit = asyncHandler(async (req, res) => {
  const registration = await findRegistration(req.params.id, true);
  if (registration.bankId && registration.status !== 'rejected') throw new ApiError(409, 'This registration has already been submitted');
  await validateForSubmission(registration);
  const company = await companyFor(registration.companyId);
  const email = registration.loginEmail.toLowerCase();
  const currentBank = registration.bankId ? await Bank.findById(registration.bankId).select('userId').lean() : null;
  const existing = await User.exists({
    role: 'bank',
    companyId: company._id,
    email,
    deletedAt: null,
    ...(currentBank ? { _id: { $ne: currentBank.userId } } : {}),
  });
  if (existing) throw new ApiError(409, 'This bank login email already has an account in this company');

  if (registration.bankId && registration.status === 'rejected') {
    const bank = await Bank.findById(registration.bankId);
    if (!bank) throw new ApiError(404, 'Bank account for this registration was not found');
    bank.bankName = registration.bankName;
    bank.contactPerson = registration.authorisedPersonName;
    bank.employeeId = registration.employeeId;
    bank.phone = registration.mobileNumber;
    bank.branches = registration.branches;
    bank.branchName = registration.branches[0];
    bank.designations = registration.designations;
    bank.loanTypes = registration.loanTypes;
    bank.authorisedEmployees = registration.authorisedEmployees;
    bank.loanPolicies = registration.loanPolicies;
    bank.email = email;
    const user = await User.findById(bank.userId);
    if (!user) throw new ApiError(404, 'Bank login for this registration was not found');
    user.name = registration.authorisedPersonName;
    user.email = email;
    user.phone = registration.mobileNumber;
    user.status = 'pending';
    user.passwordHash = registration.loginPasswordHash;
    user.passwordChangedAt = new Date();
    user.mustChangePassword = false;
    user.refreshTokens = [];
    await user.save();
    bank.status = 'pending';
    await bank.save();
    registration.status = 'pending';
    registration.accountDisabled = false;
    await registration.save();
    delete registration._doc.loginPasswordHash;
    await audit(req, { action: 'SUBMIT', entity: 'bankRegistration', entityId: registration._id, meta: { bankName: registration.bankName, status: 'pending' }, companyId: company._id });
    return res.status(201).json({ success: true, message: 'Bank registration resubmitted for admin approval', data: registration });
  }

  const { profile, user } = await createAccount({
    Profile: Bank,
    user: {
      role: 'bank',
      companyId: company._id,
      name: registration.authorisedPersonName,
      email,
      phone: registration.mobileNumber,
      passwordHash: registration.loginPasswordHash,
      status: 'pending',
    },
    profile: {
      bankName: registration.bankName,
      contactPerson: registration.authorisedPersonName,
      employeeId: registration.employeeId,
      email,
      phone: registration.mobileNumber,
      address: company.address,
      branches: registration.branches,
      branchName: registration.branches[0],
      designations: registration.designations,
      loanTypes: registration.loanTypes,
      authorisedEmployees: registration.authorisedEmployees,
      loanPolicies: registration.loanPolicies,
      termsAccepted: registration.termsAccepted,
      informationAccuracyConfirmed: registration.informationAccuracyConfirmed,
      authorisationConfirmed: registration.authorisationConfirmed,
      dataProtectionAccepted: registration.dataProtectionAccepted,
      selfRegistered: true,
      status: 'pending',
      registrationId: registration._id,
    },
  });

  try {
    registration.bankId = profile._id;
    registration.status = 'pending';
    registration.currentStep = 5;
    await registration.save();
    delete registration._doc.loginPasswordHash;
  } catch (error) {
    await Bank.deleteOne({ _id: profile._id });
    await User.deleteOne({ _id: user._id });
    throw error;
  }

  await audit(req, { action: 'SUBMIT', entity: 'bankRegistration', entityId: registration._id, meta: { bankName: registration.bankName, status: 'pending' }, companyId: company._id });
  res.status(201).json({ success: true, message: 'Bank registration submitted for admin approval', data: registration });
});

exports.setStatus = asyncHandler(async (req, res) => {
  const registration = await findRegistration(req.params.id);
  if (req.body.action === 'draft') {
    if (!['pending', 'rejected'].includes(registration.status)) {
      throw new ApiError(400, 'Only pending or rejected registrations can be moved back to draft');
    }
    if (registration.bankId) {
      const bank = await Bank.findById(registration.bankId);
      if (bank) {
        const employees = await Employee.find({ bankId: bank._id, deletedAt: null });
        for (const employee of employees) await softDeleteAccount(employee);
        await Dsa.updateMany({ companyId: bank.companyId }, { $pull: { bankIds: bank._id } });
        await softDeleteAccount(bank);
      }
    }
    registration.bankId = null;
    registration.status = 'draft';
    registration.accountDisabled = false;
    await registration.save();
    await audit(req, { action: 'STATUS_CHANGE', entity: 'bankRegistration', entityId: registration._id, meta: { change: 'draft', bankName: registration.bankName } });
    return res.json({ success: true, message: 'Bank registration moved to draft', data: registration });
  }
  if (registration.status === 'draft') throw new ApiError(400, 'Save and submit the registration before disabling it');
  registration.accountDisabled = req.body.action === 'disable';
  if (registration.bankId) {
    const bank = await Bank.findById(registration.bankId);
    if (bank && (bank.status === 'active' || (req.body.action === 'enable' && bank.status === 'disabled' && bank.reviewedAt))) {
      const nextStatus = registration.accountDisabled ? 'disabled' : 'active';
      bank.status = nextStatus;
      await bank.save();
      await User.updateOne({ _id: bank.userId }, { status: nextStatus, ...(nextStatus !== 'active' ? { refreshTokens: [] } : {}) });
      registration.status = nextStatus;
    }
  }
  await registration.save();
  await audit(req, { action: 'STATUS_CHANGE', entity: 'bankRegistration', entityId: registration._id, meta: { change: req.body.action, bankName: registration.bankName } });
  res.json({ success: true, message: `Bank ${registration.accountDisabled ? 'disabled' : 'enabled'}`, data: registration });
});

exports.remove = asyncHandler(async (req, res) => {
  const registration = await findRegistration(req.params.id);
  if (registration.bankId) {
    const bank = await Bank.findById(registration.bankId);
    if (bank) {
      const employees = await Employee.find({ bankId: bank._id, deletedAt: null });
      for (const employee of employees) await softDeleteAccount(employee);
      await Dsa.updateMany({ companyId: bank.companyId }, { $pull: { bankIds: bank._id } });
      await softDeleteAccount(bank);
    }
  }
  registration.deletedAt = new Date();
  await registration.save();
  await audit(req, { action: 'DELETE', entity: 'bankRegistration', entityId: registration._id, meta: { bankName: registration.bankName } });
  res.json({ success: true, message: 'Bank registration deleted' });
});
