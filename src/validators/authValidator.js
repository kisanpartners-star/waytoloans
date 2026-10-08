const { Joi, password } = require('./common');
const roles = ['boss', 'admin', 'bank', 'employee', 'dsa', 'connector', 'bankPortal', 'salesManager'];
const globalRoles = ['boss', 'bankPortal', 'salesManager'];
exports.login = Joi.object({
  role: Joi.string().valid(...roles).required(),
  companySlug: Joi.when('role', { is: Joi.valid(...globalRoles), then: Joi.forbidden(), otherwise: Joi.string().trim().lowercase().max(80).required() }),
  identifier: Joi.string().trim().max(120).required().messages({ 'any.required': 'Email or ID is required' }),
  password: Joi.string().max(128).required(),
});
exports.changePassword = Joi.object({
  currentPassword: Joi.string().required(),
  newPassword: password,
  confirmPassword: Joi.any().valid(Joi.ref('newPassword')).required().messages({ 'any.only': 'Passwords do not match' }),
});
exports.forgot = Joi.object({
  role: Joi.string().valid(...roles).required(),
  companySlug: Joi.when('role', { is: Joi.valid(...globalRoles), then: Joi.forbidden(), otherwise: Joi.string().trim().lowercase().required() }),
  email: Joi.string().email().lowercase().required(),
});
exports.reset = Joi.object({
  token: Joi.string().hex().length(64).required(),
  password,
  confirmPassword: Joi.any().valid(Joi.ref('password')).required().messages({ 'any.only': 'Passwords do not match' }),
});
