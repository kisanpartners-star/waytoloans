const { Joi, password, phone, objectId } = require('./common');
const { PASSWORD_REGEX, PASSWORD_MESSAGE } = require('../utils/password');
const fields = {
  name: Joi.string().trim().min(2).max(120).required(),
  employeeId: Joi.string().trim().pattern(/^[A-Za-z0-9_-]{2,40}$/).required().messages({ 'string.pattern.base': 'Employee ID: 2-40 letters, numbers, - or _' }),
  email: Joi.string().email().lowercase().required(),
  phone: phone.allow('', null),
  loanTypeId: objectId.required(), // SINGLE loan type
  dsas: Joi.array().items(Joi.object({ dsaId: objectId.required(), branch: Joi.string().trim().max(120).allow('', null) })).max(50).default([]), // MULTIPLE rows
};
exports.create = Joi.object({ ...fields, password, confirmPassword: Joi.any().valid(Joi.ref('password')).required().messages({ 'any.only': 'Passwords do not match' }) });
exports.update = Joi.object({
  ...fields,
  password: Joi.string().pattern(PASSWORD_REGEX).allow('', null).messages({ 'string.pattern.base': PASSWORD_MESSAGE }),
  confirmPassword: Joi.any().valid(Joi.ref('password')).messages({ 'any.only': 'Passwords do not match' }),
});
exports.status = Joi.object({ action: Joi.string().valid('enable', 'disable').required() });
