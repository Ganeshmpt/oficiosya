const jwt = require('jsonwebtoken');
const ChatModel = require('../models/chat.model');

const JWT_SECRET = process.env.JWT_SECRET || 'oficiosya_secreto_2026';

module.exports = function(io) {

  // Autenticar socket con JWT
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Token requerido'));
    try {
      socket.usuario = jwt.verify(token, JWT_SECRET);
      next();
    } catch {
      next(new Error('Token invalido'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.usuario.id;
    console.log(`Socket conectado: usuario ${userId}`);

    // Unir al usuario a su sala personal
    socket.join(`user_${userId}`);

    // Evento: enviar mensaje por socket
    socket.on('enviar_mensaje', async ({ receptor_id, contenido, solicitud_id }) => {
      if (!receptor_id || !contenido?.trim()) return;
      try {
        const mensaje = await ChatModel.enviarMensaje({
          emisor_id:    userId,
          receptor_id:  parseInt(receptor_id),
          solicitud_id: solicitud_id || null,
          contenido:    contenido.trim()
        });
        // Emitir al receptor
        io.to(`user_${receptor_id}`).emit('nuevo_mensaje', mensaje);
        // Confirmar al emisor
        socket.emit('mensaje_enviado', mensaje);
      } catch(e) {
        socket.emit('error_mensaje', { error: e.message });
      }
    });

    // Evento: marcar mensajes como leídos
    socket.on('marcar_leidos', async ({ emisor_id }) => {
      await ChatModel.marcarLeidos(parseInt(emisor_id), userId).catch(() => {});
      io.to(`user_${emisor_id}`).emit('mensajes_leidos', { por: userId });
    });

    // Evento: escribiendo...
    socket.on('escribiendo', ({ receptor_id }) => {
      io.to(`user_${receptor_id}`).emit('usuario_escribiendo', {
        usuario_id: userId,
        nombre:     socket.usuario.nombre
      });
    });

    socket.on('disconnect', () => {
      console.log(`Socket desconectado: usuario ${userId}`);
    });
  });
};