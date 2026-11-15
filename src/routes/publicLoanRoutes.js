const router = require('express').Router();
const c = require('../controllers/publicLoanController');

router.get('/form-config/:loanType', c.getFormConfig);
router.post('/start', c.start);
router.patch('/:id/step', c.ensureApplicationAccess, c.updateStep);
router.post('/:id/documents', c.ensureApplicationAccess, c.uploadDocument);
router.delete('/:id/documents/:docId', c.ensureApplicationAccess, c.deleteDocument);
router.post('/:id/submit', c.ensureApplicationAccess, c.submit);

module.exports = router;
