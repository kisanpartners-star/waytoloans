const router = require('express').Router();
const controller = require('../controllers/bossEmployeeController');
const validator = require('../validators/bossEmployeeValidator');
const upload = require('../middleware/upload');
const { list } = require('../validators/listValidator');
const { validate } = require('../middleware/validate');

router.get('/options', controller.options);
router.get('/', validate(list, 'query'), controller.list);
router.post('/', upload.employeePhotoUpload.single('photo'), controller.parsePayload, controller.validatePayload(validator.create), controller.create);
router.put('/:id', upload.employeePhotoUpload.single('photo'), controller.parsePayload, controller.validatePayload(validator.update), controller.update);
router.patch('/:id/status', validate(validator.status), controller.setStatus);
router.delete('/:id', controller.remove);

module.exports = router;
