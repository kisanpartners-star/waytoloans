const router = require('express').Router();
const c = require('../controllers/publicController');
const policy = require('../controllers/policyController');
router.get('/branding', c.boss);
router.get('/company/:slug', c.company);
router.get('/policies', policy.publicList);
module.exports = router;
