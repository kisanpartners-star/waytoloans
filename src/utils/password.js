const bcrypt = require('bcrypt');
module.exports = {
  hashPassword: (p) => bcrypt.hash(p, 12),
  comparePassword: (p, h) => bcrypt.compare(p, h),
  PASSWORD_REGEX: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,64}$/,
  PASSWORD_MESSAGE: 'Password must be 8-64 characters with upper case, lower case, a number and a special character',
};
