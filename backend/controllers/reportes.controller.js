const pool = require('../config/db');
const { enviarResolucionReporte } = require('../utils/email');

const ReporteController = {

  async registrar(req, res) {
    try {
      const { tipo, referencia_id, reportado_id, motivo, descripcion } = req.body;
      const reportador_id = req.usuario?.id || null;

      if (!tipo || !referencia_id || !motivo || !reportado_id) {
        return res.status(400).json({ success: false, message: 'Datos incompletos.' });
      }

      await pool.query(
        `INSERT INTO reportes (reportador_id, reportado_id, tipo, referencia_id, motivo, descripcion, estado)
         VALUES ($1, $2, $3, $4, $5, $6, 'pendiente')`,
        [reportador_id, reportado_id, tipo, referencia_id, motivo, descripcion || '']
      );

      // ✅ SUSPENSIÓN AUTOMÁTICA: si acumula 3 reportes pendientes, se bloquea
      const conteo = await pool.query(
        `SELECT COUNT(*) FROM reportes WHERE reportado_id = $1 AND estado = 'pendiente'`,
        [reportado_id]
      );
      
      if (parseInt(conteo.rows[0].count) >= 3) {
        await pool.query(
          `UPDATE usuarios SET estado = 'bloqueado' WHERE id = $1`,
          [reportado_id]
        );
        console.log(`⚠️ Usuario #${reportado_id} suspendido automáticamente por acumulación de reportes.`);
      }

      return res.json({ success: true, message: 'Reporte registrado. El equipo lo revisará.' });
    } catch (err) {
      console.error('ERROR REPORTES:', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  },

  async listar(req, res) {
    try {
      const r = await pool.query(
        `SELECT rep.*,
                u.nombre  AS reportador_nombre,
                u.email   AS reportador_email,
                ru.nombre AS reportado_nombre,
                ru.email  AS reportado_email
         FROM reportes rep
         LEFT JOIN usuarios u  ON rep.reportador_id = u.id
         LEFT JOIN usuarios ru ON rep.reportado_id  = ru.id
         ORDER BY rep.createdat DESC`
      );
      return res.json({ success: true, reportes: r.rows });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },

  async gestionar(req, res) {
    try {
      const { id } = req.params;
      const { estado, accion_tomada } = req.body;

      if (!estado) {
        return res.status(400).json({ success: false, message: 'El estado es requerido.' });
      }

      await pool.query(
        `UPDATE reportes SET estado = $1, accion_tomada = $2 WHERE id = $3`,
        [estado, accion_tomada || '', id]
      );

      // ✅ Si se resuelve o rechaza un reporte, verificar si el usuario debe desbloquearse
      if (estado === 'resuelto' || estado === 'rechazado') {
        // Obtener el reportado_id de este reporte
        const rep = await pool.query(
          `SELECT reportado_id FROM reportes WHERE id = $1`,
          [id]
        );
        if (rep.rows.length > 0) {
          const reportado_id = rep.rows[0].reportado_id;
          const pendientes = await pool.query(
            `SELECT COUNT(*) FROM reportes WHERE reportado_id = $1 AND estado = 'pendiente'`,
            [reportado_id]
          );
          // Si baja de 3 pendientes, desbloquear automáticamente
          if (parseInt(pendientes.rows[0].count) < 3) {
            await pool.query(
              `UPDATE usuarios SET estado = 'activo' WHERE id = $1 AND estado = 'bloqueado'`,
              [reportado_id]
            );
          }
        }
      }

      // ✅ Enviar correo al reportador de forma independiente
      try {
        console.log('📧 Intentando enviar correo para reporte:', id);
        
        const reportador = await pool.query(
          `SELECT u.email, u.nombre, rep.motivo
           FROM reportes rep
           JOIN usuarios u ON rep.reportador_id = u.id
           WHERE rep.id = $1`,
          [id]
        );

        if (reportador.rows.length > 0) {
          const { email, nombre, motivo } = reportador.rows[0];
          await enviarResolucionReporte({
            email,
            nombre,
            motivo,
            estado,
            accion: accion_tomada || `Tu reporte fue marcado como ${estado} por el administrador.`
          });
          
          console.log('📧 Correo enviado a:', email);
        }
      } catch (mailErr) {
        console.warn('⚠️ No se pudo enviar el correo al reportador:', mailErr.message);
      }
      // ✅ Enviar notificaciones in-app
      try {
        const repData = await pool.query(
          `SELECT rep.reportador_id, rep.reportado_id, rep.motivo
           FROM reportes rep WHERE rep.id = $1`, [id]
        );

        if (repData.rows.length > 0) {
          const { reportador_id, reportado_id, motivo } = repData.rows[0];

          if (estado === 'resuelto') {
            // Notificar al REPORTADO: advertencia
            await pool.query(
              `INSERT INTO notificaciones (usuario_id, tipo, titulo, mensaje, leida, datos)
               VALUES ($1, 'advertencia', '⚠️ Has sido reportado',
               $2, false, $3)`,
              [
                reportado_id,
                `Se ha revisado un reporte en tu contra por: "${motivo}". El equipo tomó acción. Si continúas con este comportamiento, tu cuenta podría ser bloqueada.`,
                JSON.stringify({ origen: 'admin', reporte_id: id })
              ]
            );
            // Notificar al REPORTADOR: reporte resuelto
            await pool.query(
              `INSERT INTO notificaciones (usuario_id, tipo, titulo, mensaje, leida, datos)
               VALUES ($1, 'verificacion', '✅ Tu reporte fue resuelto',
               $2, false, $3)`,
              [
                reportador_id,
                `Tu reporte por "${motivo}" fue revisado y se tomaron las medidas correspondientes. Gracias por ayudar a mantener la comunidad.`,
                JSON.stringify({ origen: 'admin', reporte_id: id })
              ]
            );

          } else if (estado === 'rechazado') {
            // Notificar al REPORTADOR: reporte rechazado
            await pool.query(
              `INSERT INTO notificaciones (usuario_id, tipo, titulo, mensaje, leida, datos)
               VALUES ($1, 'advertencia', '❌ Tu reporte no procedió',
               $2, false, $3)`,
              [
                reportador_id,
                `Tu reporte por "${motivo}" fue revisado y no encontramos suficientes razones para tomar acción. Si tienes más evidencia, puedes volver a reportar.`,
                JSON.stringify({ origen: 'admin', reporte_id: id })
              ]
            );
          }
        }
      } catch (notifErr) {
        console.warn('⚠️ No se pudo enviar notificación in-app:', notifErr.message);
      }

      return res.json({ success: true, message: 'Reporte actualizado correctamente.' });
    } catch (err) {
      console.error('ERROR GESTIONAR REPORTE:', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }
};

module.exports = ReporteController;