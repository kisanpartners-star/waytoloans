const router = require('express').Router();
const { protect } = require('../middleware/auth');
const { allow } = require('../middleware/role');
const c = require('../controllers/publicLoanController');

router.use(protect, allow('boss'));
router.get('/', c.listForBoss);
router.get('/stats', c.statsForBoss);
router.get('/:id', c.getByIdForBoss);
router.patch('/:id/status', c.updateStatusForBoss);
router.patch('/:id/eligibility', c.updateEligibilityForBoss);
router.delete('/:id', c.deleteForBoss);

module.exports = router;
