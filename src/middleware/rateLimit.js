const rateLimit = require('express-rate-limit');
const make = (windowMs, max, message) => rateLimit({ windowMs, max, standardHeaders: true, legacyHeaders: false, message: { success: false, message } });
exports.apiLimiter = make(15 * 60 * 1000, 600, 'Too many requests, please slow down.');
exports.loginLimiter = make(15 * 60 * 1000, 20, 'Too many login attempts. Try again in 15 minutes.');
exports.registerLimiter = make(60 * 60 * 1000, 10, 'Too many registrations from this IP. Try again later.');
exports.resetLimiter = make(60 * 60 * 1000, 10, 'Too many password reset requests. Try again later.');
