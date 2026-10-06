const Company = require('../models/Company');
const Bank = require('../models/Bank');
const Connector = require('../models/Connector');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { createAccount } = require('../services/accountService');
const { companyBlockReason } = require('../services/accessService');
const { audit } = require('../utils/audit');

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
