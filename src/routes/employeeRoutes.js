const router = require('express').Router();
const { protect } = require('../middleware/auth');
const { allow } = require('../middleware/role');
const { requireTenant } = require('../middleware/tenant');
const dash = require('../controllers/dashboardController');
router.use(protect, allow('employee'), requireTenant);
router.get('/dashboard', dash.employee);
module.exports = router;
