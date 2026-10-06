const router = require('express').Router();
const { protect } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const c = require('../controllers/profileController'); const pv = require('../validators/profileValidator');
router.use(protect);
router.get('/', c.get);
router.put('/', validate(pv.update), c.update);
module.exports = router;
