const router = require('express').Router();
const c = require('../controllers/auditController');
const { list } = require('../validators/listValidator');
const { validate } = require('../middleware/validate');
router.get('/', validate(list, 'query'), c.list);
module.exports = router;
