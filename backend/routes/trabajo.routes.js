const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/trabajo.controller');
const { verificarToken } = require('../middlewares/auth.middleware');
const { uploadSolicitud } = require('../config/cloudinary'); // Usaremos el mismo storage de solicitudes

// Subir imagen (solo trabajador autenticado)
router.post('/', verificarToken, uploadSolicitud.single('imagen'), ctrl.subir);

// Ver mis trabajos (trabajador autenticado)
router.get('/mios', verificarToken, ctrl.misTrabajos);

// Eliminar trabajo (dueño)
router.delete('/:id', verificarToken, ctrl.eliminar);

module.exports = router;