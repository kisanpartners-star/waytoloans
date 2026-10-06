const sanitize = require('mongo-sanitize');
// strips $-operators and dotted keys from body, query and params (NoSQL injection)
module.exports = (req, res, next) => {
  if (req.body) req.body = sanitize(req.body);
  if (req.params) req.params = sanitize(req.params);
  if (req.query) { const q = sanitize({ ...req.query }); Object.keys(req.query).forEach((k) => delete req.query[k]); Object.assign(req.query, q); }
  next();
};
