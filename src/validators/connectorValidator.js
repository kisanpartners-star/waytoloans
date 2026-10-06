const { Joi, password, phone } = require('./common');
const { PASSWORD_REGEX, PASSWORD_MESSAGE } = require('../utils/password');
const fields = {
  fullName: Joi.string().trim().min(2).max(120).required(),
  email: Joi.string().email().lowercase().required(),
  phone: phone.required(),
  address: Joi.string().trim().min(5).max(400).required(),
};
exports.create = Joi.object({ ...fields, password, confirmPassword: Joi.any().valid(Joi.ref('password')).required().messages({ 'any.only': 'Passwords do not match' }) });
exports.register = exports.create;
exports.update = Joi.object({
  ...fields,
  password: Joi.string().pattern(PASSWORD_REGEX).allow('', null).messages({ 'string.pattern.base': PASSWORD_MESSAGE }),
  confirmPassword: Joi.any().valid(Joi.ref('password')).messages({ 'any.only': 'Passwords do not match' }),
});
exports.status = Joi.object({ action: Joi.string().valid('enable', 'disable', 'approve', 'reject').required() });
