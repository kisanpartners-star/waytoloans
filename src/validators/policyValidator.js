const { Joi } = require('./common');
exports.upsert = Joi.object({
  title: Joi.string().trim().min(2).max(160).required(),
  content: Joi.string().allow('').max(100000).default(''),
  status: Joi.string().valid('draft', 'published').default('draft'),
});
exports.status = Joi.object({ status: Joi.string().valid('draft', 'published').required() });
