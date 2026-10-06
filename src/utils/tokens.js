const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const env = require('../config/env');
const hash = (v) => crypto.createHash('sha256').update(v).digest('hex');
const signAccess = (u) => jwt.sign({ sub: String(u._id), role: u.role, companyId: u.companyId ? String(u.companyId) : null }, env.accessSecret, { expiresIn: env.accessTtl });
const signRefresh = (u) => jwt.sign({ sub: String(u._id), jti: crypto.randomUUID() }, env.refreshSecret, { expiresIn: `${env.refreshTtlDays}d` });
const base = { httpOnly: true, secure: env.cookieSecure, sameSite: env.cookieSecure ? 'none' : 'lax' };
const setAuthCookies = (res, access, refresh) => {
  res.cookie('bz_access', access, { ...base, path: '/', maxAge: 15 * 60 * 1000 });
  res.cookie('bz_refresh', refresh, { ...base, path: '/api/auth', maxAge: env.refreshTtlDays * 86400000 });
};
const clearAuthCookies = (res) => {
  res.clearCookie('bz_access', { ...base, path: '/' });
  res.clearCookie('bz_refresh', { ...base, path: '/api/auth' });
};
module.exports = { hash, signAccess, signRefresh, setAuthCookies, clearAuthCookies };
