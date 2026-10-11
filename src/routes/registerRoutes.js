// Public self-registration, per company slug.
const router = require('express').Router();
const { validate } = require('../middleware/validate');
const { registerLimiter } = require('../middleware/rateLimit');
const c = require('../controllers/registerController');
const bv = require('../validators/bankValidator'); const cv = require('../validators/connectorValidator');
const ev = require('../validators/companyEmployeeValidator');
const { employeePhotoUpload } = require('../middleware/upload');
router.post('/:slug/bank', registerLimiter, validate(bv.register), c.registerBank);
router.post('/:slug/connector', registerLimiter, validate(cv.register), c.registerConnector);
router.get('/:slug/employee/options', c.employeeOptions);
router.post('/:slug/employee', registerLimiter, employeePhotoUpload.single('photo'), validate(ev.selfRegister), c.registerEmployee);
module.exports = router;
