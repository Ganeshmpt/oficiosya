const pool = require('../config/db');
const bcrypt = require('bcrypt');
// ── Umbral de reportes para suspensión automática ─────
const REPORTES_PARA_SUSPENSION = 3;

// ── Helper: registrar evento ──────────────────────────
async function registrarEvento({ usuario_id, tipo, descripcion, datos = {} }) {
  try {
    await pool.query(
      `INSERT INTO eventos_log (usuario_id, tipo, descripcion, datos)
       VALUES ($1, $2, $3, $4)`,
      [usuario_id, tipo, descripcion, JSON.stringify(datos)]
    );
  } catch(e) {
    console.error('Error al registrar evento log:', e.message);
  }
}

// 1. Listar usuarios
const listarUsuarios = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, nombre, apellido, email, rol, estado, verificado, email_verificado, is_admin, createdat
      FROM usuarios
      WHERE is_admin = FALSE
      ORDER BY id DESC
    `);
    res.status(200).json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error al listar usuarios:', error);
    res.status(500).json({ success: false, message: 'Error al obtener los usuarios' });
  }
};

// 2. Bloquear / desbloquear usuario
const toggleBloqueoUsuario = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await pool.query('SELECT estado FROM usuarios WHERE id = $1', [id]);
    if (!user.rows.length)
      return res.status(404).json({ success: false, message: 'Usuario no encontrado' });

    const nuevoEstado = user.rows[0].estado?.toLowerCase() === 'activo' ? 'bloqueado' : 'activo';
    await pool.query('UPDATE usuarios SET estado = $1 WHERE id = $2', [nuevoEstado, id]);

    // 📋 Trazabilidad
    await registrarEvento({
      usuario_id: req.usuario.id,
      tipo: `usuario_${nuevoEstado}`,
      descripcion: `Admin ${nuevoEstado} al usuario #${id}`,
      datos: { usuario_afectado: id, admin_id: req.usuario.id }
    });

    res.status(200).json({ success: true, message: `Usuario ${nuevoEstado} correctamente.`, nuevoEstado });
  } catch (error) {
    console.error('Error al cambiar estado:', error);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
};

// 3. Verificar identidad de usuario (RF10)
const verificarUsuario = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `UPDATE usuarios SET verificado = TRUE, email_verificado = TRUE
       WHERE id = $1
       RETURNING id, nombre, verificado, email_verificado`,
      [id]
    );
    if (!result.rows.length)
      return res.status(404).json({ success: false, message: 'Usuario no encontrado.' });

    // 📋 Trazabilidad
    await registrarEvento({
      usuario_id: req.usuario.id,
      tipo: 'usuario_verificado',
      descripcion: `Admin verificó al usuario #${id}`,
      datos: { usuario_afectado: id, admin_id: req.usuario.id }
    });

    res.status(200).json({ success: true, mensaje: 'Usuario verificado correctamente.', usuario: result.rows[0] });
  } catch (error) {
    console.error('Error al verificar usuario:', error);
    res.status(500).json({ success: false, message: 'Error al verificar usuario.' });
  }
};

// 4. Crear reporte + suspensión automática por acumulación
const crearReporte = async (req, res) => {
  try {
    const { tipo, referencia_id, reportado_id, motivo, descripcion } = req.body;
    const reportador_id = req.usuario?.id || null;

    if (!reportado_id || !motivo)
      return res.status(400).json({ success: false, message: 'Faltan datos para crear el reporte.' });

    // Verificar que el usuario reportado existe
    const usuarioExiste = await pool.query('SELECT id, estado FROM usuarios WHERE id = $1', [reportado_id]);
    if (!usuarioExiste.rows.length)
      return res.status(404).json({ success: false, message: `El usuario con id ${reportado_id} no existe.` });

    // Insertar reporte
    await pool.query(
      `INSERT INTO reportes (reportador_id, reportado_id, tipo, referencia_id, motivo, descripcion, estado)
       VALUES ($1, $2, $3, $4, $5, $6, 'pendiente')`,
      [reportador_id, reportado_id, tipo || 'usuario', referencia_id || null, motivo, descripcion || '']
    );

    // 📋 Trazabilidad
    await registrarEvento({
      usuario_id: reportador_id,
      tipo: 'reporte_creado',
      descripcion: `Reporte contra usuario #${reportado_id}: ${motivo}`,
      datos: { reportado_id, tipo, referencia_id }
    });

    // 🛡️ Suspensión automática: contar reportes pendientes del usuario
    const conteoRes = await pool.query(
      `SELECT COUNT(*) FROM reportes WHERE reportado_id = $1 AND estado = 'pendiente'`,
      [reportado_id]
    );
    const totalReportes = parseInt(conteoRes.rows[0].count);

    let suspendido = false;
    if (totalReportes >= REPORTES_PARA_SUSPENSION && usuarioExiste.rows[0].estado !== 'bloqueado') {
      // Suspender automáticamente
      await pool.query(
        `UPDATE usuarios SET estado = 'bloqueado' WHERE id = $1`,
        [reportado_id]
      );

      // Notificar al usuario suspendido
      await pool.query(
        `INSERT INTO notificaciones (usuario_id, tipo, titulo, mensaje, leida, datos)
         VALUES ($1, 'advertencia', '⚠️ Cuenta suspendida temporalmente',
         'Tu cuenta ha sido suspendida automáticamente por acumulación de reportes. Contacta al soporte si crees que es un error.',
         false, $2)`,
        [reportado_id, JSON.stringify({ origen: 'sistema', reportes: totalReportes })]
      );

      // Notificar al admin
      const admins = await pool.query(`SELECT id FROM usuarios WHERE is_admin = TRUE`);
      for (const admin of admins.rows) {
        await pool.query(
          `INSERT INTO notificaciones (usuario_id, tipo, titulo, mensaje, leida, datos)
           VALUES ($1, 'advertencia', '🚨 Usuario suspendido automáticamente',
           $2, false, $3)`,
          [
            admin.id,
            `El usuario #${reportado_id} fue suspendido automáticamente por acumular ${totalReportes} reportes.`,
            JSON.stringify({ usuario_id: reportado_id, reportes: totalReportes })
          ]
        );
      }

      // 📋 Trazabilidad
      await registrarEvento({
        usuario_id: reportado_id,
        tipo: 'usuario_suspendido_automatico',
        descripcion: `Usuario #${reportado_id} suspendido automáticamente por ${totalReportes} reportes`,
        datos: { reportes: totalReportes, umbral: REPORTES_PARA_SUSPENSION }
      });

      suspendido = true;
    }

    res.status(200).json({
      success: true,
      message: 'Reporte registrado exitosamente.',
      suspendido_automaticamente: suspendido
    });
  } catch (error) {
    console.error('Error al crear reporte:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// 5. Listar verificaciones de documentos
const listarVerificaciones = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT v.id, v.doc_url, v.estado, v.motivo_rechazo, v.createdat,
             u.id AS usuario_id, u.nombre, u.apellido, u.email, u.verificado
      FROM verificaciones v
      JOIN usuarios u ON v.usuario_id = u.id
      ORDER BY
        CASE v.estado WHEN 'pendiente' THEN 0 WHEN 'aprobada' THEN 1 ELSE 2 END,
        v.createdat DESC
    `);
    res.status(200).json({ success: true, verificaciones: result.rows });
  } catch (error) {
    console.error('Error al listar verificaciones:', error);
    res.status(500).json({ success: false, message: 'Error al obtener verificaciones.' });
  }
};

// 6. Aprobar o rechazar documento de verificación
const gestionarVerificacion = async (req, res) => {
  try {
    const { id } = req.params;
    const { estado, motivo_rechazo } = req.body;

    if (!['aprobada', 'rechazada'].includes(estado))
      return res.status(400).json({ success: false, message: 'Estado inválido. Usa aprobada o rechazada.' });

    const verif = await pool.query(
      `UPDATE verificaciones SET estado = $1, motivo_rechazo = $2 WHERE id = $3 RETURNING usuario_id`,
      [estado, motivo_rechazo || null, id]
    );

    if (!verif.rows.length)
      return res.status(404).json({ success: false, message: 'Verificación no encontrada.' });

    const usuarioId = verif.rows[0].usuario_id;

    if (estado === 'aprobada') {
      await pool.query(`UPDATE usuarios SET verificado = TRUE WHERE id = $1`, [usuarioId]);
      await pool.query(
        `INSERT INTO notificaciones (usuario_id, tipo, titulo, mensaje, leida, datos)
         VALUES ($1, 'verificacion', '✅ Documento aprobado',
         'Tu documento de identidad fue aprobado. Ya estás verificado en la plataforma.', false, $2)`,
        [usuarioId, JSON.stringify({ origen: 'admin' })]
      );
    } else {
      await pool.query(
        `INSERT INTO notificaciones (usuario_id, tipo, titulo, mensaje, leida, datos)
         VALUES ($1, 'verificacion', '❌ Documento rechazado', $2, false, $3)`,
        [
          usuarioId,
          `Tu documento fue rechazado. Motivo: ${motivo_rechazo || 'No especificado'}`,
          JSON.stringify({ origen: 'admin' })
        ]
      );
    }

    // 📋 Trazabilidad
    await registrarEvento({
      usuario_id: req.usuario.id,
      tipo: `verificacion_${estado}`,
      descripcion: `Verificación #${id} ${estado} por admin`,
      datos: { verificacion_id: id, usuario_afectado: usuarioId }
    });

    res.status(200).json({ success: true, message: `Documento ${estado} correctamente.` });
  } catch (error) {
    console.error('Error al gestionar verificación:', error);
    res.status(500).json({ success: false, message: 'Error al gestionar verificación.' });
  }
};

// 7. Enviar advertencia a un usuario
const enviarAdvertencia = async (req, res) => {
  try {
    const { id } = req.params;
    const { titulo, mensaje } = req.body;

    if (!titulo || !mensaje)
      return res.status(400).json({ success: false, message: 'Título y mensaje son requeridos.' });

    const usuario = await pool.query('SELECT id FROM usuarios WHERE id = $1', [id]);
    if (!usuario.rows.length)
      return res.status(404).json({ success: false, message: 'Usuario no encontrado.' });

    await pool.query(
      `INSERT INTO notificaciones (usuario_id, tipo, titulo, mensaje, leida, datos)
       VALUES ($1, 'advertencia', $2, $3, false, $4)`,
      [id, titulo, mensaje, JSON.stringify({ origen: 'admin' })]
    );

    // 📋 Trazabilidad
    await registrarEvento({
      usuario_id: req.usuario.id,
      tipo: 'advertencia_enviada',
      descripcion: `Admin envió advertencia al usuario #${id}: ${titulo}`,
      datos: { usuario_afectado: id, admin_id: req.usuario.id }
    });

    res.status(200).json({ success: true, message: 'Advertencia enviada correctamente.' });
  } catch (error) {
    console.error('Error al enviar advertencia:', error);
    res.status(500).json({ success: false, message: 'Error al enviar advertencia.' });
  }
};

// 8. ── NUEVO: Ver logs de trazabilidad (solo admin) ───
const listarEventos = async (req, res) => {
  try {
    const { usuario_id, tipo, limit = 50, offset = 0 } = req.query;
    let query = `
      SELECT e.*, u.nombre, u.email
      FROM eventos_log e
      LEFT JOIN usuarios u ON e.usuario_id = u.id
      WHERE 1=1
    `;
    const params = [];
    if (usuario_id) { params.push(usuario_id); query += ` AND e.usuario_id = $${params.length}`; }
    if (tipo)       { params.push(tipo);       query += ` AND e.tipo = $${params.length}`; }
    params.push(limit);  query += ` ORDER BY e.createdat DESC LIMIT $${params.length}`;
    params.push(offset); query += ` OFFSET $${params.length}`;

    const result = await pool.query(query, params);
    res.status(200).json({ success: true, eventos: result.rows, total: result.rows.length });
  } catch (error) {
    console.error('Error al listar eventos:', error);
    res.status(500).json({ success: false, message: 'Error al obtener eventos.' });
  }
};
// 9. Cancelar solicitud por contenido inapropiado (admin)
const cancelarSolicitudAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const { motivo } = req.body;

    const result = await pool.query(
      `UPDATE solicitudes SET estado = 'cancelada', updatedat = NOW()
       WHERE id = $1 AND estado = 'abierta'
       RETURNING id, titulo, cliente_id`,
      [id]
    );

    if (!result.rows.length)
      return res.status(404).json({ success: false, message: 'Solicitud no encontrada o ya no está abierta.' });

    const { titulo, cliente_id } = result.rows[0];

    // Notificar al cliente
    await pool.query(
      `INSERT INTO notificaciones (usuario_id, tipo, titulo, mensaje, leida, datos)
       VALUES ($1, 'advertencia', '❌ Solicitud cancelada por moderación',
       $2, false, $3)`,
      [
        cliente_id,
        `Tu solicitud "${titulo}" fue cancelada por el administrador. Motivo: ${motivo || 'Contenido inapropiado'}`,
        JSON.stringify({ solicitud_id: id, origen: 'admin' })
      ]
    );
    

    // Trazabilidad
    await registrarEvento({
      usuario_id: req.usuario.id,
      tipo: 'solicitud_cancelada_admin',
      descripcion: `Admin canceló la solicitud #${id}: ${motivo || ''}`,
      datos: { solicitud_id: id, admin_id: req.usuario.id }
    });

    res.status(200).json({ success: true, message: 'Solicitud cancelada correctamente.' });
  } catch (error) {
    console.error('Error al cancelar solicitud:', error);
    res.status(500).json({ success: false, message: 'Error interno del servidor.' });
  }
};
// 10. Reset password de usuario (admin)

const resetPasswordUsuario = async (req, res) => {
  try {
    const { id } = req.params;
    const { nueva_password } = req.body;
    if (!nueva_password) return res.status(400).json({ success: false, message: 'La nueva contraseña es requerida.' });
    const hash = await bcrypt.hash(nueva_password, 10);
    await pool.query('UPDATE usuarios SET password_hash = $1 WHERE id = $2', [hash, id]);
    res.json({ success: true, message: 'Contraseña restablecida.' });
  } catch(e) {
    res.status(500).json({ success: false, message: 'Error al restablecer contraseña.' });
  }
};

module.exports = {
  listarUsuarios,
  toggleBloqueoUsuario,
  verificarUsuario,
  crearReporte,
  listarVerificaciones,
  gestionarVerificacion,
  enviarAdvertencia,
  listarEventos,
  cancelarSolicitudAdmin,
  resetPasswordUsuario,  // ← nuevo
};