const { Joi } = require('./common');
// shared query-string shape for every table endpoint
exports.list = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  search: Joi.string().trim().max(100).allow(''),
  status: Joi.string().trim().max(30).allow(''),
  from: Joi.string().isoDate().allow(''),
  to: Joi.string().isoDate().allow(''),
  sortBy: Joi.string().max(30),
  sortDir: Joi.string().valid('asc', 'desc'),
  action: Joi.string().max(30).allow(''),
  role: Joi.string().max(20).allow(''),
  companyId: Joi.string().hex().length(24).allow(''),
  loanTypeId: Joi.string().hex().length(24).allow(''),
  registration: Joi.string().valid('self', '').allow(''),
});
