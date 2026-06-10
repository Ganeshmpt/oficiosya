const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/solicitud.controller');
const { verificarToken, soloAdmin } = require('../middlewares/auth.middleware');
// ── PÚBLICAS (sin token) ──────────────────────────────
router.get('/abiertas',          ctrl.listarAbiertas);
router.get('/categorias',        ctrl.categorias);
router.get('/todas', verificarToken, soloAdmin, ctrl.listarTodas);

// ── RUTAS FIJAS CON TOKEN (antes de /:id) ─────────────
router.get('/estadisticas',      verificarToken, ctrl.estadisticas);
router.get('/mias/todas',        verificarToken, ctrl.misSolicitudes);

// ── DETALLE PÚBLICO ───────────────────────────────────
router.get('/:id',               ctrl.detalle);

// ── CLIENTE ───────────────────────────────────────────
router.post('/',                 verificarToken, ctrl.crear);
router.put('/:id',               verificarToken, ctrl.editar);
router.delete('/:id',            verificarToken, ctrl.eliminar);
router.put('/:id/cancelar',      verificarToken, ctrl.cancelar);

// ── TRABAJADOR ────────────────────────────────────────
router.post('/:id/aplicar',      verificarToken, ctrl.aplicar);
router.put('/:id/cancelar-post', verificarToken, ctrl.cancelarPostulacion);
router.put('/:id/iniciar',       verificarToken, ctrl.iniciarTrabajo);
router.put('/:id/finalizar-trabajo', verificarToken, ctrl.finalizarTrabajo);  // ← renombrado

// ── CLIENTE — FINALIZAR SERVICIO ──────────────────────
router.put('/:id/finalizar',     verificarToken, ctrl.finalizarServicio);     // ← este queda

// ── DUEÑO ─────────────────────────────────────────────
router.get('/:id/postulaciones',              verificarToken, ctrl.verPostulaciones);
router.put('/postulacion/:postulacionId',      verificarToken, ctrl.gestionarPostulacion);

module.exports = router;