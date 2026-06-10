const express = require('express');
const router  = express.Router();
const pool    = require('../config/db');
const { verificarToken } = require('../middlewares/auth.middleware');

// GET /api/notificaciones — listar las del usuario
router.get('/', verificarToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM notificaciones
       WHERE usuario_id = $1
       ORDER BY createdat DESC LIMIT 50`,
      [req.usuario.id]
    );
    res.json({ success: true, notificaciones: result.rows });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// PUT /api/notificaciones/:id/leer
router.put('/:id/leer', verificarToken, async (req, res) => {
  await pool.query(
    `UPDATE notificaciones SET leida = TRUE WHERE id = $1 AND usuario_id = $2`,
    [req.params.id, req.usuario.id]
  );
  res.json({ success: true });
});

// PUT /api/notificaciones/leer-todas
router.put('/leer-todas', verificarToken, async (req, res) => {
  await pool.query(
    `UPDATE notificaciones SET leida = TRUE WHERE usuario_id = $1`,
    [req.usuario.id]
  );
  res.json({ success: true });
});

module.exports = router;