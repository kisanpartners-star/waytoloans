// /api/bank — a bank manages its own employees only.
const router = require('express').Router();
const { protect } = require('../middleware/auth');
const { allow } = require('../middleware/role');
const { requireTenant } = require('../middleware/tenant');
const { validate } = require('../middleware/validate');
const { list } = require('../validators/listValidator');
const emp = require('../controllers/employeeController'); const ev = require('../validators/employeeValidator');
const dash = require('../controllers/dashboardController');
router.use(protect, allow('bank'), requireTenant);
router.get('/dashboard', dash.bank);
router.get('/dsa-options', emp.dsaOptions);
router.get('/employees', validate(list, 'query'), emp.list);
router.post('/employees', validate(ev.create), emp.create);
router.get('/employees/:id', emp.get);
router.put('/employees/:id', validate(ev.update), emp.update);
router.patch('/employees/:id/status', validate(ev.status), emp.setStatus);
router.delete('/employees/:id', emp.remove);
module.exports = router;
