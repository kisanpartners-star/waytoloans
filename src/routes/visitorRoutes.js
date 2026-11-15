const router = require('express').Router();
const controller = require('../controllers/visitorController');

router.post('/track', controller.track);

module.exports = router;
