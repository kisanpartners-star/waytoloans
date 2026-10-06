const Joi = require('joi');
const { PASSWORD_REGEX, PASSWORD_MESSAGE } = require('../utils/password');
const password = Joi.string().pattern(PASSWORD_REGEX).required().messages({ 'string.pattern.base': PASSWORD_MESSAGE });
const phone = Joi.string().pattern(/^[+]?[0-9]{10,13}$/).messages({ 'string.pattern.base': 'Enter a valid phone number (10-13 digits)' });
const objectId = Joi.string().hex().length(24);
module.exports = { Joi, password, phone, objectId };
