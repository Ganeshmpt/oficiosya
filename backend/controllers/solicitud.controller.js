const SolicitudModel  = require('../models/solicitud.model');
const CategoriaModel  = require('../models/categoria.model');
const pool            = require('../config/db');

const SolicitudController = {

  // ── CREAR ────────────────────────────────────────────
  async crear(req, res) {
    try {
      const { categoria_id, titulo, descripcion, zona, presupuesto, fecha_preferida, urgencia } = req.body;
      if (!titulo) return res.status(400).json({ error: 'El título es obligatorio.' });
      const solicitud = await SolicitudModel.crear({
        cliente_id: req.usuario.id,
        categoria_id, titulo, descripcion, zona, presupuesto, fecha_preferida, urgencia
      });
      return res.status(201).json({ mensaje: 'Solicitud publicada correctamente.', solicitud });
    } catch (err) {
      console.error(err);
      // ✅ FIX: devolver 400 con el mensaje real (ej: límite anti-spam) en vez de 500 genérico
      return res.status(400).json({ error: err.message });
    }
  },

  // ── LISTAR ABIERTAS ──────────────────────────────────
  async listarAbiertas(req, res) {
    try {
      const solicitudes = await SolicitudModel.listarAbiertas();
      return res.json({ solicitudes });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Error al obtener solicitudes.' });
    }
  },

  // ── MIS SOLICITUDES ──────────────────────────────────
  async misSolicitudes(req, res) {
    try {
      const solicitudes = await SolicitudModel.listarPorCliente(req.usuario.id);
      return res.json({ solicitudes });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Error al obtener tus solicitudes.' });
    }
  },

  // ── DETALLE ──────────────────────────────────────────
  async detalle(req, res) {
    try {
      const solicitud = await SolicitudModel.findById(req.params.id);
      if (!solicitud) return res.status(404).json({ error: 'Solicitud no encontrada.' });

      let miPostulacion = null;
      const token = req.headers.authorization?.split(' ')[1];
      if (token) {
        try {
          const jwt = require('jsonwebtoken');
          const decoded = jwt.verify(token, process.env.JWT_SECRET);
          const resultado = await pool.query(
            `SELECT id, estado FROM postulaciones WHERE solicitud_id = $1 AND trabajador_id = $2`,
            [req.params.id, decoded.id]
          );
          miPostulacion = resultado.rows[0] || null;
        } catch(e) {}
      }

      return res.json({ solicitud, miPostulacion });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Error al obtener la solicitud.' });
    }
  },

  // ── EDITAR (dueño) ───────────────────────────────────
  async editar(req, res) {
    try {
      const { id } = req.params;
      const { categoria_id, titulo, descripcion, zona, presupuesto, fecha_preferida, urgencia } = req.body;
      if (!titulo) return res.status(400).json({ error: 'El título es obligatorio.' });

      const solicitud = await SolicitudModel.editar(id, req.usuario.id, {
        categoria_id, titulo, descripcion, zona, presupuesto, fecha_preferida, urgencia
      });
      if (!solicitud) return res.status(404).json({ error: 'Solicitud no encontrada o no autorizada.' });

      return res.json({ mensaje: 'Solicitud actualizada.', solicitud });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Error al editar la solicitud.' });
    }
  },

  // ── ELIMINAR (dueño) ─────────────────────────────────
  async eliminar(req, res) {
    try {
      const { id } = req.params;
      const resultado = await SolicitudModel.eliminar(id, req.usuario.id);
      if (resultado.cancelado) {
        return res.json({ mensaje: 'La solicitud tenía postulaciones, se ha cancelado en lugar de eliminar.' });
      }
      return res.json({ mensaje: 'Solicitud eliminada correctamente.' });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Error al eliminar la solicitud.' });
    }
  },

  // ── CANCELAR (dueño) ─────────────────────────────────
  async cancelar(req, res) {
    try {
      const { id } = req.params;
      await SolicitudModel.cancelar(id, req.usuario.id);
      return res.json({ mensaje: 'Solicitud cancelada.' });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Error al cancelar la solicitud.' });
    }
  },

  // ── POSTULARSE (trabajador) ──────────────────────────
async aplicar(req, res) {
  try {
    const { id } = req.params;
    const { mensaje, precio_oferta, disponibilidad } = req.body;
    const postulacion = await SolicitudModel.aplicar(
      id, req.usuario.id, mensaje, precio_oferta, disponibilidad
    );
    await pool.query('UPDATE usuarios SET es_trabajador = TRUE WHERE id = $1', [req.usuario.id]);

    // ── NOTIFICAR AL CLIENTE ──────────────────────────
    const solRes = await pool.query(
      'SELECT cliente_id, titulo FROM solicitudes WHERE id = $1', [id]
    );
    const sol = solRes.rows[0];
    if (sol) {
      const trabajadorRes = await pool.query(
        'SELECT nombre, apellido FROM usuarios WHERE id = $1', [req.usuario.id]
      );
      const trab = trabajadorRes.rows[0];
      const nombreTrab = trab ? `${trab.nombre} ${trab.apellido || ''}`.trim() : 'Un trabajador';

      const NotificacionModel = require('../models/notificacion.model');
      const notif = await NotificacionModel.crear({
        usuario_id: sol.cliente_id,
        tipo:       'nueva_postulacion',
        titulo:     '¡Tienes una nueva postulación! 📬',
        mensaje:    `${nombreTrab} se postuló para tu servicio "${sol.titulo}".`,
        datos:      { solicitud_id: parseInt(id), postulacion_id: postulacion.id }
      });
      const io = req.app.get('io');
      if (io) io.to(`user_${sol.cliente_id}`).emit('nueva_notificacion', notif);
    }

    return res.status(201).json({ mensaje: 'Te has postulado correctamente.', postulacion });
  } catch (err) {
    console.error(err);
    return res.status(400).json({ error: err.message });
  }
},
  // ── CANCELAR POSTULACIÓN (trabajador) ────────────────
  async cancelarPostulacion(req, res) {
    try {
      const { id } = req.params;
      await SolicitudModel.cancelarPostulacion(id, req.usuario.id);
      return res.json({ mensaje: 'Postulación cancelada.' });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Error al cancelar la postulación.' });
    }
  },

  // ── VER POSTULACIONES (dueño) ────────────────────────
  async verPostulaciones(req, res) {
    try {
      const { id } = req.params;
      const solicitud = await SolicitudModel.findById(id);
      if (!solicitud) return res.status(404).json({ error: 'Solicitud no encontrada.' });
      if (solicitud.cliente_id !== req.usuario.id)
        return res.status(403).json({ error: 'No tienes permiso para ver las postulaciones.' });

      const postulaciones = await SolicitudModel.listarPostulaciones(id);
      return res.json({ postulaciones });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Error al obtener postulaciones.' });
    }
  },

  // ── GESTIONAR POSTULACIÓN (aceptar/rechazar) + NOTIFICACIÓN ──
  async gestionarPostulacion(req, res) {
    try {
      const { postulacionId } = req.params;
      const { estado } = req.body;
      if (!['aceptado', 'rechazado'].includes(estado))
        return res.status(400).json({ error: 'Estado inválido. Use "aceptado" o "rechazado".' });

      const postulacion = await SolicitudModel.gestionarPostulacion(postulacionId, estado);

      const solRes = await pool.query(
        'SELECT titulo FROM solicitudes WHERE id = $1',
        [postulacion.solicitud_id]
      );
      const tituloSolicitud = solRes.rows[0]?.titulo || 'una solicitud';

      const NotificacionModel = require('../models/notificacion.model');
      const io = req.app.get('io');

      if (estado === 'aceptado') {
        await pool.query(
          `UPDATE solicitudes SET trabajador_id = $1, estado = 'confirmada', updatedat = NOW() WHERE id = $2`,
          [postulacion.trabajador_id, postulacion.solicitud_id]
        );

        const notif = await NotificacionModel.crear({
          usuario_id: postulacion.trabajador_id,
          tipo:       'postulacion_aceptada',
          titulo:     '¡Tu postulación fue aceptada! 🎉',
          mensaje:    `Fuiste seleccionado para el servicio "${tituloSolicitud}". Coordina con el cliente para iniciar.`,
          datos:      { solicitud_id: postulacion.solicitud_id, postulacion_id: postulacion.id }
        });
        if (io) io.to(`user_${postulacion.trabajador_id}`).emit('nueva_notificacion', notif);

      } else {
        const notif = await NotificacionModel.crear({
          usuario_id: postulacion.trabajador_id,
          tipo:       'postulacion_rechazada',
          titulo:     'Tu postulación no fue seleccionada',
          mensaje:    `Lo sentimos, no fuiste seleccionado para el servicio "${tituloSolicitud}". ¡Sigue intentando!`,
          datos:      { solicitud_id: postulacion.solicitud_id, postulacion_id: postulacion.id }
        });
        if (io) io.to(`user_${postulacion.trabajador_id}`).emit('nueva_notificacion', notif);
      }

      return res.json({ mensaje: `Postulación ${estado} correctamente.`, postulacion });
    } catch (err) {
      console.error(err);
      return res.status(400).json({ error: err.message });
    }
  },

  // ── INICIAR TRABAJO (trabajador) ─────────────────────
  async iniciarTrabajo(req, res) {
    try {
      const { id } = req.params;
      const solicitud = await SolicitudModel.iniciarTrabajo(id, req.usuario.id);
      return res.json({ mensaje: 'Trabajo iniciado', solicitud });
    } catch (err) {
      console.error(err);
      return res.status(400).json({ error: err.message });
    }
  },

  // ── FINALIZAR TRABAJO (trabajador) ───────────────────
  async finalizarTrabajo(req, res) {
    try {
      const { id } = req.params;
      const solicitud = await SolicitudModel.finalizarTrabajo(id, req.usuario.id);

      const solRes = await pool.query('SELECT cliente_id, titulo FROM solicitudes WHERE id = $1', [id]);
      const sol = solRes.rows[0];
      if (sol) {
        const NotificacionModel = require('../models/notificacion.model');
        const notif = await NotificacionModel.crear({
          usuario_id: sol.cliente_id,
          tipo:       'trabajo_finalizado',
          titulo:     'El trabajador finalizó el servicio ✅',
          mensaje:    `El trabajo "${sol.titulo}" ha sido marcado como finalizado. Ya puedes calificarlo.`,
          datos:      { solicitud_id: id }
        });
        const io = req.app.get('io');
        if (io) io.to(`user_${sol.cliente_id}`).emit('nueva_notificacion', notif);
      }

      return res.json({ mensaje: 'Trabajo finalizado', solicitud });
    } catch (err) {
      console.error(err);
      return res.status(400).json({ error: err.message });
    }
  },

  // ── FINALIZAR SERVICIO (cliente) ─────────────────────
  async finalizarServicio(req, res) {
    try {
      const { id } = req.params;

      const solRes = await pool.query('SELECT * FROM solicitudes WHERE id = $1', [id]);
      const sol = solRes.rows[0];
      if (!sol) return res.status(404).json({ error: 'Solicitud no encontrada.' });
      if (sol.cliente_id !== req.usuario.id)
        return res.status(403).json({ error: 'No tienes permiso para finalizar este servicio.' });
      if (!['confirmada', 'en_curso'].includes(sol.estado))
        return res.status(400).json({ error: 'Solo puedes finalizar servicios confirmados o en curso.' });

      const postRes = await pool.query(
        `SELECT * FROM postulaciones WHERE solicitud_id = $1 AND estado = 'aceptado' LIMIT 1`,
        [id]
      );
      const postulacion = postRes.rows[0];
      if (!postulacion)
        return res.status(400).json({ error: 'No hay trabajador aceptado en esta solicitud.' });

      await pool.query(
        `UPDATE solicitudes SET estado = 'finalizado', updatedat = NOW() WHERE id = $1`, [id]
      );

      const servicioExiste = await pool.query(`SELECT id FROM servicios WHERE solicitud_id = $1`, [id]);
      let servicio_id = null;
      if (!servicioExiste.rows.length) {
        const srvRes = await pool.query(
          `INSERT INTO servicios (solicitud_id, postulacion_id, trabajador_id, cliente_id, estado, fecha_inicio, fecha_fin)
           VALUES ($1, $2, $3, $4, 'completado', NOW(), NOW()) RETURNING id`,
          [id, postulacion.id, postulacion.trabajador_id, req.usuario.id]
        );
        servicio_id = srvRes.rows[0].id;
      } else {
        servicio_id = servicioExiste.rows[0].id;
        await pool.query(`UPDATE servicios SET estado = 'completado', fecha_fin = NOW() WHERE id = $1`, [servicio_id]);
      }

      const NotificacionModel = require('../models/notificacion.model');
      const notif = await NotificacionModel.crear({
        usuario_id: postulacion.trabajador_id,
        tipo:       'servicio_finalizado',
        titulo:     'Servicio finalizado por el cliente ✅',
        mensaje:    `El cliente confirmó que el servicio "${sol.titulo}" fue completado. ¡Ya puedes calificarlo!`,
        datos:      { solicitud_id: id, servicio_id }
      });

      const io = req.app.get('io');
      if (io) io.to(`user_${postulacion.trabajador_id}`).emit('nueva_notificacion', notif);

      return res.json({
        mensaje: 'Servicio finalizado correctamente. Ya puedes calificar al trabajador.',
        servicio_id,
        trabajador_id: postulacion.trabajador_id
      });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Error al finalizar el servicio.' });
    }
  },

  // ── ESTADÍSTICAS ─────────────────────────────────────
  async estadisticas(req, res) {
    try {
      const id = req.usuario.id;
      const [solActivas, serviciosComp, calificacion, postulaciones] = await Promise.all([
        pool.query(`SELECT COUNT(*) FROM solicitudes WHERE cliente_id=$1 AND estado='abierta'`, [id]),
        pool.query(`SELECT COUNT(*) FROM servicios WHERE (cliente_id=$1 OR trabajador_id=$1) AND estado='completado'`, [id]),
        pool.query(`SELECT ROUND(AVG(puntaje),1) as avg FROM calificaciones WHERE calificado_id=$1`, [id]),
        pool.query(`SELECT COUNT(*) FROM postulaciones WHERE trabajador_id=$1`, [id]),
      ]);
      return res.json({
        solicitudes_activas:    parseInt(solActivas.rows[0].count),
        servicios_completados:  parseInt(serviciosComp.rows[0].count),
        calificacion_promedio:  calificacion.rows[0].avg || null,
        postulaciones_enviadas: parseInt(postulaciones.rows[0].count),
      });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Error al obtener estadísticas.' });
    }
  },

  // ── CATEGORÍAS ───────────────────────────────────────
  async categorias(req, res) {
    try {
      const categorias = await CategoriaModel.listar();
      return res.json({ categorias });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Error al obtener categorías.' });
    }
  },
  // ── LISTAR TODAS (admin) ─────────────────────────────
  async listarTodas(req, res) {
    try {
      const result = await pool.query(`
        SELECT s.*, 
               u.nombre, u.apellido, u.email,
               c.nombre AS categoria_nombre
        FROM solicitudes s
        LEFT JOIN usuarios u ON s.cliente_id = u.id
        LEFT JOIN categorias c ON s.categoria_id = c.id
        ORDER BY s.createdat DESC
      `);
      return res.json({ solicitudes: result.rows });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Error al obtener solicitudes.' });
    }
  },
};

module.exports = SolicitudController;