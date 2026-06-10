const pool = require('../config/db');

const NotificacionModel = {

  async crear({ usuario_id, tipo, titulo, mensaje, datos }) {
    const res = await pool.query(
      `INSERT INTO notificaciones (usuario_id, tipo, titulo, mensaje, datos)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [usuario_id, tipo, titulo, mensaje || null, datos ? JSON.stringify(datos) : null]
    );
    return res.rows[0];
  },

  async listar(usuario_id) {
    const res = await pool.query(
      `SELECT * FROM notificaciones
       WHERE usuario_id = $1
       ORDER BY createdat DESC
       LIMIT 50`,
      [usuario_id]
    );
    return res.rows;
  },

  async marcarLeida(id, usuario_id) {
    await pool.query(
      `UPDATE notificaciones SET leida = TRUE
       WHERE id = $1 AND usuario_id = $2`,
      [id, usuario_id]
    );
  },

  async marcarTodasLeidas(usuario_id) {
    await pool.query(
      `UPDATE notificaciones SET leida = TRUE WHERE usuario_id = $1`,
      [usuario_id]
    );
  },

  async contarNoLeidas(usuario_id) {
    const res = await pool.query(
      `SELECT COUNT(*) FROM notificaciones
       WHERE usuario_id = $1 AND leida = FALSE`,
      [usuario_id]
    );
    return parseInt(res.rows[0].count);
  }
};

module.exports = NotificacionModel;