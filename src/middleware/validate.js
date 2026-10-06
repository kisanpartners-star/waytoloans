const ApiError = require('../utils/ApiError');
exports.validate = (schema, source = 'body') => (req, res, next) => {
  const { value, error } = schema.validate(req[source], { abortEarly: false, stripUnknown: true, convert: true });
  if (error) {
    const details = error.details.map((d) => ({ field: d.path.join('.'), message: d.message.replace(/"/g, '') }));
    return next(new ApiError(422, details[0].message, details));
  }
  req[source] = value;
  next();
};
