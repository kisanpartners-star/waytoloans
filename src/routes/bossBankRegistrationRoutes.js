const router = require('express').Router();
const controller = require('../controllers/bossBankRegistrationController');
const validator = require('../validators/bankRegistrationValidator');
const { list } = require('../validators/listValidator');
const { validate } = require('../middleware/validate');

router.get('/options', controller.options);
router.get('/', validate(list, 'query'), controller.list);
router.post('/', validate(validator.saveDraft), controller.create);
router.put('/:id', validate(validator.saveDraft), controller.update);
router.post('/:id/submit', validate(validator.submit), controller.submit);
router.patch('/:id/status', validate(validator.status), controller.setStatus);
router.delete('/:id', controller.remove);

module.exports = router;
