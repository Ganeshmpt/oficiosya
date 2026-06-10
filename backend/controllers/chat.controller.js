const ChatModel         = require('../models/chat.model');
const NotificacionModel = require('../models/notificacion.model');

const ChatController = {

  async enviar(req, res) {
    try {
      const { receptor_id, contenido, solicitud_id } = req.body;
      if (!receptor_id || !contenido?.trim())
        return res.status(400).json({ error: 'Receptor y contenido son obligatorios.' });

      const mensaje = await ChatModel.enviarMensaje({
        emisor_id:   req.usuario.id,
        receptor_id: parseInt(receptor_id),
        solicitud_id: solicitud_id || null,
        contenido:   contenido.trim()
      });

      // Crear notificación para el receptor
      const notif = await NotificacionModel.crear({
        usuario_id: parseInt(receptor_id),
        tipo:       'mensaje',
        titulo:     `Nuevo mensaje de ${req.usuario.nombre}`,
        mensaje:    contenido.trim().substring(0, 100),
        datos:      { emisor_id: req.usuario.id, mensaje_id: mensaje.id }
      });

      // Emitir por Socket.io si está disponible
      const io = req.app.get('io');
      if (io) {
        io.to(`user_${receptor_id}`).emit('nuevo_mensaje', mensaje);
        io.to(`user_${receptor_id}`).emit('nueva_notificacion', notif);
      }

      return res.status(201).json({ mensaje });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Error al enviar mensaje.' });
    }
  },

  async conversacion(req, res) {
    try {
      const { userId } = req.params;
      const mensajes = await ChatModel.obtenerConversacion(req.usuario.id, parseInt(userId));
      // Marcar como leídos
      await ChatModel.marcarLeidos(parseInt(userId), req.usuario.id);
      return res.json({ mensajes });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Error al obtener conversacion.' });
    }
  },

  async misConversaciones(req, res) {
    try {
      const conversaciones = await ChatModel.misConversaciones(req.usuario.id);
      return res.json({ conversaciones });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Error al obtener conversaciones.' });
    }
  },

  async notificaciones(req, res) {
    try {
      const notificaciones = await NotificacionModel.listar(req.usuario.id);
      return res.json({ notificaciones });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Error al obtener notificaciones.' });
    }
  },

  async marcarNotifLeida(req, res) {
    try {
      await NotificacionModel.marcarLeida(req.params.id, req.usuario.id);
      return res.json({ mensaje: 'Notificacion marcada como leida.' });
    } catch (err) {
      return res.status(500).json({ error: 'Error.' });
    }
  },

  async marcarTodasLeidas(req, res) {
    try {
      await NotificacionModel.marcarTodasLeidas(req.usuario.id);
      return res.json({ mensaje: 'Todas las notificaciones marcadas como leidas.' });
    } catch (err) {
      return res.status(500).json({ error: 'Error.' });
    }
  }
};

module.exports = ChatController;