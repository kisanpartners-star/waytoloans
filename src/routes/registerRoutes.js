// Public self-registration, per company slug.
const router = require('express').Router();
const { validate } = require('../middleware/validate');
const { registerLimiter } = require('../middleware/rateLimit');
const c = require('../controllers/registerController');
const bv = require('../validators/bankValidator'); const cv = require('../validators/connectorValidator');
router.post('/:slug/bank', registerLimiter, validate(bv.register), c.registerBank);
router.post('/:slug/connector', registerLimiter, validate(cv.register), c.registerConnector);
module.exports = router;
