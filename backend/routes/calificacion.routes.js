const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/calificacion.controller');
const { verificarToken } = require('../middlewares/auth.middleware');

router.post('/',                    verificarToken, ctrl.crear);
router.get('/mias',                 verificarToken, ctrl.misCalificaciones);
router.get('/estado/:solicitud_id', verificarToken, ctrl.estado);

module.exports = router;