const pool = require('../config/db');

const TrabajoModel = {
  // Crear un nuevo trabajo
  async crear(trabajador_id, url_imagen, public_id, descripcion) {
    const res = await pool.query(
      `INSERT INTO trabajos_realizados (trabajador_id, url_imagen, public_id, descripcion)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [trabajador_id, url_imagen, public_id, descripcion || null]
    );
    return res.rows[0];
  },

  // Listar todos los trabajos de un trabajador
  async listarPorTrabajador(trabajador_id) {
    const res = await pool.query(
      'SELECT * FROM trabajos_realizados WHERE trabajador_id = $1 ORDER BY createdat DESC',
      [trabajador_id]
    );
    return res.rows;
  },

  // Eliminar un trabajo (solo el dueño)
  async eliminar(id, trabajador_id) {
    await pool.query(
      'DELETE FROM trabajos_realizados WHERE id = $1 AND trabajador_id = $2',
      [id, trabajador_id]
    );
  }
};

module.exports = TrabajoModel;