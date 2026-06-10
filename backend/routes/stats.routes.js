const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/stats.controller');
const { verificarToken } = require('../middlewares/auth.middleware');

router.get('/me', verificarToken, ctrl.misStats);

module.exports = router;