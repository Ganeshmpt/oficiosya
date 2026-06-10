const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/perfil.controller');
const { verificarToken } = require('../middlewares/auth.middleware');
const { uploadPerfil, uploadVerificacion } = require('../config/cloudinary');

// ── Públicas ──────────────────────────────────────────
router.get('/usuario/:id',     ctrl.perfilUsuario);   // cualquier usuario (cliente o trabajador)
router.get('/trabajador/:id',  ctrl.perfilPublico);   // solo trabajadores, con perfil completo

// ── Datos generales ───────────────────────────────────
router.get('/me',              verificarToken, ctrl.miPerfil);
router.put('/datos',           verificarToken, ctrl.actualizarDatos);
router.put('/foto',            verificarToken, uploadPerfil.single('foto'), ctrl.subirFoto);

// ── Perfil profesional ────────────────────────────────
router.get('/profesional',     verificarToken, ctrl.miPerfilProfesional);
router.put('/profesional',     verificarToken, ctrl.actualizarPerfilProfesional);

// ── Verificación/documentación ────────────────────────
router.post('/verificacion',   verificarToken, uploadVerificacion.single('documento'), ctrl.subirVerificacion);
router.get('/verificaciones',  verificarToken, ctrl.misVerificaciones);

module.exports = router;