const Company = require('../models/Company');
const Bank = require('../models/Bank');
const Connector = require('../models/Connector');
const Employee = require('../models/Employee');
const LoanType = require('../models/LoanType');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { createAccount } = require('../services/accountService');
const { companyBlockReason } = require('../services/accessService');
const { audit } = require('../utils/audit');
const { publicPath } = require('../middleware/upload');

async function openCompany(slug) {
  const c = await Company.findOne({ slug: String(slug).toLowerCase(), deletedAt: null });
  if (!c || c.status === 'draft') throw new ApiError(404, 'Company panel not found');
  const reason = companyBlockReason(c);
  if (reason) throw new ApiError(403, reason);
  return c;
}
exports.registerBank = asyncHandler(async (req, res) => {
  const company = await openCompany(req.params.slug);
  const { password, confirmPassword, ...f } = req.body;
  const { profile, user } = await createAccount({
    Profile: Bank,
    user: { role: 'bank', companyId: company._id, name: f.bankName, email: f.email, phone: f.phone, password, status: 'pending', selfRegistered: true },
    profile: { ...f, status: 'pending', selfRegistered: true },
  });
  await audit(req, { action: 'REGISTER', entity: 'bank', entityId: profile._id, meta: { bankName: f.bankName }, user, companyId: company._id });
  res.status(201).json({ success: true, message: 'Registration submitted. You can sign in once the company admin approves it.' });
});
exports.registerConnector = asyncHandler(async (req, res) => {
  const company = await openCompany(req.params.slug);
  const { password, confirmPassword, ...f } = req.body;
  const { profile, user } = await createAccount({
    Profile: Connector,
    user: { role: 'connector', companyId: company._id, name: f.fullName, email: f.email, phone: f.phone, password, status: 'pending', selfRegistered: true },
    profile: { ...f, status: 'pending', selfRegistered: true },
  });
  await audit(req, { action: 'REGISTER', entity: 'connector', entityId: profile._id, meta: { fullName: f.fullName }, user, companyId: company._id });
  res.status(201).json({ success: true, message: 'Registration submitted. You can sign in once the company admin approves it.' });
});
exports.registerEmployee = asyncHandler(async (req, res) => {
  const company = await openCompany(req.params.slug);
  const { password, confirmPassword, ...fields } = req.body;
  const bankCount = await Bank.countDocuments({
    _id: { $in: fields.bankIds || [] },
    companyId: company._id,
    deletedAt: null,
    status: 'active',
  });
  if (bankCount !== (fields.bankIds || []).length) throw new ApiError(422, 'Select only active banks from this company');
  if (!await LoanType.exists({ _id: fields.loanTypeId, deletedAt: null, status: 'published' })) {
    throw new ApiError(422, 'Select a published loan type');
  }
  const { profile, user } = await createAccount({
    Profile: Employee,
    user: {
      role: 'employee',
      companyId: company._id,
      name: fields.name,
      email: fields.email,
      loginId: fields.employeeId,
      phone: fields.phone,
      password,
      status: 'pending',
      selfRegistered: true,
    },
    profile: {
      ...fields,
      companyId: company._id,
      photoUrl: req.file ? publicPath(req.file) : '',
      selfRegistered: true,
      status: 'pending',
    },
  });
  await audit(req, { action: 'REGISTER', entity: 'employee', entityId: profile._id, meta: { name: profile.name, employeeId: profile.employeeId }, user, companyId: company._id });
  res.status(201).json({ success: true, message: 'Registration submitted. You can sign in once the company admin approves it.' });
});

exports.employeeOptions = asyncHandler(async (req, res) => {
  const company = await openCompany(req.params.slug);
  const [banks, loanTypes] = await Promise.all([
    Bank.find({ companyId: company._id, deletedAt: null, status: 'active' }).select('_id bankName').sort({ bankName: 1 }).lean(),
    LoanType.find({ deletedAt: null, status: 'published' }).select('_id name').sort({ name: 1 }).lean(),
  ]);
  res.json({ success: true, data: { banks, loanTypes } });
});
