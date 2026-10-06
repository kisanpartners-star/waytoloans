const { Joi } = require('./common');
exports.update = Joi.object({
  logoText: Joi.string().trim().max(80).allow(''),
  seoTitle: Joi.string().trim().max(120).allow(''),
  mainHeading: Joi.string().trim().max(120).allow(''),
});
