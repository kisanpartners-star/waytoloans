const router = require('express').Router();
const c = require('../controllers/settingController');
const v = require('../validators/settingValidator');
const { validate } = require('../middleware/validate');
const { imageUpload } = require('../middleware/upload');
router.get('/', c.get);
router.put('/', validate(v.update), c.update);
router.post('/logos', imageUpload.fields([{ name: 'logo', maxCount: 1 }, { name: 'footerLogo', maxCount: 1 }]), c.uploadLogos);
module.exports = router;
