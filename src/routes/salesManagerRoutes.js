const router = require('express').Router();
const controller = require('../controllers/bankPortalController');
const validator = require('../validators/bankPortalValidator');
const { protect } = require('../middleware/auth');
const { allow } = require('../middleware/role');
const { validate } = require('../middleware/validate');

router.use(protect, allow('salesManager'));
router.get('/options', controller.companyOptions);
router.get('/dashboard', controller.salesDashboard);
router.get('/leads', validate(validator.leadQuery, 'query'), controller.leads);
router.post('/leads', validate(validator.lead), controller.saveLead);
router.put('/leads/:id', validate(validator.lead), controller.saveLead);
router.delete('/leads/:id', controller.deleteLead);
router.post('/leads/:id/confirmation', validate(validator.confirmation), controller.requestConfirmation);
router.post('/leads/:id/documents', validate(validator.documentRequest), controller.requestDocument);
router.post('/leads/:id/email', validate(validator.email), controller.sendEmail);
module.exports = router;
