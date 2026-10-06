const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const User = require('../models/User');
const Company = require('../models/Company');
const Setting = require('../models/Setting');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { comparePassword, hashPassword } = require('../utils/password');
const { hash, signAccess, signRefresh, setAuthCookies, clearAuthCookies } = require('../utils/tokens');
const { audit } = require('../utils/audit');
const { companyBlockReason, userBlockReason, parentBlockReason } = require('../services/accessService');
const { sendMail } = require('../services/mailService');

const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 15;
const safeUser = (u) => ({ id: u._id, role: u.role, name: u.name, email: u.email, loginId: u.loginId, phone: u.phone, companyId: u.companyId, status: u.status, mustChangePassword: u.mustChangePassword, lastLoginAt: u.lastLoginAt });
const safeCompany = (c) => c && ({ id: c._id, name: c.name, slug: c.slug, brandName: c.brandName, brandTagline: c.brandTagline, logoUrl: c.logoUrl });

async function issueSession(req, res, user) {
  const access = signAccess(user);
  const refresh = signRefresh(user);
  const decoded = jwt.decode(refresh);
  const now = Date.now();
  const kept = (user.refreshTokens || []).filter((t) => t.expiresAt.getTime() > now).slice(-4);
  kept.push({ hash: hash(refresh), expiresAt: new Date(decoded.exp * 1000) });
  user.refreshTokens = kept;
  await user.save();
  setAuthCookies(res, access, refresh);
}

exports.login = asyncHandler(async (req, res) => {
  const { role, companySlug, identifier, password } = req.body;
  let company = null;
  if (role !== 'boss') {
    company = await Company.findOne({ slug: companySlug, deletedAt: null });
    if (!company || company.status === 'draft') throw new ApiError(404, 'Company panel not found');
  }
  const id = identifier.toLowerCase();
  const user = await User.findOne({ role, companyId: company ? company._id : null, deletedAt: null, $or: [{ email: id }, { loginId: identifier }] }).select('+passwordHash +refreshTokens');
  const fail = async (status, msg, why) => {
    await audit(req, { action: 'LOGIN_FAILED', entity: 'auth', meta: { identifier, role, why }, success: false, user: user || { role, name: identifier }, companyId: company ? company._id : null });
    throw new ApiError(status, msg);
  };
  if (!user) return fail(401, 'Invalid credentials', 'unknown_user');
  if (user.lockUntil && user.lockUntil > new Date()) {
    const mins = Math.ceil((user.lockUntil - Date.now()) / 60000);
    return fail(423, `Account locked after repeated failures. Try again in ${mins} minute(s).`, 'locked');
  }
  if (!(await comparePassword(password, user.passwordHash))) {
    user.failedAttempts += 1;
    if (user.failedAttempts >= MAX_ATTEMPTS) { user.lockUntil = new Date(Date.now() + LOCK_MINUTES * 60000); user.failedAttempts = 0; }
    await user.save();
    return fail(401, 'Invalid credentials', 'bad_password');
  }
  if (company) { const cb = companyBlockReason(company); if (cb) return fail(403, cb, 'company_status'); }
  const ub = userBlockReason(user);
  if (ub) return fail(403, ub, 'user_status');
  const pb = await parentBlockReason(user);
  if (pb) return fail(403, pb, 'parent_status');

  user.failedAttempts = 0; user.lockUntil = null; user.lastLoginAt = new Date(); user.lastLoginIp = req.ip;
  await issueSession(req, res, user);
  await audit(req, { action: 'LOGIN', entity: 'auth', user, companyId: user.companyId });
  res.json({ success: true, message: 'Signed in', data: { user: safeUser(user), company: safeCompany(company) } });
});

exports.refresh = asyncHandler(async (req, res) => {
  const token = req.cookies?.bz_refresh;
  if (!token) throw new ApiError(401, 'Session expired');
  let payload;
  try { payload = jwt.verify(token, env.refreshSecret); } catch (e) { clearAuthCookies(res); throw new ApiError(401, 'Session expired'); }
  const user = await User.findOne({ _id: payload.sub, deletedAt: null }).select('+refreshTokens');
  if (!user) { clearAuthCookies(res); throw new ApiError(401, 'Session expired'); }
  const h = hash(token);
  const idx = user.refreshTokens.findIndex((t) => t.hash === h);
  if (idx < 0) { // reuse of a rotated token => revoke every session
    user.refreshTokens = []; await user.save(); clearAuthCookies(res);
    throw new ApiError(401, 'Session expired');
  }
  user.refreshTokens.splice(idx, 1);
  const ub = userBlockReason(user);
  let cb = null;
  if (user.role !== 'boss') cb = companyBlockReason(await Company.findById(user.companyId));
  if (ub || cb) { await user.save(); clearAuthCookies(res); throw new ApiError(403, ub || cb); }
  await issueSession(req, res, user);
  res.json({ success: true, message: 'Token refreshed' });
});

exports.logout = asyncHandler(async (req, res) => {
  const token = req.cookies?.bz_refresh;
  if (token) {
    try {
      const p = jwt.verify(token, env.refreshSecret);
      await User.updateOne({ _id: p.sub }, { $pull: { refreshTokens: { hash: hash(token) } } });
    } catch (e) { /* token already invalid */ }
  }
  if (req.user) await audit(req, { action: 'LOGOUT', entity: 'auth' });
  clearAuthCookies(res);
  res.json({ success: true, message: 'Signed out' });
});

exports.me = asyncHandler(async (req, res) => {
  const boss = await Setting.findOne({ key: 'boss' });
  res.json({ success: true, data: { user: safeUser(req.user), company: safeCompany(req.company), boss: boss && { logoUrl: boss.logoUrl, footerLogoUrl: boss.footerLogoUrl, logoText: boss.logoText, seoTitle: boss.seoTitle, mainHeading: boss.mainHeading } } });
});

exports.changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const user = await User.findById(req.user._id).select('+passwordHash +refreshTokens');
  if (!(await comparePassword(currentPassword, user.passwordHash))) throw new ApiError(400, 'Current password is incorrect');
  if (await comparePassword(newPassword, user.passwordHash)) throw new ApiError(400, 'New password must be different from the current one');
  user.passwordHash = await hashPassword(newPassword);
  user.passwordChangedAt = new Date();
  user.mustChangePassword = false;
  user.refreshTokens = [];
  await issueSession(req, res, user);
  await audit(req, { action: 'PASSWORD_CHANGE', entity: 'user', entityId: user._id });
  res.json({ success: true, message: 'Password updated' });
});

exports.forgotPassword = asyncHandler(async (req, res) => {
  const { role, companySlug, email } = req.body;
  const generic = { success: true, message: 'If the account exists, a reset link has been sent to the email.' };
  let company = null;
  if (role !== 'boss') { company = await Company.findOne({ slug: companySlug, deletedAt: null }); if (!company) return res.json(generic); }
  const user = await User.findOne({ role, email, companyId: company ? company._id : null, deletedAt: null });
  if (!user) return res.json(generic);
  const raw = crypto.randomBytes(32).toString('hex');
  user.resetTokenHash = hash(raw);
  user.resetTokenExpires = new Date(Date.now() + 30 * 60000);
  await user.save();
  const prefix = role === 'boss' ? `/${env.bossPanelPath}` : `/${company.slug}/${role}`;
  await sendMail({ to: user.email, subject: 'Reset your Banks Zone password', text: `Use this link within 30 minutes:\n${env.clientUrls[0]}${prefix}/reset-password?token=${raw}` });
  await audit(req, { action: 'PASSWORD_RESET_REQUEST', entity: 'user', entityId: user._id, user });
  res.json(generic);
});

exports.resetPassword = asyncHandler(async (req, res) => {
  const user = await User.findOne({ resetTokenHash: hash(req.body.token), resetTokenExpires: { $gt: new Date() }, deletedAt: null }).select('+resetTokenHash +resetTokenExpires +refreshTokens');
  if (!user) throw new ApiError(400, 'Reset link is invalid or has expired');
  user.passwordHash = await hashPassword(req.body.password);
  user.passwordChangedAt = new Date();
  user.resetTokenHash = undefined; user.resetTokenExpires = undefined;
  user.refreshTokens = []; user.failedAttempts = 0; user.lockUntil = null;
  await user.save();
  await audit(req, { action: 'PASSWORD_RESET', entity: 'user', entityId: user._id, user });
  res.json({ success: true, message: 'Password reset. You can sign in now.' });
});
