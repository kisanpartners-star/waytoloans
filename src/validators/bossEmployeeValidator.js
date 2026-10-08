const { Joi, phone, objectId } = require('./common');

const fields = {
  name: Joi.string().trim().min(2).max(120).allow('', null),
  dateOfJoining: Joi.date().iso().empty('').allow(null),
  employeeId: Joi.string().trim().pattern(/^[A-Za-z0-9_-]{2,40}$/).allow('', null).messages({ 'string.pattern.base': 'Employee ID: 2-40 letters, numbers, - or _' }),
  phone: phone.allow('', null),
  altPhone: phone.allow('', null),
  officialEmail: Joi.string().email().lowercase().trim().allow('', null),
  personalEmail: Joi.string().email().lowercase().trim().allow('', null),
  department: Joi.string().trim().max(120).allow('', null),
  status: Joi.string().valid('active', 'deactive').default('active'),
  employmentRole: Joi.string().trim().max(120).allow('', null),
  reportingManager: Joi.string().trim().max(120).allow('', null),
  loanTypeIds: Joi.array().items(objectId).max(50).unique().default([]),
  companyAssignments: Joi.array().items(Joi.object({
    companyId: objectId.required(),
    branches: Joi.array().items(Joi.string().trim().min(1).max(120)).max(100).unique().default([]),
  })).max(50).unique('companyId').default([]),
  saveAsDraft: Joi.boolean().required(),
};

const requiredForRegistration = {
  name: Joi.string().trim().min(2).max(120).required(),
  dateOfJoining: Joi.date().iso().required(),
  employeeId: Joi.string().trim().pattern(/^[A-Za-z0-9_-]{2,40}$/).required().messages({ 'string.pattern.base': 'Employee ID: 2-40 letters, numbers, - or _' }),
  phone: phone.required(),
  officialEmail: Joi.string().email().lowercase().trim().required(),
};

const employeeSchema = Joi.object(fields).when(Joi.object({ saveAsDraft: Joi.valid(false) }).unknown(), {
  then: Joi.object(requiredForRegistration).unknown(true),
});

exports.create = employeeSchema;
exports.update = employeeSchema;
exports.status = Joi.object({ action: Joi.string().valid('enable', 'disable').required() });
