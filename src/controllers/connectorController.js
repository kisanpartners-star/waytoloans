const Connector = require('../models/Connector');
const ConnectorLead = require('../models/ConnectorLead');
const Bank = require('../models/Bank');
const BankRegistration = require('../models/BankRegistration');
const LoanType = require('../models/LoanType');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { listTenant } = require('../services/listService');
const { createAccount, updateAccount, setAccountStatus, softDeleteAccount } = require('../services/accountService');
const { audit } = require('../utils/audit');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { documentDirectory } = require('../middleware/connectorDocumentUpload');
const leadValidator = require('../validators/connectorLeadValidator');

const find = async (req) => {
  const c = await Connector.findOne({ _id: req.params.id, companyId: req.user.companyId, deletedAt: null });
  if (!c) throw new ApiError(404, 'Connector not found');
  return c;
};
exports.list = asyncHandler(async (req, res) => {
  const extra = {}; if (req.query.registration === 'self') extra.selfRegistered = true;
  res.json({ success: true, data: await listTenant(Connector, req, { searchFields: ['fullName', 'email', 'phone'], sortable: ['createdAt', 'fullName', 'email', 'status'], extra }) });
});

exports.updateLead = asyncHandler(async (req, res) => {
  const connector = await Connector.findOne({ userId: req.user._id, companyId: req.user.companyId, deletedAt: null, status: 'active' });
  if (!connector) throw new ApiError(403, 'An active connector profile is required to edit leads');
  const lead = await leadForConnector(req, req.params.id);
  if (lead.status === 'disabled') throw new ApiError(409, 'Enable this lead before editing it');
  const { error, value } = leadValidator.update.validate(req.body, { abortEarly: false, stripUnknown: false });
  if (error) {
    await Promise.all((req.files || []).map((file) => fs.promises.unlink(file.path).catch((unlinkError) => {
      if (unlinkError.code !== 'ENOENT') throw unlinkError;
    })));
    throw new ApiError(422, error.details.map((item) => item.message).join('; '));
  }
  const application = JSON.parse(value.application);
  const categories = JSON.parse(value.documentCategories);
  if (!await LoanType.exists({ name: application.loanType, deletedAt: null, status: 'published' })) {
    await Promise.all((req.files || []).map((file) => fs.promises.unlink(file.path).catch((unlinkError) => {
      if (unlinkError.code !== 'ENOENT') throw unlinkError;
    })));
    throw new ApiError(422, 'Select a currently published loan type from the Boss loan types');
  }
  if (categories.length !== (req.files || []).length) {
    await Promise.all((req.files || []).map((file) => fs.promises.unlink(file.path)));
    throw new ApiError(422, 'Each uploaded file must have a document type');
  }
  try {
    const existingCategories = lead.documents.map((document) => document.category);
    const eligibility = await eligibleBanks(application, [...existingCategories, ...categories]);
    Object.assign(lead, {
      loanType: application.loanType,
      applicationStatus: application.applicationStatus,
      personalDetails: application.personalDetails,
      incomeDetails: application.incomeDetails,
      requestedLoanAmount: application.requestedLoanAmount,
      requestedTenureMonths: application.requestedTenureMonths,
      proposedEmi: application.proposedEmi,
      latestCibilScore: application.latestCibilScore === '' ? undefined : application.latestCibilScore,
      existingLoans: application.existingLoans,
      hasDelayedPayments: application.hasDelayedPayments,
      delayedPayments: application.delayedPayments,
      hasLoanSettlement: application.hasLoanSettlement,
      settlementDetails: application.settlementDetails,
      recentApplications: application.recentApplications,
      hasRecentApplications: application.hasRecentApplications,
      eligibility,
      documents: [...lead.documents, ...(req.files || []).map((file, index) => ({
        category: categories[index],
        originalName: path.basename(file.originalname).replace(/[\r\n"]/g, '').slice(0, 180),
        storageName: path.basename(file.filename),
        mimeType: file.mimetype,
        size: file.size,
      }))],
    });
    await lead.save();
    await audit(req, { action: 'UPDATE', entity: 'connectorLead', entityId: lead._id, meta: { leadId: lead.leadId, loanType: lead.loanType } });
  } catch (error) {
    await Promise.all((req.files || []).map((file) => fs.promises.unlink(file.path).catch((unlinkError) => {
      if (unlinkError.code !== 'ENOENT') throw unlinkError;
    })));
    throw error;
  }
  const responseLead = lead.toObject();
  responseLead.documents = responseLead.documents.map(({ storageName, ...document }) => document);
  res.json({ success: true, message: 'Lead updated', data: { lead: responseLead, eligibility: lead.eligibility } });
});

exports.setLeadStatus = asyncHandler(async (req, res) => {
  const lead = await leadForConnector(req, req.params.id);
  lead.status = req.body.action === 'disable' ? 'disabled' : 'submitted';
  await lead.save();
  await audit(req, { action: 'STATUS_CHANGE', entity: 'connectorLead', entityId: lead._id, meta: { leadId: lead.leadId, status: lead.status } });
  res.json({ success: true, message: `Lead ${req.body.action}d`, data: { id: lead._id, status: lead.status } });
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

const leadForConnector = async (req, id) => {
  const lead = await ConnectorLead.findOne({
    _id: id,
    companyId: req.user.companyId,
    connectorId: req.user._id,
    deletedAt: null,
  });
  if (!lead) throw new ApiError(404, 'Lead not found');
  return lead;
};

const normalizeLoanType = (value) => String(value || '').toLowerCase()
  .replace(/[^a-z0-9]/g, '')
  .replace(/vehical/g, 'vehicle')
  .replace(/projects?loans?/g, 'projectloan');
const ageInYears = (value) => {
  if (!value) return null;
  const born = new Date(value);
  if (Number.isNaN(born.getTime())) return null;
  const now = new Date();
  return now.getFullYear() - born.getFullYear() - (now < new Date(now.getFullYear(), born.getMonth(), born.getDate()) ? 1 : 0);
};
const evaluatePolicy = (policy, application, documentCategories) => {
  const checks = [];
  const addCheck = (name, requirement, actual, status, message) => checks.push({ name, requirement, actual, status, message });
  const income = Number(application.incomeDetails.netSalary || application.incomeDetails.grossSalary || 0);
  const age = ageInYears(application.personalDetails.dateOfBirth);

  if (policy.minimumAge != null) {
    if (age == null) addCheck('Minimum age', `At least ${policy.minimumAge} years`, 'Date of birth not provided', 'review', 'Add date of birth to confirm this requirement');
    else if (age < policy.minimumAge) addCheck('Minimum age', `At least ${policy.minimumAge} years`, `${age} years`, 'fail', `Applicant is below the minimum age of ${policy.minimumAge}`);
    else addCheck('Minimum age', `At least ${policy.minimumAge} years`, `${age} years`, 'pass', 'Minimum age requirement met');
  }
  if (policy.maximumAge != null) {
    if (age == null) addCheck('Maximum age', `At most ${policy.maximumAge} years`, 'Date of birth not provided', 'review', 'Add date of birth to confirm this requirement');
    else if (age > policy.maximumAge) addCheck('Maximum age', `At most ${policy.maximumAge} years`, `${age} years`, 'fail', `Applicant exceeds the maximum age of ${policy.maximumAge}`);
    else addCheck('Maximum age', `At most ${policy.maximumAge} years`, `${age} years`, 'pass', 'Maximum age requirement met');
  }
  if (policy.minimumMonthlyIncome != null) {
    if (!income) addCheck('Monthly income', `At least ${policy.minimumMonthlyIncome}`, 'Income not provided', 'review', 'Add net or gross monthly income to check this requirement');
    else if (income < policy.minimumMonthlyIncome) addCheck('Monthly income', `At least ${policy.minimumMonthlyIncome}`, income, 'fail', `Income is below the minimum monthly income of ${policy.minimumMonthlyIncome}`);
    else addCheck('Monthly income', `At least ${policy.minimumMonthlyIncome}`, income, 'pass', 'Minimum income requirement met');
  }
  if (policy.minimumCibilScore != null) {
    if (application.latestCibilScore == null || application.latestCibilScore === '') addCheck('CIBIL score', `At least ${policy.minimumCibilScore}`, 'CIBIL score not provided', 'review', 'Add the latest CIBIL score to confirm this requirement');
    else if (Number(application.latestCibilScore) < policy.minimumCibilScore) addCheck('CIBIL score', `At least ${policy.minimumCibilScore}`, Number(application.latestCibilScore), 'fail', `CIBIL score is below the minimum of ${policy.minimumCibilScore}`);
    else addCheck('CIBIL score', `At least ${policy.minimumCibilScore}`, Number(application.latestCibilScore), 'pass', 'Minimum CIBIL score requirement met');
  }
  if (policy.minimumLoanAmount != null) {
    if (application.requestedLoanAmount < policy.minimumLoanAmount) addCheck('Loan amount minimum', `At least ${policy.minimumLoanAmount}`, application.requestedLoanAmount, 'fail', `Requested amount is below the minimum of ${policy.minimumLoanAmount}`);
    else addCheck('Loan amount minimum', `At least ${policy.minimumLoanAmount}`, application.requestedLoanAmount, 'pass', 'Minimum loan amount requirement met');
  }
  if (policy.maximumLoanAmount != null) {
    if (application.requestedLoanAmount > policy.maximumLoanAmount) addCheck('Loan amount maximum', `At most ${policy.maximumLoanAmount}`, application.requestedLoanAmount, 'fail', `Requested amount exceeds the maximum of ${policy.maximumLoanAmount}`);
    else addCheck('Loan amount maximum', `At most ${policy.maximumLoanAmount}`, application.requestedLoanAmount, 'pass', 'Maximum loan amount requirement met');
  }
  if (policy.maximumTenure != null) {
    if (application.requestedTenureMonths == null || application.requestedTenureMonths === '') addCheck('Loan tenure', `At most ${policy.maximumTenure} months`, 'Tenure not provided', 'review', 'Add requested tenure to check this requirement');
    else if (Number(application.requestedTenureMonths) > policy.maximumTenure) addCheck('Loan tenure', `At most ${policy.maximumTenure} months`, `${application.requestedTenureMonths} months`, 'fail', `Requested tenure exceeds the maximum of ${policy.maximumTenure} months`);
    else addCheck('Loan tenure', `At most ${policy.maximumTenure} months`, `${application.requestedTenureMonths} months`, 'pass', 'Maximum tenure requirement met');
  }
  if (policy.maximumFoir != null) {
    const currentEmi = (application.existingLoans || []).reduce((total, loan) => total + Number(loan.emi || 0), 0);
    if (!income) addCheck('FOIR', `At most ${policy.maximumFoir}%`, 'Monthly income not provided', 'review', 'Add monthly income to calculate FOIR');
    else {
      if (application.proposedEmi == null || application.proposedEmi === '') {
        addCheck('FOIR', `At most ${policy.maximumFoir}%`, 'Expected EMI not provided', 'review', 'Add expected new EMI to calculate FOIR');
      } else {
        const currentFoir = (currentEmi + Number(application.proposedEmi)) / income * 100;
        if (currentFoir > policy.maximumFoir) addCheck('FOIR', `At most ${policy.maximumFoir}%`, `${currentFoir.toFixed(1)}%`, 'fail', `Estimated FOIR exceeds the maximum of ${policy.maximumFoir}%`);
        else addCheck('FOIR', `At most ${policy.maximumFoir}%`, `${currentFoir.toFixed(1)}%`, 'pass', 'FOIR requirement met');
      }
    }
  }
  if (policy.employmentTypeRestriction) {
    const restrictions = String(policy.employmentTypeRestriction).split(/[,/|]/).map(normalizeLoanType).filter(Boolean);
    const employment = normalizeLoanType(application.incomeDetails.employmentType);
    if (restrictions.includes(employment)) addCheck('Employment type', policy.employmentTypeRestriction, application.incomeDetails.employmentType, 'pass', 'Employment type is allowed');
    else addCheck('Employment type', policy.employmentTypeRestriction, application.incomeDetails.employmentType || 'Not provided', 'fail', 'Employment type is not allowed by this policy');
  }
  if (policy.cityStateRestriction) {
    const address = `${application.personalDetails.presentAddress || ''} ${application.personalDetails.presentPincode || ''} ${application.personalDetails.permanentAddress || ''} ${application.personalDetails.permanentPincode || ''}`.toLowerCase();
    const restrictions = String(policy.cityStateRestriction).split(/[,/|]/).map((part) => part.trim().toLowerCase()).filter(Boolean);
    const matches = restrictions.some((part) => address.includes(part));
    if (matches) addCheck('Location', policy.cityStateRestriction, 'Matches application address/pincode', 'pass', 'Location restriction matched');
    else if (!address.trim()) addCheck('Location', policy.cityStateRestriction, 'Address not provided', 'review', 'Add an address or pincode to check the location restriction');
    else addCheck('Location', policy.cityStateRestriction, 'No matching location found', 'fail', 'Application address does not match the configured location restriction');
  }
  if (policy.requiredDocuments?.length) {
    const uploaded = new Set(documentCategories);
    for (const required of policy.requiredDocuments) {
      const normalized = normalizeLoanType(required);
      const mapped = normalized.includes('aadhaar') || normalized.includes('aadhar') ? 'aadhaarCard'
        : normalized.includes('pan') ? 'panCard'
          : normalized.includes('salary') || normalized.includes('payslip') ? 'payslip'
            : normalized.includes('bankstatement') ? 'bankStatement'
              : normalized.includes('form16') ? 'form16'
                : normalized.includes('form26as') ? 'form26as'
                  : normalized.includes('pf') ? 'pfStatement' : null;
      const status = mapped && uploaded.has(mapped) ? 'pass' : 'review';
      addCheck(`Document: ${required}`, 'Uploaded', status === 'pass' ? 'Uploaded' : 'Not uploaded', status,
        status === 'pass' ? 'Required document uploaded' : `Upload the required document: ${required}`);
    }
  }
  if (policy.manualReview) addCheck('Manual review', 'Bank review required', 'Pending', 'review', 'This bank policy requires manual review');
  if (!checks.length) addCheck('Policy configuration', 'At least one eligibility criterion', 'No criteria configured', 'review', 'This policy has no configured criteria to evaluate');
  const passed = checks.filter((item) => item.status === 'pass').length;
  const score = checks.length ? Math.round((passed / checks.length) * 100) : 0;
  const failed = checks.filter((item) => item.status === 'fail');
  const pending = checks.filter((item) => item.status === 'review');
  return {
    status: failed.length ? 'ineligible' : pending.length ? 'review' : 'eligible',
    score,
    matchedCriteria: passed,
    totalCriteria: checks.length,
    reasons: failed.map((item) => item.message),
    reviewItems: pending.map((item) => item.message),
    checks,
  };
};

const getBossRegisteredBanks = async () => {
  const registrations = await BankRegistration.find({
    deletedAt: null,
    bankId: { $ne: null },
    status: { $in: ['active', 'disabled'] },
  }).select('bankId bankName loanPolicies status accountDisabled companyId').lean();
  const bankAccounts = await Bank.find({
    _id: { $in: registrations.map((registration) => registration.bankId) },
    deletedAt: null,
  }).select('_id status').lean();
  const statusById = new Map(bankAccounts.map((bank) => [String(bank._id), bank.status]));
  return registrations.map((registration) => ({
    ...registration,
    accountStatus: statusById.get(String(registration.bankId)) || 'unavailable',
  }));
};

const compareWithBossBanks = (banks, application, documentCategories) => banks.map((bank) => {
  const policy = (bank.loanPolicies || []).find((item) => item.active !== false && normalizeLoanType(item.loanType) === normalizeLoanType(application.loanType));
  if (!policy) return null;

  const base = {
    bankId: bank.bankId,
    bankType: 'bossRegistration',
    bankName: bank.bankName,
    registrationId: bank._id,
    bankCompanyId: bank.companyId,
  };
  if (bank.status !== 'active' || bank.accountDisabled || bank.accountStatus !== 'active') {
    const status = bank.status !== 'active' ? bank.status : bank.accountDisabled ? 'disabled' : bank.accountStatus;
    return {
      ...base,
      status: 'unavailable',
      score: 0,
      matchedCriteria: 0,
      totalCriteria: 1,
      reasons: [`Boss-registered bank account is ${status || 'not active'}`],
      reviewItems: [],
      checks: [{ name: 'Bank account status', requirement: 'Active Boss-registered bank', actual: status || 'Unknown', status: 'fail', message: 'This Boss-registered bank is not currently available for applications' }],
    };
  }
  return { ...base, ...evaluatePolicy(policy, application, documentCategories) };
}).filter(Boolean);

const eligibleBanks = async (application, documentCategories) => compareWithBossBanks(
  await getBossRegisteredBanks(), application, documentCategories,
);
exports.eligibleBanks = eligibleBanks;

exports.listLeads = asyncHandler(async (req, res) => {
  const connector = await Connector.findOne({ userId: req.user._id, companyId: req.user.companyId, deletedAt: null });
  if (!connector) throw new ApiError(403, 'Connector profile not found');
  const [items, bossBanks] = await Promise.all([ConnectorLead.find({
    companyId: req.user.companyId,
    connectorId: req.user._id,
    deletedAt: null,
  }).sort({ createdAt: -1 }).limit(100).select('-documents.storageName').lean(), getBossRegisteredBanks()]);
  items.forEach((lead) => {
    lead.eligibility = compareWithBossBanks(
      bossBanks,
      {
        loanType: lead.loanType,
        personalDetails: lead.personalDetails,
        incomeDetails: lead.incomeDetails,
        requestedLoanAmount: lead.requestedLoanAmount,
        requestedTenureMonths: lead.requestedTenureMonths,
        proposedEmi: lead.proposedEmi,
        latestCibilScore: lead.latestCibilScore,
        existingLoans: lead.existingLoans,
      },
      lead.documents.map((document) => document.category),
    );
    lead.documents?.forEach((document) => { delete document.storageName; });
  });
  res.json({ success: true, data: { items, total: items.length } });
});

exports.createLead = asyncHandler(async (req, res) => {
  const connector = await Connector.findOne({ userId: req.user._id, companyId: req.user.companyId, deletedAt: null, status: 'active' });
  if (!connector) throw new ApiError(403, 'An active connector profile is required to create leads');
  const { error, value } = leadValidator.create.validate(req.body, { abortEarly: false, stripUnknown: false });
  if (error) {
    await Promise.all((req.files || []).map((file) => fs.promises.unlink(file.path).catch((unlinkError) => {
      if (unlinkError.code !== 'ENOENT') throw unlinkError;
    })));
    throw new ApiError(422, error.details.map((item) => item.message).join('; '));
  }
  const application = JSON.parse(value.application);
  const categories = JSON.parse(value.documentCategories);
  const loanTypeExists = await LoanType.exists({
    name: application.loanType,
    deletedAt: null,
    status: 'published',
  });
  if (!loanTypeExists) {
    await Promise.all((req.files || []).map((file) => fs.promises.unlink(file.path).catch((unlinkError) => {
      if (unlinkError.code !== 'ENOENT') throw unlinkError;
    })));
    throw new ApiError(422, 'Select a currently published loan type from the Boss loan types');
  }
  if (categories.length !== (req.files || []).length) {
    await Promise.all((req.files || []).map((file) => fs.promises.unlink(file.path)));
    throw new ApiError(422, 'Each uploaded file must have a document type');
  }
  let eligibility;
  let lead;
  try {
    eligibility = await eligibleBanks(application, categories);
    const documents = (req.files || []).map((file, index) => ({
      category: categories[index],
      originalName: path.basename(file.originalname).replace(/[\r\n"]/g, '').slice(0, 180),
      storageName: path.basename(file.filename),
      mimeType: file.mimetype,
      size: file.size,
    }));
    lead = await ConnectorLead.create({
      companyId: req.user.companyId,
      connectorId: req.user._id,
      createdBy: req.user._id,
      leadId: `C-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
      loanType: application.loanType,
      applicationStatus: application.applicationStatus,
      personalDetails: application.personalDetails,
      incomeDetails: application.incomeDetails,
      requestedLoanAmount: application.requestedLoanAmount,
      requestedTenureMonths: application.requestedTenureMonths,
      proposedEmi: application.proposedEmi,
      latestCibilScore: application.latestCibilScore === '' ? undefined : application.latestCibilScore,
      existingLoans: application.existingLoans,
      hasDelayedPayments: application.hasDelayedPayments,
      delayedPayments: application.delayedPayments,
      hasLoanSettlement: application.hasLoanSettlement,
      settlementDetails: application.settlementDetails,
      recentApplications: application.recentApplications,
      hasRecentApplications: application.hasRecentApplications,
      documents,
      eligibility,
    });
  } catch (error) {
    await Promise.all((req.files || []).map((file) => fs.promises.unlink(file.path).catch((unlinkError) => {
      if (unlinkError.code !== 'ENOENT') throw unlinkError;
    })));
    throw error;
  }
  await audit(req, { action: 'CREATE', entity: 'connectorLead', entityId: lead._id, meta: { leadId: lead.leadId, loanType: lead.loanType } });
  const responseLead = lead.toObject();
  responseLead.documents = responseLead.documents.map(({ storageName, ...document }) => document);
  res.status(201).json({ success: true, message: 'Lead submitted', data: { lead: responseLead, eligibility } });
});

exports.downloadLeadDocument = asyncHandler(async (req, res) => {
  const lead = await leadForConnector(req, req.params.id);
  const document = lead.documents.id(req.params.docId);
  if (!document) throw new ApiError(404, 'Document not found');
  const filePath = path.join(documentDirectory, path.basename(document.storageName));
  if (!fs.existsSync(filePath)) throw new ApiError(404, 'Stored document is unavailable');
  res.download(filePath, document.originalName);
});
