const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/trabajador.controller');
const { verificarToken } = require('../middlewares/auth.middleware');

// Quita verificarToken — la lista es pública
router.get('/', ctrl.listar);

module.exports = router;