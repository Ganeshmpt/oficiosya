const pool = require('../config/db');

const TrabajadorController = {
  async listar(req, res) {
    try {
      const query = `
        SELECT u.id, u.nombre, u.apellido, u.zona, u.foto_url,
               u.verificado,
               pt.titulo, pt.disponible, pt.precio_desde, pt.descripcion,
               pt.categoria_id,
               c.nombre AS categoria_nombre,
               ROUND(AVG(cal.puntaje), 1) AS rating_promedio,
               COUNT(cal.id) AS total_servicios
        FROM usuarios u
        JOIN perfiles_trabajador pt ON pt.usuario_id = u.id
        LEFT JOIN categorias c ON c.id = pt.categoria_id
        LEFT JOIN calificaciones cal ON cal.calificado_id = u.id
        WHERE u.es_trabajador = true
          AND u.estado = 'activo'
        GROUP BY u.id, u.nombre, u.apellido, u.zona, u.foto_url,
                 u.verificado, pt.titulo, pt.disponible, pt.precio_desde,
                 pt.descripcion, pt.categoria_id, c.nombre
        ORDER BY rating_promedio DESC NULLS LAST, u.nombre
      `;
      const { rows } = await pool.query(query);
      res.json({ trabajadores: rows });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Error al obtener trabajadores' });
    }
  }
};

module.exports = TrabajadorController;