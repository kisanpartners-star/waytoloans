const ApiError = require('../utils/ApiError');
// Every non-boss query must go through tenantFilter so records of other companies are unreachable.
exports.requireTenant = (req, res, next) => {
  if (!req.user || !req.user.companyId) return next(new ApiError(403, 'Tenant context missing'));
  next();
};
exports.tenantFilter = (req, extra = {}) => ({ ...extra, companyId: req.user.companyId, deletedAt: null });
