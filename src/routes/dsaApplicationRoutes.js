const router = require('express').Router();
const { validate } = require('../middleware/validate');
const { list } = require('../validators/listValidator');
const validator = require('../validators/dsaApplicationValidator');
const controller = require('../controllers/dsaApplicationController');

router.get('/', validate(list, 'query'), controller.list);
router.patch('/:id', validate(validator.action), controller.review);
module.exports = router;
