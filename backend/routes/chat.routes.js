const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/chat.controller');
const { verificarToken } = require('../middlewares/auth.middleware');

router.post('/enviar',                    verificarToken, ctrl.enviar);
router.get('/conversacion/:userId',       verificarToken, ctrl.conversacion);
router.get('/conversaciones',             verificarToken, ctrl.misConversaciones);
router.get('/notificaciones',             verificarToken, ctrl.notificaciones);

// ⚠️  leer-todas DEBE ir ANTES de /:id/leer
router.put('/notificaciones/leer-todas',  verificarToken, ctrl.marcarTodasLeidas);
router.put('/notificaciones/:id/leer',    verificarToken, ctrl.marcarNotifLeida);

module.exports = router;