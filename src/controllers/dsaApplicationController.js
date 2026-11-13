const crypto = require('crypto');
const Company = require('../models/Company');
const Dsa = require('../models/Dsa');
const DsaApplication = require('../models/DsaApplication');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const paginate = require('../utils/pagination');
const { hashPassword } = require('../utils/password');
const { encryptDsaPrivateDetails, decryptDsaPrivateDetails } = require('../utils/dsaApplicationCrypto');
const { audit } = require('../utils/audit');
const { companyBlockReason } = require('../services/accessService');

exports.register = asyncHandler(async (req, res) => {
  const { password, confirmPassword, ...fields } = req.body;
  const user = await User.create({
    role: 'dsa',
    name: fields.name,
    email: fields.email,
    phone: fields.phone,
    passwordHash: await hashPassword(password),
    status: 'pending',
    selfRegistered: true,
  });
  let application;
  try {
    application = await DsaApplication.create({
      userId: user._id,
      name: fields.name,
      phone: fields.phone,
      email: fields.email,
      occupation: fields.occupation,
      privateDetails: encryptDsaPrivateDetails({
        accountHolder: fields.accountHolder,
        bankName: fields.bankName,
        accountNumber: fields.accountNumber,
        ifsc: fields.ifsc,
        aadhaar: fields.aadhaar,
        pan: fields.pan,
      }),
    });
  } catch (error) {
    await User.deleteOne({ _id: user._id });
    throw error;
  }
  await audit(req, { action: 'REGISTER', entity: 'dsa_application', entityId: application._id, meta: { name: application.name }, user });
  res.status(201).json({ success: true, message: 'Your DSA account request has been submitted. Sign in to view your approval status.' });
});

exports.list = asyncHandler(async (req, res) => {
  const { page, limit, skip, sort } = paginate(req.query, ['createdAt', 'name', 'email', 'status'], 'createdAt');
  const query = { ...(req.query.status ? { status: req.query.status } : {}) };
  const [items, total] = await Promise.all([
    DsaApplication.find(query).select('+privateDetails').sort(sort).skip(skip).limit(limit).lean(),
    DsaApplication.countDocuments(query),
  ]);
  const data = items.map(({ privateDetails, ...application }) => ({
    ...application,
    privateDetails: decryptDsaPrivateDetails(privateDetails),
  }));
  res.json({ success: true, data: { items: data, total, page, limit, pages: Math.ceil(total / limit) } });
});

exports.review = asyncHandler(async (req, res) => {
  const application = await DsaApplication.findOne({ _id: req.params.id, status: 'pending' });
  if (!application) throw new ApiError(404, 'Pending DSA application not found');
  const user = await User.findById(application.userId);
  if (!user || user.status !== 'pending') throw new ApiError(409, 'Applicant account is no longer pending');

  if (req.body.action === 'reject') {
    application.status = 'rejected';
    application.reviewedBy = req.user._id;
    application.reviewedAt = new Date();
    user.status = 'rejected';
    user.refreshTokens = [];
    try {
      await user.save();
      await application.save();
    } catch (error) {
      await Promise.all([
        User.updateOne({ _id: user._id }, { status: 'pending' }),
        DsaApplication.updateOne({ _id: application._id }, { status: 'pending', reviewedBy: null, reviewedAt: null }),
      ]);
      throw error;
    }
    await audit(req, { action: 'REJECT', entity: 'dsa_application', entityId: application._id, meta: { name: application.name }, user, companyId: null });
    return res.json({ success: true, message: 'DSA application rejected' });
  }

  const company = await Company.findOne({ _id: req.body.companyId, deletedAt: null });
  const unavailableReason = companyBlockReason(company);
  if (unavailableReason) throw new ApiError(422, unavailableReason);

  let dsaId;
  do {
    dsaId = `DSA-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
  } while (await User.exists({ companyId: company._id, role: 'dsa', loginId: dsaId, deletedAt: null }));

  const dsa = await Dsa.create({
    companyId: company._id,
    userId: user._id,
    name: application.name,
    dsaId,
    email: application.email,
    phone: application.phone,
    branch: 'Not assigned',
    loanTypeIds: [],
    bankIds: [],
    status: 'active',
  });
  user.companyId = company._id;
  user.loginId = dsaId;
  user.status = 'active';
  application.status = 'approved';
  application.companyId = company._id;
  application.dsaId = dsaId;
  application.reviewedBy = req.user._id;
  application.reviewedAt = new Date();
  try {
    await user.save();
    await application.save();
  } catch (error) {
    await Promise.all([
      Dsa.deleteOne({ _id: dsa._id }),
      User.updateOne({ _id: user._id }, { companyId: null, loginId: null, status: 'pending' }),
      DsaApplication.updateOne({ _id: application._id }, { status: 'pending', companyId: null, dsaId: '', reviewedBy: null, reviewedAt: null }),
    ]);
    throw error;
  }
  await audit(req, { action: 'APPROVE', entity: 'dsa_application', entityId: application._id, meta: { name: application.name, dsaId, company: company.name }, user, companyId: company._id });
  res.json({ success: true, message: `DSA approved. Login code: ${dsaId}`, data: { dsaId, company: company.name } });
});
