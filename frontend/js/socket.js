// ============================================================
// socket.js — Cliente Socket.io para OficiosYA
// ============================================================

const SOCKET_URL = 'https://oficiosya-backend.onrender.com';
let socket = null;

function iniciarSocket() {
  const s = getSession();
  if (!s?.token || socket?.connected) return;

  socket = io(SOCKET_URL, {
    auth: { token: s.token },
    transports: ['websocket']
  });

  socket.on('connect', () => {
    console.log('Socket conectado');
  });

  socket.on('disconnect', () => {
    console.log('Socket desconectado');
  });

  // Nuevo mensaje recibido
  socket.on('nuevo_mensaje', (mensaje) => {
    if (typeof onNuevoMensaje === 'function') onNuevoMensaje(mensaje);
    mostrarToastMensaje(mensaje);
    actualizarContadorMensajes();
    
    // Si estamos en el dashboard, refrescar de inmediato las métricas dinámicas
    if (typeof cargarConteoMensajes === 'function') cargarConteoMensajes();
  });

  // Mensaje enviado confirmado
  socket.on('mensaje_enviado', (mensaje) => {
    if (typeof onMensajeEnviado === 'function') onMensajeEnviado(mensaje);
  });

  // Nueva notificación (CORREGIDO: Soporte unificado para dashboard y chat)
  socket.on('nueva_notificacion', (notif) => {
    if (typeof onNuevaNotificacion === 'function') onNuevaNotificacion(notif);
    else if (typeof cargarNotificaciones === 'function') cargarNotificaciones();
    
    mostrarToastNotificacion(notif);
    actualizarContadorNotificaciones();
  });

  // Usuario escribiendo
  socket.on('usuario_escribiendo', ({ nombre }) => {
    const el = document.getElementById('typing-indicator');
    if (el) {
      el.textContent = `${nombre} está escribiendo...`;
      el.style.display = 'block';
      clearTimeout(el._timeout);
      el._timeout = setTimeout(() => { el.style.display = 'none'; }, 2000);
    }
  });

  // Mensajes leídos
  socket.on('mensajes_leidos', () => {
    document.querySelectorAll('.msg-status').forEach(el => {
      el.textContent = 'Leído';
      el.style.color = '#1D9E75';
    });
  });

  socket.on('connect_error', (e) => {
    console.warn('Socket error:', e.message);
  });
}

function enviarMensajeSocket(receptor_id, contenido, solicitud_id = null) {
  if (!socket?.connected) return false;
  socket.emit('enviar_mensaje', { receptor_id, contenido, solicitud_id });
  return true;
}

function emitirEscribiendo(receptor_id) {
  if (!socket?.connected) return;
  socket.emit('escribiendo', { receptor_id });
}

function marcarLeidosSocket(emisor_id) {
  if (!socket?.connected) return;
  socket.emit('marcar_leidos', { emisor_id });
}

// ── Toast de mensaje ──────────────────────────────────
function mostrarToastMensaje(mensaje) {
  const toast = document.createElement('div');
  toast.style.cssText = `
    position:fixed; bottom:24px; right:24px; background:#1D9E75; color:#fff;
    padding:14px 20px; border-radius:12px; font-size:13px; font-weight:600;
    box-shadow:0 4px 16px rgba(0,0,0,.2); z-index:9999; cursor:pointer;
    max-width:300px; animation:slideIn .3s ease;
  `;
  toast.innerHTML = `
    <div style="font-size:11px;opacity:.8;margin-bottom:3px;">Nuevo mensaje</div>
    <div>${mensaje.emisor_nombre || 'Usuario'}: ${(mensaje.contenido||'').substring(0,60)}</div>
  `;
  toast.onclick = () => {
    window.location.href = `chat.html?with=${mensaje.emisor_id}`;
  };
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 5000);
}

// ── Toast de notificación ─────────────────────────────
function mostrarToastNotificacion(notif) {
  if (notif.tipo === 'mensaje') return; // ya lo maneja mostrarToastMensaje
  const toast = document.createElement('div');
  toast.style.cssText = `
    position:fixed; bottom:24px; right:24px; background:#534AB7; color:#fff;
    padding:14px 20px; border-radius:12px; font-size:13px; font-weight:600;
    box-shadow:0 4px 16px rgba(0,0,0,.2); z-index:9999; max-width:300px;
    animation:slideIn .3s ease;
  `;
  toast.innerHTML = `
    <div style="font-size:11px;opacity:.8;margin-bottom:3px;">${notif.titulo}</div>
    <div>${(notif.mensaje||'').substring(0,80)}</div>
  `;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 5000);
}

// ── Actualizar contadores en navbar ───────────────────
async function actualizarContadorMensajes() {
  try {
    const data = await apiFetch('/chat/conversaciones');
    const total = data.conversaciones.reduce((sum, c) => sum + (parseInt(c.no_leidos) || 0), 0);
    
    // BUG FIX: Sincronizar ID clásico de la vista chat
    const badgeMensajes = document.getElementById('badge-mensajes');
    if (badgeMensajes) {
      badgeMensajes.textContent = total || '';
      badgeMensajes.style.display = total > 0 ? 'flex' : 'none';
    }
    
    // BUG FIX: Sincronizar ID de la vista dashboard y navegaciones unificadas
    const navChatBadge = document.getElementById('nav-chat-badge');
    if (navChatBadge) {
      navChatBadge.textContent = total > 9 ? '9+' : total;
      navChatBadge.style.display = total > 0 ? 'inline-block' : 'none';
    }
  } catch(e) {}
}

async function actualizarContadorNotificaciones() {
  try {
    const data = await apiFetch('/chat/notificaciones');
    const total = data.notificaciones.filter(n => !n.leida).length;
    
    // BUG FIX: Sincronizar ID clásico de la vista chat
    const badgeNotif = document.getElementById('badge-notificaciones');
    if (badgeNotif) {
      badgeNotif.textContent = total || '';
      badgeNotif.style.display = total > 0 ? 'flex' : 'none';
    }
    
    // BUG FIX: Sincronizar ID de la campana del dashboard
    const notifBadgeDash = document.getElementById('notif-badge');
    if (notifBadgeDash) {
      notifBadgeDash.textContent = total > 9 ? '9+' : total;
      notifBadgeDash.style.display = total > 0 ? 'block' : 'none';
    }
  } catch(e) {}
}

// Iniciar automáticamente si hay sesión
document.addEventListener('DOMContentLoaded', () => {
  if (getSession()) {
    iniciarSocket();
    actualizarContadorMensajes();
    actualizarContadorNotificaciones();
  }
});