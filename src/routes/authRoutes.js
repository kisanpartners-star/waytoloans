const router = require('express').Router();
const c = require('../controllers/authController');
const v = require('../validators/authValidator');
const { validate } = require('../middleware/validate');
const { protect } = require('../middleware/auth');
const { loginLimiter, resetLimiter } = require('../middleware/rateLimit');

router.post('/login', loginLimiter, validate(v.login), c.login);
router.post('/refresh', c.refresh);
router.post('/logout', c.logout);
router.post('/forgot-password', resetLimiter, validate(v.forgot), c.forgotPassword);
router.post('/reset-password', resetLimiter, validate(v.reset), c.resetPassword);
router.get('/me', protect, c.me);
router.post('/change-password', protect, validate(v.changePassword), c.changePassword);
module.exports = router;
