const UsuarioModel = require('../models/usuario.model');
const { cloudinary, uploadPerfil } = require('../config/cloudinary');
const pool = require('../config/db');

const PerfilController = {

  // GET /api/perfil/me
  async miPerfil(req, res) {
    try {
      const usuario = await UsuarioModel.findById(req.usuario.id);
      return res.json({ usuario: UsuarioModel.sanitize(usuario) });
    } catch (err) {
      return res.status(500).json({ error: 'Error al obtener perfil.' });
    }
  },

  // PUT /api/perfil/datos
  async actualizarDatos(req, res) {
    try {
      const { nombre, apellido, telefono, zona } = req.body;
      if (!nombre) return res.status(400).json({ error: 'El nombre es obligatorio.' });
      const usuario = await UsuarioModel.updatePerfil(req.usuario.id, { nombre, apellido, telefono, zona });
      return res.json({ mensaje: 'Perfil actualizado.', usuario: UsuarioModel.sanitize(usuario) });
    } catch (err) {
      return res.status(500).json({ error: 'Error al actualizar perfil.' });
    }
  },

  // PUT /api/perfil/foto
  async subirFoto(req, res) {
    try {
      if (!req.file) return res.status(400).json({ error: 'No se recibió ninguna imagen.' });
      const usuarioActual = await UsuarioModel.findById(req.usuario.id);
      if (usuarioActual.foto_public_id) {
        try { await cloudinary.uploader.destroy(usuarioActual.foto_public_id); } catch(e) {}
      }
      const usuario = await UsuarioModel.updateFoto(req.usuario.id, req.file.path, req.file.filename);
      return res.json({ mensaje: 'Foto actualizada.', foto_url: usuario.foto_url, usuario: UsuarioModel.sanitize(usuario) });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Error al subir la foto.' });
    }
  },

  // GET /api/perfil/profesional
  async miPerfilProfesional(req, res) {
    try {
      const res_ = await pool.query(
        `SELECT p.*, c.nombre as categoria_nombre
         FROM perfiles_trabajador p
         LEFT JOIN categorias c ON p.categoria_id = c.id
         WHERE p.usuario_id = $1`,
        [req.usuario.id]
      );
      return res.json({ perfil: res_.rows[0] || null });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Error al obtener perfil profesional.' });
    }
  },

  // PUT /api/perfil/profesional
  async actualizarPerfilProfesional(req, res) {
    try {
      const { titulo, descripcion, anos_experiencia, precio_desde, categoria_id, disponible } = req.body;
      await pool.query('UPDATE usuarios SET es_trabajador = TRUE WHERE id = $1', [req.usuario.id]);
      const result = await pool.query(
        `INSERT INTO perfiles_trabajador (usuario_id, titulo, descripcion, anos_experiencia, precio_desde, categoria_id, disponible)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (usuario_id) DO UPDATE SET
           titulo           = EXCLUDED.titulo,
           descripcion      = EXCLUDED.descripcion,
           anos_experiencia = EXCLUDED.anos_experiencia,
           precio_desde     = EXCLUDED.precio_desde,
           categoria_id     = EXCLUDED.categoria_id,
           disponible       = EXCLUDED.disponible
         RETURNING *`,
        [req.usuario.id, titulo || '', descripcion || '', anos_experiencia || 0, precio_desde || null, categoria_id || null, disponible !== false]
      );
      return res.json({ mensaje: 'Perfil profesional actualizado.', perfil: result.rows[0] });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Error al actualizar perfil profesional.' });
    }
  },

  // POST /api/perfil/verificacion
  async subirVerificacion(req, res) {
    try {
      if (!req.file) return res.status(400).json({ error: 'No se recibió ningún documento.' });
      const result = await pool.query(
        `INSERT INTO verificaciones (usuario_id, doc_url, doc_public_id, estado)
         VALUES ($1, $2, $3, 'pendiente') RETURNING *`,
        [req.usuario.id, req.file.path, req.file.filename]
      );
      return res.status(201).json({ mensaje: 'Documento enviado para revisión.', verificacion: result.rows[0] });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Error al subir el documento.' });
    }
  },

  // GET /api/perfil/verificaciones
  async misVerificaciones(req, res) {
    try {
      const result = await pool.query(
        `SELECT id, doc_url, estado, motivo_rechazo, createdat
         FROM verificaciones WHERE usuario_id = $1 ORDER BY createdat DESC`,
        [req.usuario.id]
      );
      return res.json({ verificaciones: result.rows });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Error al obtener verificaciones.' });
    }
  },

  // GET /api/perfil/usuario/:id
  async perfilUsuario(req, res) {
    const { id } = req.params;
    try {
      const usuarioRes = await pool.query('SELECT * FROM usuarios WHERE id = $1', [id]);
      const usuario = usuarioRes.rows[0];
      if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado.' });
      return res.json({ usuario: UsuarioModel.sanitize(usuario) });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Error al cargar el usuario.' });
    }
  },

  // GET /api/perfil/trabajador/:id — PÚBLICO con reputación completa
  async perfilPublico(req, res) {
    const { id } = req.params;
    try {
      const usuarioRes = await pool.query('SELECT * FROM usuarios WHERE id = $1', [id]);
      const usuario = usuarioRes.rows[0];
      if (!usuario || !usuario.es_trabajador)
        return res.status(404).json({ error: 'Trabajador no encontrado.' });

      // Perfil profesional con categoría
      const perfilRes = await pool.query(
        `SELECT p.*, c.nombre as categoria_nombre
         FROM perfiles_trabajador p
         LEFT JOIN categorias c ON p.categoria_id = c.id
         WHERE p.usuario_id = $1`,
        [id]
      );
      const perfil = perfilRes.rows[0] || null;

      // ✅ REPUTACIÓN COMPLETA: promedio de calificaciones + servicios completados
      const reputacionRes = await pool.query(
        `SELECT
           ROUND(AVG(c.puntaje)::numeric, 1)  AS rating_promedio,
           COUNT(c.id)                         AS total_calificaciones,
           (SELECT COUNT(*) FROM solicitudes
            WHERE trabajador_id = $1 AND estado = 'finalizado') AS servicios_completados
         FROM calificaciones c
         WHERE c.calificado_id = $1`,
        [id]
      );
      const reputacion = reputacionRes.rows[0];

      // ✅ Reseñas recientes (máximo 5)
      const reseñasRes = await pool.query(
        `SELECT c.puntaje, c.comentario, c.createdat,
                u.nombre AS autor_nombre, u.foto_url AS autor_foto
         FROM calificaciones c
         JOIN usuarios u ON c.calificador_id = u.id
         WHERE c.calificado_id = $1 AND c.tipo = 'cliente_a_trabajador'
         ORDER BY c.createdat DESC
         LIMIT 5`,
        [id]
      );
      const reseñas = reseñasRes.rows;

      // Trabajos realizados
      const trabajosRes = await pool.query(
        'SELECT * FROM trabajos_realizados WHERE trabajador_id = $1 ORDER BY createdat DESC',
        [id]
      );

      // Documentos verificados
      const verificacionesRes = await pool.query(
        "SELECT id, doc_url, estado, createdat FROM verificaciones WHERE usuario_id = $1 AND estado = 'aprobada'",
        [id]
      );

      // Combinar perfil con reputación
      const perfilConReputacion = perfil ? {
        ...perfil,
        rating_promedio:      parseFloat(reputacion.rating_promedio) || null,
        total_calificaciones: parseInt(reputacion.total_calificaciones) || 0,
        servicios_completados: parseInt(reputacion.servicios_completados) || 0,
        // total_servicios para compatibilidad con frontend anterior
        total_servicios:      parseInt(reputacion.servicios_completados) || 0,
      } : null;

      return res.json({
        usuario:        UsuarioModel.sanitize(usuario),
        perfil:         perfilConReputacion,
        trabajos:       trabajosRes.rows,
        verificaciones: verificacionesRes.rows,
        reseñas,
        reputacion: {
          rating_promedio:      parseFloat(reputacion.rating_promedio) || null,
          total_calificaciones: parseInt(reputacion.total_calificaciones) || 0,
          servicios_completados: parseInt(reputacion.servicios_completados) || 0,
        }
      });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Error al cargar el perfil del trabajador.' });
    }
  }
};

module.exports = PerfilController;