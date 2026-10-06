// Everything under /api/boss is Boss-only.
const router = require('express').Router();
const { protect } = require('../middleware/auth');
const { allow } = require('../middleware/role');
const dash = require('../controllers/bossDashboardController');
router.use(protect, allow('boss'));
router.get('/dashboard', dash.stats);
router.use('/companies', require('./companyRoutes'));
router.use('/loan-types', require('./loanTypeRoutes'));
router.use('/policies', require('./policyRoutes'));
router.use('/settings', require('./settingRoutes'));
router.use('/audit-logs', require('./auditRoutes'));
module.exports = router;
