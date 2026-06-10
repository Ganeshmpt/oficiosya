const pool = require('../config/db');

const ChatModel = {

  async enviarMensaje({ emisor_id, receptor_id, solicitud_id, contenido }) {
    const res = await pool.query(
      `INSERT INTO mensajes (emisor_id, receptor_id, solicitud_id, contenido)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [emisor_id, receptor_id, solicitud_id || null, contenido]
    );
    return res.rows[0];
  },

  async obtenerConversacion(usuario1_id, usuario2_id) {
    const res = await pool.query(
      `SELECT m.*,
              e.nombre AS emisor_nombre, e.apellido AS emisor_apellido, e.foto_url AS emisor_foto,
              r.nombre AS receptor_nombre, r.apellido AS receptor_apellido
       FROM mensajes m
       JOIN usuarios e ON m.emisor_id  = e.id
       JOIN usuarios r ON m.receptor_id = r.id
       WHERE (m.emisor_id = $1 AND m.receptor_id = $2)
          OR (m.emisor_id = $2 AND m.receptor_id = $1)
       ORDER BY m.createdat ASC`,
      [usuario1_id, usuario2_id]
    );
    return res.rows;
  },

  async misConversaciones(usuario_id) {
    const res = await pool.query(
      `SELECT DISTINCT ON (otro_id)
              otro_id,
              u.nombre, u.apellido, u.foto_url,
              m.contenido AS ultimo_mensaje,
              m.createdat AS ultima_fecha,
              m.leido,
              m.emisor_id,
              COUNT(*) FILTER (WHERE m.leido = FALSE AND m.receptor_id = $1) OVER (PARTITION BY otro_id) AS no_leidos
       FROM (
         SELECT *, CASE WHEN emisor_id = $1 THEN receptor_id ELSE emisor_id END AS otro_id
         FROM mensajes
         WHERE emisor_id = $1 OR receptor_id = $1
       ) m
       JOIN usuarios u ON u.id = m.otro_id
       ORDER BY otro_id, m.createdat DESC`,
      [usuario_id]
    );
    return res.rows;
  },

  async marcarLeidos(emisor_id, receptor_id) {
    await pool.query(
      `UPDATE mensajes SET leido = TRUE
       WHERE emisor_id = $1 AND receptor_id = $2 AND leido = FALSE`,
      [emisor_id, receptor_id]
    );
  },

  async contarNoLeidos(usuario_id) {
    const res = await pool.query(
      `SELECT COUNT(*) FROM mensajes
       WHERE receptor_id = $1 AND leido = FALSE`,
      [usuario_id]
    );
    return parseInt(res.rows[0].count);
  }
};

module.exports = ChatModel;