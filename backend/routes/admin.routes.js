const express = require('express');
const router  = express.Router();
const {
  listarUsuarios,
  toggleBloqueoUsuario,
  crearReporte,
  verificarUsuario,
  listarVerificaciones,
  gestionarVerificacion,
  enviarAdvertencia,
  listarEventos,       // ← nuevo
  cancelarSolicitudAdmin,
  resetPasswordUsuario
} = require('../controllers/admin.controller');
const { verificarToken, soloAdmin } = require('../middlewares/auth.middleware');

// ── Usuarios ──────────────────────────────────────────
router.get ('/usuarios',                    verificarToken, soloAdmin, listarUsuarios);
router.put ('/usuarios/:id/bloquear',       verificarToken, soloAdmin, toggleBloqueoUsuario);
router.put ('/usuarios/:id/verificar',      verificarToken, soloAdmin, verificarUsuario);
router.post('/usuarios/:id/advertencia',    verificarToken, soloAdmin, enviarAdvertencia);

// ── Reportes ──────────────────────────────────────────
router.post('/reportes',                    verificarToken,            crearReporte);

// ── Verificaciones de documentos ──────────────────────
router.get ('/verificaciones',              verificarToken, soloAdmin, listarVerificaciones);
router.put ('/verificaciones/:id',          verificarToken, soloAdmin, gestionarVerificacion);
router.put('/usuarios/:id/reset-password', verificarToken, soloAdmin, resetPasswordUsuario);
// ── Trazabilidad (RNF4) ───────────────────────────────
// GET /api/admin/eventos?tipo=solicitud_creada&usuario_id=5&limit=50
router.get ('/eventos',                     verificarToken, soloAdmin, listarEventos);
// ── Solicitudes ───────────────────────────────────────
router.put('/solicitudes/:id/cancelar', verificarToken, soloAdmin, cancelarSolicitudAdmin);
module.exports = router;