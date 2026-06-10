const pool = require('../config/db');

const StatsController = {
  async misStats(req, res) {
    const userId = req.usuario.id;
    
    try {
      // Solicitudes activas (como cliente)
      const solicActivas = await pool.query(
        "SELECT COUNT(*) FROM solicitudes WHERE cliente_id = $1 AND estado = 'abierta'",
        [userId]
      );

      // Servicios completados (como cliente o trabajador)
      const serviciosComp = await pool.query(
        `SELECT COUNT(*) FROM solicitudes 
         WHERE (cliente_id = $1 OR trabajador_id = $1) 
         AND estado = 'finalizado'`,
        [userId]
      );

      // Calificación promedio (como trabajador)
      const calificacion = await pool.query(
        "SELECT ROUND(AVG(puntaje)::numeric, 1) as promedio FROM calificaciones WHERE calificado_id = $1",
        [userId]
      );

      // Postulaciones enviadas (como trabajador)
      const postulaciones = await pool.query(
        "SELECT COUNT(*) FROM postulaciones WHERE trabajador_id = $1",
        [userId]
      );

      return res.json({
        solicitudes_activas:    parseInt(solicActivas.rows[0].count),
        servicios_completados:  parseInt(serviciosComp.rows[0].count),
        calificacion_promedio:  calificacion.rows[0].promedio || '—',
        postulaciones_enviadas: parseInt(postulaciones.rows[0].count),
      });

    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Error al obtener estadísticas.' });
    }
  }
};

module.exports = StatsController;