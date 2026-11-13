const { Joi, password, phone } = require('./common');

exports.register = Joi.object({
  name: Joi.string().trim().min(2).max(120).required(),
  phone: phone.required(),
  email: Joi.string().email().lowercase().required(),
  occupation: Joi.string().valid('employee', 'self-employed', 'professional').required(),
  accountHolder: Joi.string().trim().min(2).max(120).required(),
  bankName: Joi.string().trim().min(2).max(120).required(),
  accountNumber: Joi.string().trim().pattern(/^[0-9]{6,24}$/).required(),
  ifsc: Joi.string().trim().uppercase().pattern(/^[A-Z]{4}0[A-Z0-9]{6}$/).required(),
  aadhaar: Joi.string().trim().pattern(/^[0-9]{12}$/).required(),
  pan: Joi.string().trim().uppercase().pattern(/^[A-Z]{5}[0-9]{4}[A-Z]$/).required(),
  password,
  confirmPassword: Joi.any().valid(Joi.ref('password')).required().messages({ 'any.only': 'Passwords do not match' }),
});

exports.action = Joi.object({
  action: Joi.string().valid('approve', 'reject').required(),
  companyId: Joi.when('action', { is: 'approve', then: Joi.string().hex().length(24).required(), otherwise: Joi.forbidden() }),
});
