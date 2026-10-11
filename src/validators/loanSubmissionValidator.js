const { Joi } = require('./common');

exports.create = Joi.object({
  bankId: Joi.string().hex().length(24).required(),
  assigneeUserIds: Joi.array().items(Joi.string().hex().length(24)).min(1).max(100).unique().required(),
});
