const router = require('express').Router();
const controller = require('../controllers/bankPortalController');
const validator = require('../validators/bankPortalValidator');
const { protect } = require('../middleware/auth');
const { allow } = require('../middleware/role');
const { validate } = require('../middleware/validate');
const { loginLimiter } = require('../middleware/rateLimit');

router.get('/options', controller.options);
router.post('/register', loginLimiter, validate(validator.registration), controller.register);
router.use(protect, allow('bankPortal'));
router.get('/dashboard', controller.dashboard);
router.put('/settings', validate(validator.bankUpdate), controller.updateBank);
router.get('/employees', controller.listEmployees);
router.post('/employees', validate(validator.employee), controller.saveEmployee);
router.put('/employees/:id', validate(validator.employeeUpdate), controller.saveEmployee);
router.patch('/employees/:id/status', validate(validator.employeeStatus), controller.employeeStatus);
router.delete('/employees/:id', controller.removeEmployee);
module.exports = router;
