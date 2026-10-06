const { Joi } = require('./common');
exports.upsert = Joi.object({
  name: Joi.string().trim().min(2).max(80).required(),
  code: Joi.string().trim().uppercase().max(20).allow('', null),
  description: Joi.string().trim().max(500).allow('', null),
  status: Joi.string().valid('draft', 'published').default('draft'),
});
exports.status = Joi.object({ status: Joi.string().valid('draft', 'published').required() });
