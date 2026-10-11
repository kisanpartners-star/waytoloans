const { Joi, phone, objectId, password } = require('./common');

const bankIds = Joi.alternatives().try(
  Joi.array().items(objectId).min(1).unique().max(100),
  Joi.string().custom((value, helpers) => {
    let parsed;
    try { parsed = JSON.parse(value); } catch { return helpers.error('any.invalid'); }
    if (!Array.isArray(parsed) || !parsed.length || parsed.some((id) => !/^[a-f\d]{24}$/i.test(id))) return helpers.error('any.invalid');
    if (new Set(parsed).size !== parsed.length) return helpers.error('array.unique');
    return parsed;
  }),
).required();

const fields = {
  name: Joi.string().trim().min(2).max(120).required(),
  phone: phone.required(),
  email: Joi.string().email().lowercase().trim().required(),
  employeeId: Joi.string().trim().pattern(/^[A-Za-z0-9_-]{2,40}$/).required(),
  employmentRole: Joi.string().trim().min(2).max(120).required(),
  reportingManager: Joi.string().trim().max(120).allow('').default(''),
  branch: Joi.string().trim().max(120).allow('').default(''),
  loanTypeId: objectId.required(),
  bankIds,
};

exports.create = Joi.object({
  ...fields,
  password: password.required(),
  confirmPassword: Joi.any().valid(Joi.ref('password')).required().messages({ 'any.only': 'Passwords do not match' }),
});
exports.update = Joi.object({
  ...fields,
  password: Joi.string().allow(''),
  confirmPassword: Joi.when('password', {
    is: Joi.string().min(1),
    then: Joi.string().valid(Joi.ref('password')).required(),
    otherwise: Joi.string().allow('').optional(),
  }).messages({ 'any.only': 'Passwords do not match' }),
});
exports.selfRegister = exports.create;
exports.status = Joi.object({ action: Joi.string().valid('approve', 'reject', 'enable', 'disable').required() });
