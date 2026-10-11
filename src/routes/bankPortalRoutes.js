const router = require('express').Router();
const controller = require('../controllers/bankPortalController');
const validator = require('../validators/bankPortalValidator');
const { protect } = require('../middleware/auth');
const { allow } = require('../middleware/role');
const { validate } = require('../middleware/validate');

router.use(protect, allow('bankPortal'));
router.get('/options', controller.options);
router.get('/dashboard', controller.dashboard);
router.put('/settings', validate(validator.bankUpdate), controller.updateBank);
router.get('/employees', controller.listEmployees);
router.post('/employees', validate(validator.employee), controller.saveEmployee);
router.put('/employees/:id', validate(validator.employeeUpdate), controller.saveEmployee);
router.patch('/employees/:id/status', validate(validator.employeeStatus), controller.employeeStatus);
router.delete('/employees/:id', controller.removeEmployee);
module.exports = router;
