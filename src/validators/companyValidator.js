const { Joi, password, phone } = require('./common');
const GSTIN = /^[0-3][0-9][A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const base = {
  name: Joi.string().trim().min(2).max(120).required(),
  gstin: Joi.string().trim().uppercase().pattern(GSTIN).required().messages({ 'string.pattern.base': 'Enter a valid 15-character GSTIN' }),
  address: Joi.string().trim().min(5).max(400).required(),
  phone: phone.required(),
  email: Joi.string().email().lowercase().required(),
  altMobile: phone.allow('', null),
};
exports.create = Joi.object({
  ...base,
  saveAsDraft: Joi.boolean().default(false),
  password,
  confirmPassword: Joi.any().valid(Joi.ref('password')).required().messages({ 'any.only': 'Passwords do not match' }),
});
exports.update = Joi.object({
  ...base,
  password: Joi.string().pattern(require('../utils/password').PASSWORD_REGEX).allow('', null).messages({ 'string.pattern.base': require('../utils/password').PASSWORD_MESSAGE }),
  confirmPassword: Joi.any().valid(Joi.ref('password')).messages({ 'any.only': 'Passwords do not match' }),
});
exports.action = Joi.object({
  action: Joi.string().valid('draft', 'publish', 'enable', 'disable', 'block', 'unblock', 'disableLogin', 'enableLogin').required(),
});
