const jwt = require('jsonwebtoken');
const env = require('../config/env');
const User = require('../models/User');
const Company = require('../models/Company');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { companyBlockReason, userBlockReason, parentBlockReason } = require('../services/accessService');
const DsaApplication = require('../models/DsaApplication');
const GLOBAL_ROLES = ['boss', 'bankPortal', 'salesManager'];

// Verifies the access token and re-checks user + company status on EVERY request.
exports.protect = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization;
  const token = req.cookies?.bz_access || (header && header.startsWith('Bearer ') ? header.slice(7) : null);
  if (!token) throw new ApiError(401, 'Authentication required');
  let payload;
  try { payload = jwt.verify(token, env.accessSecret); } catch (e) { throw new ApiError(401, 'Session expired'); }
  const user = await User.findOne({ _id: payload.sub, deletedAt: null });
  if (!user) throw new ApiError(401, 'Account no longer exists');
  if (user.passwordChangedAt && payload.iat * 1000 < user.passwordChangedAt.getTime() - 1000) throw new ApiError(401, 'Password changed, please sign in again');
  const pendingDsaApplication = user.role === 'dsa' && user.status === 'pending'
    && await DsaApplication.exists({ userId: user._id, status: 'pending' });
  const ub = pendingDsaApplication ? null : userBlockReason(user);
  if (ub) throw new ApiError(403, ub, { code: 'ACCOUNT_BLOCKED' });
  if (pendingDsaApplication && !/(?:^|\/)auth\/(?:me|change-password)$/.test(req.originalUrl.split('?')[0])) {
    throw new ApiError(403, 'Your DSA profile is awaiting Boss approval.');
  }
  if (!GLOBAL_ROLES.includes(user.role)) {
    const company = user.companyId ? await Company.findOne({ _id: user.companyId }) : null;
    if (pendingDsaApplication) {
      req.user = user;
      return next();
    }
    const cb = companyBlockReason(company);
    if (cb) throw new ApiError(403, cb, { code: 'COMPANY_BLOCKED' });
    req.company = company;
    const pb = await parentBlockReason(user);
    if (pb) throw new ApiError(403, pb, { code: 'PARENT_BLOCKED' });
  }
  if (user.role === 'bankPortal' || user.role === 'salesManager') {
    const pb = await parentBlockReason(user);
    if (pb) throw new ApiError(403, pb, { code: 'PARENT_BLOCKED' });
  }
  req.user = user;
  next();
});
