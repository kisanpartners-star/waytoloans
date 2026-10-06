const env = require('../config/env');
exports.notFound = (req, res) => res.status(404).json({ success: false, message: 'Route not found' });
exports.errorHandler = (err, req, res, next) => { // eslint-disable-line
  let status = err.status || 500;
  let message = err.isOperational ? err.message : 'Something went wrong';
  let details = err.details;
  if (err.name === 'ValidationError' && err.errors) { status = 422; message = Object.values(err.errors)[0].message; details = Object.values(err.errors).map((e) => ({ field: e.path, message: e.message })); }
  else if (err.name === 'CastError') { status = 400; message = 'Invalid identifier'; }
  else if (err.code === 11000) { status = 409; const f = Object.keys(err.keyPattern || {}).filter((k) => k !== 'companyId' && k !== 'role')[0] || 'value'; message = `A record with this ${f} already exists`; }
  else if (err.name === 'MulterError') { status = 422; message = err.code === 'LIMIT_FILE_SIZE' ? 'File is too large (max 2 MB)' : 'Invalid upload'; }
  if (status >= 500) console.error(err);
  res.status(status).json({ success: false, message, details, ...(env.nodeEnv === 'development' && status >= 500 ? { debug: err.message } : {}) });
};
