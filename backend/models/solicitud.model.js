const pool = require('../config/db');

// ── ANTI-SPAM: máximo de solicitudes abiertas por cliente ──
const MAX_SOLICITUDES_ABIERTAS = 5;

const SolicitudModel = {

  // ── CREAR (con anti-spam) ────────────────────────────
  async crear({ cliente_id, categoria_id, titulo, descripcion, zona, presupuesto, fecha_preferida, urgencia }) {
    // 🛡️ Anti-spam: verificar cuántas solicitudes abiertas tiene el cliente
    const spam = await pool.query(
      `SELECT COUNT(*) FROM solicitudes WHERE cliente_id = $1 AND estado = 'abierta'`,
      [cliente_id]
    );
    if (parseInt(spam.rows[0].count) >= MAX_SOLICITUDES_ABIERTAS) {
      throw new Error(`Límite alcanzado: solo puedes tener ${MAX_SOLICITUDES_ABIERTAS} solicitudes abiertas a la vez.`);
    }

    const res = await pool.query(
      `INSERT INTO solicitudes (cliente_id, categoria_id, titulo, descripcion, zona, presupuesto, fecha_preferida, urgencia)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [cliente_id, categoria_id || null, titulo, descripcion || '', zona || '', presupuesto || null, fecha_preferida || null, urgencia || 'normal']
    );

    // 📋 Trazabilidad: registrar evento de creación
    await registrarEvento({
      usuario_id: cliente_id,
      tipo: 'solicitud_creada',
      descripcion: `Solicitud creada: "${titulo}"`,
      datos: { solicitud_id: res.rows[0].id, zona, categoria_id }
    });

    return res.rows[0];
  },

  // ── LISTAR ABIERTAS (todas) ──────────────────────────
  async listarAbiertas() {
    const res = await pool.query(
      `SELECT s.*, u.nombre, u.apellido, u.zona as zona_cliente,
              c.nombre as categoria_nombre
       FROM solicitudes s
       JOIN usuarios u ON s.cliente_id = u.id
       LEFT JOIN categorias c ON s.categoria_id = c.id
       WHERE s.estado = 'abierta'
       ORDER BY s.createdat DESC`
    );
    return res.rows;
  },

  // ── MIS SOLICITUDES (cliente + trabajador) ───────────
  async listarPorCliente(usuario_id) {
    const res = await pool.query(
      `SELECT s.*, c.nombre as categoria_nombre, u.nombre as cliente_nombre, u.apellido as cliente_apellido
       FROM solicitudes s
       LEFT JOIN categorias c ON s.categoria_id = c.id
       LEFT JOIN usuarios u ON s.cliente_id = u.id
       WHERE s.cliente_id = $1 OR s.trabajador_id = $1
       ORDER BY s.createdat DESC`,
      [usuario_id]
    );
    return res.rows;
  },

  // ── BUSCAR POR ID ────────────────────────────────────
  async findById(id) {
    const res = await pool.query(
      `SELECT s.*, u.nombre, u.apellido, c.nombre as categoria_nombre
       FROM solicitudes s
       JOIN usuarios u ON s.cliente_id = u.id
       LEFT JOIN categorias c ON s.categoria_id = c.id
       WHERE s.id = $1`,
      [id]
    );
    return res.rows[0] || null;
  },

  // ── EDITAR (dueño) ───────────────────────────────────
  async editar(id, cliente_id, { categoria_id, titulo, descripcion, zona, presupuesto, fecha_preferida, urgencia }) {
    const res = await pool.query(
      `UPDATE solicitudes
       SET categoria_id=$1, titulo=$2, descripcion=$3, zona=$4, presupuesto=$5,
           fecha_preferida=$6, urgencia=$7, updatedat=NOW()
       WHERE id=$8 AND cliente_id=$9
       RETURNING *`,
      [categoria_id || null, titulo, descripcion || '', zona || '', presupuesto || null,
       fecha_preferida || null, urgencia || 'normal', id, cliente_id]
    );
    return res.rows[0];
  },

  // ── ELIMINAR (dueño) ─────────────────────────────────
  async eliminar(id, cliente_id) {
    const check = await pool.query(
      'SELECT id FROM postulaciones WHERE solicitud_id = $1 LIMIT 1', [id]
    );
    if (check.rows.length > 0) {
      await this.cancelar(id, cliente_id);
      return { cancelado: true };
    }
    await pool.query('DELETE FROM solicitudes WHERE id = $1 AND cliente_id = $2', [id, cliente_id]);

    // 📋 Trazabilidad
    await registrarEvento({
      usuario_id: cliente_id,
      tipo: 'solicitud_eliminada',
      descripcion: `Solicitud #${id} eliminada`,
      datos: { solicitud_id: id }
    });

    return { cancelado: false };
  },

  // ── CANCELAR (dueño) ─────────────────────────────────
  async cancelar(id, cliente_id) {
    await pool.query(
      `UPDATE solicitudes SET estado = 'cancelada', updatedat = NOW()
       WHERE id = $1 AND cliente_id = $2`,
      [id, cliente_id]
    );

    // 📋 Trazabilidad
    await registrarEvento({
      usuario_id: cliente_id,
      tipo: 'solicitud_cancelada',
      descripcion: `Solicitud #${id} cancelada`,
      datos: { solicitud_id: id }
    });
  },

  // ── POSTULARSE (trabajador) ──────────────────────────
  async aplicar(solicitud_id, trabajador_id, mensaje, precio_oferta, disponibilidad) {
    const existente = await pool.query(
      'SELECT id, estado FROM postulaciones WHERE solicitud_id=$1 AND trabajador_id=$2',
      [solicitud_id, trabajador_id]
    );

    let result;
    if (existente.rows.length > 0) {
      if (['cancelado', 'rechazado'].includes(existente.rows[0].estado)) {
        const res = await pool.query(
          `UPDATE postulaciones SET estado='pendiente', mensaje=$1, precio_oferta=$2, disponibilidad=$3, createdat=NOW()
           WHERE solicitud_id=$4 AND trabajador_id=$5 RETURNING *`,
          [mensaje || null, precio_oferta || null, disponibilidad || null, solicitud_id, trabajador_id]
        );
        result = res.rows[0];
      } else {
        throw new Error('Ya te has postulado a esta solicitud.');
      }
    } else {
      const res = await pool.query(
        `INSERT INTO postulaciones (solicitud_id, trabajador_id, mensaje, precio_oferta, disponibilidad)
         VALUES ($1,$2,$3,$4,$5) RETURNING *`,
        [solicitud_id, trabajador_id, mensaje || null, precio_oferta || null, disponibilidad || null]
      );
      result = res.rows[0];
    }

    // 📋 Trazabilidad
    await registrarEvento({
      usuario_id: trabajador_id,
      tipo: 'postulacion_enviada',
      descripcion: `Trabajador se postuló a solicitud #${solicitud_id}`,
      datos: { solicitud_id, postulacion_id: result.id }
    });

    return result;
  },

  // ── CANCELAR POSTULACIÓN (trabajador) ────────────────
  async cancelarPostulacion(solicitud_id, trabajador_id) {
    await pool.query(
      `UPDATE postulaciones SET estado = 'cancelado' WHERE solicitud_id = $1 AND trabajador_id = $2`,
      [solicitud_id, trabajador_id]
    );
  },

  // ── LISTAR POSTULACIONES (RNF2: ocultar teléfono hasta confirmación) ───
  async listarPostulaciones(solicitud_id) {
    // Verificar estado de la solicitud para aplicar privacidad
    const solRes = await pool.query('SELECT estado FROM solicitudes WHERE id = $1', [solicitud_id]);
    const estadoSolicitud = solRes.rows[0]?.estado;

    // 🛡️ RNF2: Solo mostrar teléfono si la solicitud está confirmada, en curso o finalizada
    const mostrarContacto = ['confirmada', 'en_curso', 'finalizado'].includes(estadoSolicitud);

    const res = await pool.query(
      `SELECT p.*,
              u.nombre,
              u.apellido,
              u.foto_url,
              ${mostrarContacto ? 'u.telefono,' : "'[oculto hasta confirmar]' AS telefono,"}
              pf.titulo as perfil_titulo,
              pf.rating_promedio
       FROM postulaciones p
       JOIN usuarios u ON p.trabajador_id = u.id
       LEFT JOIN perfiles_trabajador pf ON pf.usuario_id = u.id
       WHERE p.solicitud_id = $1
       ORDER BY p.createdat DESC`,
      [solicitud_id]
    );
    return res.rows;
  },

  // ── GESTIONAR POSTULACIÓN (aceptar/rechazar) ────────
  async gestionarPostulacion(postulacion_id, estado) {
    const res = await pool.query(
      `UPDATE postulaciones SET estado = $1 WHERE id = $2 RETURNING *`,
      [estado, postulacion_id]
    );
    if (res.rows.length === 0) throw new Error('Postulación no encontrada.');

    // 📋 Trazabilidad
    await registrarEvento({
      usuario_id: res.rows[0].trabajador_id,
      tipo: `postulacion_${estado}`,
      descripcion: `Postulación #${postulacion_id} ${estado}`,
      datos: { postulacion_id, solicitud_id: res.rows[0].solicitud_id }
    });

    return res.rows[0];
  },

  // ── INICIAR TRABAJO (trabajador) ─────────────────────
  async iniciarTrabajo(id, trabajador_id) {
    const res = await pool.query(
      `UPDATE solicitudes 
       SET estado = 'en_curso', updatedat = NOW()
       WHERE id = $1 AND estado = 'confirmada' AND trabajador_id = $2
       RETURNING *`,
      [id, trabajador_id]
    );
    if (res.rows.length === 0) throw new Error('No se puede iniciar el trabajo. Estado inválido o no eres el trabajador asignado.');

    // 📋 Trazabilidad
    await registrarEvento({
      usuario_id: trabajador_id,
      tipo: 'trabajo_iniciado',
      descripcion: `Trabajo iniciado en solicitud #${id}`,
      datos: { solicitud_id: id }
    });

    return res.rows[0];
  },

  // ── FINALIZAR TRABAJO (trabajador) ───────────────────
  async finalizarTrabajo(id, trabajador_id) {
    const res = await pool.query(
      `UPDATE solicitudes 
       SET estado = 'finalizado', updatedat = NOW()
       WHERE id = $1 AND estado = 'en_curso' AND trabajador_id = $2
       RETURNING *`,
      [id, trabajador_id]
    );
    if (res.rows.length === 0) throw new Error('No se puede finalizar. El trabajo no está en curso o no eres el responsable.');

    // 📋 Trazabilidad
    await registrarEvento({
      usuario_id: trabajador_id,
      tipo: 'trabajo_finalizado',
      descripcion: `Trabajo finalizado en solicitud #${id}`,
      datos: { solicitud_id: id }
    });

    return res.rows[0];
  }
};

// ── HELPER: registrar evento de trazabilidad ──────────
async function registrarEvento({ usuario_id, tipo, descripcion, datos = {} }) {
  try {
    await pool.query(
      `INSERT INTO eventos_log (usuario_id, tipo, descripcion, datos)
       VALUES ($1, $2, $3, $4)`,
      [usuario_id, tipo, descripcion, JSON.stringify(datos)]
    );
  } catch(e) {
    // No interrumpir el flujo principal si falla el log
    console.error('Error al registrar evento:', e.message);
  }
}

module.exports = SolicitudModel;