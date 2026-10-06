const { Joi, phone } = require('./common');
exports.update = Joi.object({
  name: Joi.string().trim().min(2).max(120),
  phone: phone,
  address: Joi.string().trim().min(5).max(400),
  city: Joi.string().trim().max(80).allow(''),
  state: Joi.string().trim().max(80).allow(''),
  pincode: Joi.string().pattern(/^[0-9]{6}$/).allow(''),
  branchName: Joi.string().trim().max(120).allow(''),
  contactPerson: Joi.string().trim().max(120).allow(''),
});
exports.branding = Joi.object({
  brandName: Joi.string().trim().min(2).max(80).required(),
  brandTagline: Joi.string().trim().max(160).allow('', null),
});
