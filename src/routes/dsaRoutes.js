const router = require('express').Router();
const { protect } = require('../middleware/auth');
const { allow } = require('../middleware/role');
const { requireTenant } = require('../middleware/tenant');
const dash = require('../controllers/dashboardController');
router.use(protect, allow('dsa'), requireTenant);
router.get('/dashboard', dash.dsa);
module.exports = router;
