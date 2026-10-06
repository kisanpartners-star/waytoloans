const router = require('express').Router();
const { protect } = require('../middleware/auth');
const { allow } = require('../middleware/role');
const loanType = require('../controllers/loanTypeController');
router.get('/health', (req, res) => res.json({ success: true, status: 'ok' }));
router.use('/auth', require('./authRoutes'));
router.use('/public', require('./publicRoutes'));
router.use('/boss', require('./bossRoutes'));
// published loan types for dropdowns (admin / bank / dsa forms)
router.get('/loan-types/options', protect, allow('admin', 'bank', 'dsa', 'employee'), loanType.options);
router.use('/register', require('./registerRoutes'));
router.use('/profile', require('./profileRoutes'));
router.use('/admin', require('./adminRoutes'));
router.use('/bank', require('./bankRoutes'));
router.use('/employee', require('./employeeRoutes'));
router.use('/dsa', require('./dsaRoutes'));
router.use('/connector', require('./connectorRoutes'));
module.exports = router;
