const pool = require('../config/db');

const CalificacionController = {

  // ── CREAR CALIFICACIÓN ────────────────────────────────
  async crear(req, res) {
    try {
      const { solicitud_id, calificado_id, puntaje, comentario } = req.body;
      const calificador_id = req.usuario.id;

      if (!solicitud_id || !calificado_id || !puntaje)
        return res.status(400).json({ error: 'Faltan campos obligatorios.' });
      if (puntaje < 1 || puntaje > 5)
        return res.status(400).json({ error: 'El puntaje debe ser entre 1 y 5.' });

      const solRes = await pool.query('SELECT * FROM solicitudes WHERE id = $1', [solicitud_id]);
      const sol = solRes.rows[0];
      if (!sol) return res.status(404).json({ error: 'Solicitud no encontrada.' });
      if (!['confirmada', 'finalizado', 'completado'].includes(sol.estado))
        return res.status(400).json({ error: 'Solo puedes calificar solicitudes finalizadas.' });

      const esCliente    = sol.cliente_id    === calificador_id;
      const esTrabajador = sol.trabajador_id === calificador_id;

      if (!esCliente && !esTrabajador)
        return res.status(403).json({ error: 'No participaste en este servicio.' });

      if (esCliente    && calificado_id !== sol.trabajador_id)
        return res.status(400).json({ error: 'Solo puedes calificar al trabajador asignado.' });
      if (esTrabajador && calificado_id !== sol.cliente_id)
        return res.status(400).json({ error: 'Solo puedes calificar al cliente de esta solicitud.' });

      const tipo = esCliente ? 'cliente_a_trabajador' : 'trabajador_a_cliente';

      // Verificar duplicado
      const existe = await pool.query(
        'SELECT id FROM calificaciones WHERE solicitud_id = $1 AND calificador_id = $2',
        [solicitud_id, calificador_id]
      );
      if (existe.rows.length > 0)
        return res.status(400).json({ message: 'Ya calificaste este servicio.' });

      const result = await pool.query(
        `INSERT INTO calificaciones
         (solicitud_id, calificador_id, calificado_id, puntaje, comentario, tipo)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [solicitud_id, calificador_id, calificado_id, puntaje, comentario || null, tipo]
      );

      // Actualizar rating promedio del trabajador
      if (tipo === 'cliente_a_trabajador') {
        await pool.query(
          `UPDATE perfiles_trabajador SET
             rating_promedio = (
               SELECT ROUND(AVG(puntaje)::numeric, 2)
               FROM calificaciones
               WHERE calificado_id = $1 AND tipo = 'cliente_a_trabajador'
             ),
             total_servicios = total_servicios + 1
           WHERE usuario_id = $1`,
          [calificado_id]
        );
      }

      return res.status(201).json({
        mensaje: 'Calificación enviada correctamente.',
        calificacion: result.rows[0]
      });
    } catch (err) {
      console.error('ERROR CALIFICACION:', err);
      return res.status(500).json({ error: 'Error al guardar la calificación.' });
    }
  },

  // ── ESTADO DE CALIFICACIONES DE UNA SOLICITUD ─────────
  // GET /calificaciones/estado/:solicitud_id
  // Devuelve: quién ha calificado, si el usuario actual ya calificó, y datos de la solicitud
  async estado(req, res) {
    try {
      const { solicitud_id } = req.params;
      const usuario_id = req.usuario.id;

      const solRes = await pool.query('SELECT * FROM solicitudes WHERE id = $1', [solicitud_id]);
      const sol = solRes.rows[0];
      if (!sol) return res.status(404).json({ error: 'Solicitud no encontrada.' });

      // Calificación del cliente al trabajador
      const calCliente = await pool.query(
        `SELECT puntaje, comentario, createdat FROM calificaciones
         WHERE solicitud_id = $1 AND tipo = 'cliente_a_trabajador'`,
        [solicitud_id]
      );

      // Calificación del trabajador al cliente
      const calTrabajador = await pool.query(
        `SELECT puntaje, comentario, createdat FROM calificaciones
         WHERE solicitud_id = $1 AND tipo = 'trabajador_a_cliente'`,
        [solicitud_id]
      );

      // ¿El usuario actual ya calificó?
      const yaCalifico = await pool.query(
        `SELECT id FROM calificaciones WHERE solicitud_id = $1 AND calificador_id = $2`,
        [solicitud_id, usuario_id]
      );

      const ambosCalificaron = calCliente.rows.length > 0 && calTrabajador.rows.length > 0;

      return res.json({
        solicitud:             sol,
        calificacionCliente:   calCliente.rows[0]    || null,
        calificacionTrabajador: calTrabajador.rows[0] || null,
        yaCalifico:            yaCalifico.rows.length > 0,
        ambosCalificaron
      });
    } catch (err) {
      console.error('ERROR ESTADO CALIFICACION:', err);
      return res.status(500).json({ error: 'Error al obtener estado de calificaciones.' });
    }
  },

  // ── MIS CALIFICACIONES RECIBIDAS ──────────────────────
  async misCalificaciones(req, res) {
    try {
      const result = await pool.query(
        `SELECT c.*,
                u.nombre   AS calificador_nombre,
                u.apellido AS calificador_apellido,
                s.titulo   AS solicitud_titulo,
                c.tipo
         FROM calificaciones c
         JOIN usuarios u       ON c.calificador_id = u.id
         LEFT JOIN solicitudes s ON c.solicitud_id  = s.id
         WHERE c.calificado_id = $1
         ORDER BY c.createdat DESC`,
        [req.usuario.id]
      );
      return res.json({ calificaciones: result.rows });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Error al obtener calificaciones.' });
    }
  }
};

module.exports = CalificacionController;