const { Joi, password, phone, objectId } = require('./common');
const { PASSWORD_REGEX, PASSWORD_MESSAGE } = require('../utils/password');
const fields = {
  name: Joi.string().trim().min(2).max(120).required(),
  dsaId: Joi.string().trim().pattern(/^[A-Za-z0-9_-]{3,40}$/).required().messages({ 'string.pattern.base': 'DSA ID: 3-40 letters, numbers, - or _' }),
  email: Joi.string().email().lowercase().allow('', null),
  phone: phone.allow('', null),
  branch: Joi.string().trim().min(2).max(120).required(),
  loanTypeIds: Joi.array().items(objectId).min(1).unique().required().messages({ 'array.min': 'Select at least one loan type' }),
  bankIds: Joi.array().items(objectId).min(1).unique().required().messages({ 'array.min': 'Select at least one bank' }),
};
exports.create = Joi.object({ ...fields, password, confirmPassword: Joi.any().valid(Joi.ref('password')).required().messages({ 'any.only': 'Passwords do not match' }) });
exports.update = Joi.object({
  ...fields,
  password: Joi.string().pattern(PASSWORD_REGEX).allow('', null).messages({ 'string.pattern.base': PASSWORD_MESSAGE }),
  confirmPassword: Joi.any().valid(Joi.ref('password')).messages({ 'any.only': 'Passwords do not match' }),
});
exports.status = Joi.object({ action: Joi.string().valid('enable', 'disable').required() });
