const TrabajoModel = require('../models/trabajo.model');
const { cloudinary } = require('../config/cloudinary');

const TrabajoController = {
  // POST /api/trabajos — Subir una imagen de trabajo (trabajador autenticado)
  async subir(req, res) {
    try {
      if (!req.file) return res.status(400).json({ error: 'No se recibió ninguna imagen.' });

      const descripcion = req.body.descripcion || '';
      const trabajo = await TrabajoModel.crear(
        req.usuario.id,
        req.file.path,       // URL completa de Cloudinary
        req.file.filename,   // public_id
        descripcion
      );

      return res.status(201).json({ mensaje: 'Imagen subida correctamente.', trabajo });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Error al subir la imagen.' });
    }
  },

  // GET /api/trabajos/mios — Obtener mis trabajos (trabajador autenticado)
  async misTrabajos(req, res) {
    try {
      const trabajos = await TrabajoModel.listarPorTrabajador(req.usuario.id);
      return res.json({ trabajos });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Error al obtener los trabajos.' });
    }
  },

  // DELETE /api/trabajos/:id — Eliminar un trabajo (dueño)
  async eliminar(req, res) {
    try {
      await TrabajoModel.eliminar(req.params.id, req.usuario.id);
      return res.json({ mensaje: 'Trabajo eliminado correctamente.' });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Error al eliminar el trabajo.' });
    }
  }
};

module.exports = TrabajoController;