const { Joi, password, phone, objectId } = require('./common');
const { PASSWORD_REGEX, PASSWORD_MESSAGE } = require('../utils/password');
const fields = {
  bankName: Joi.string().trim().min(2).max(120).required(),
  contactPerson: Joi.string().trim().max(120).allow('', null),
  email: Joi.string().email().lowercase().required(),
  phone: phone.required(),
  address: Joi.string().trim().min(5).max(400).required(),
  city: Joi.string().trim().max(80).allow('', null),
  state: Joi.string().trim().max(80).allow('', null),
  pincode: Joi.string().pattern(/^[0-9]{6}$/).allow('', null).messages({ 'string.pattern.base': 'Pincode must be 6 digits' }),
  branchName: Joi.string().trim().max(120).allow('', null),
  ifscCode: Joi.string().trim().uppercase().pattern(/^[A-Z]{4}0[A-Z0-9]{6}$/).allow('', null).messages({ 'string.pattern.base': 'Enter a valid IFSC code' }),
};
const confirm = (ref) => Joi.any().valid(Joi.ref(ref)).required().messages({ 'any.only': 'Passwords do not match' });
exports.create = Joi.object({ ...fields, password, confirmPassword: confirm('password') });
exports.register = exports.create; // public self-registration uses the same fields
exports.update = Joi.object({
  ...fields,
  password: Joi.string().pattern(PASSWORD_REGEX).allow('', null).messages({ 'string.pattern.base': PASSWORD_MESSAGE }),
  confirmPassword: Joi.any().valid(Joi.ref('password')).messages({ 'any.only': 'Passwords do not match' }),
});
exports.status = Joi.object({ action: Joi.string().valid('enable', 'disable', 'approve', 'reject').required() });
