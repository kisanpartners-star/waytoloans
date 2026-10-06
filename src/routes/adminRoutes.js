// /api/admin — company admin only, always tenant-scoped.
const router = require('express').Router();
const { protect } = require('../middleware/auth');
const { allow } = require('../middleware/role');
const { requireTenant } = require('../middleware/tenant');
const { validate } = require('../middleware/validate');
const { imageUpload } = require('../middleware/upload');
const { list } = require('../validators/listValidator');
const bank = require('../controllers/bankController'); const bv = require('../validators/bankValidator');
const conn = require('../controllers/connectorController'); const cv = require('../validators/connectorValidator');
const dsa = require('../controllers/dsaController'); const dv = require('../validators/dsaValidator');
const admin = require('../controllers/adminController'); const pv = require('../validators/profileValidator');
const dash = require('../controllers/dashboardController');

router.use(protect, allow('admin'), requireTenant);
router.get('/dashboard', dash.admin);

router.get('/banks/options', bank.options);
router.get('/banks', validate(list, 'query'), bank.list);
router.post('/banks', validate(bv.create), bank.create);
router.get('/banks/:id', bank.get);
router.put('/banks/:id', validate(bv.update), bank.update);
router.patch('/banks/:id/status', validate(bv.status), bank.setStatus);
router.delete('/banks/:id', bank.remove);

router.get('/connectors', validate(list, 'query'), conn.list);
router.post('/connectors', validate(cv.create), conn.create);
router.get('/connectors/:id', conn.get);
router.put('/connectors/:id', validate(cv.update), conn.update);
router.patch('/connectors/:id/status', validate(cv.status), conn.setStatus);
router.delete('/connectors/:id', conn.remove);

router.get('/dsas', validate(list, 'query'), dsa.list);
router.post('/dsas', validate(dv.create), dsa.create);
router.get('/dsas/:id', dsa.get);
router.put('/dsas/:id', validate(dv.update), dsa.update);
router.patch('/dsas/:id/status', validate(dv.status), dsa.setStatus);
router.delete('/dsas/:id', dsa.remove);

router.get('/branding', admin.getBranding);
router.put('/branding', validate(pv.branding), admin.updateBranding);
router.post('/logo', imageUpload.single('logo'), admin.uploadLogo);
router.get('/audit-logs', validate(list, 'query'), admin.auditLogs);
module.exports = router;
