require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const http    = require('http');
const { Server } = require('socket.io');

const app    = express();
const server = http.createServer(app);

// FIX: trust proxy para Render + rate limit
app.set('trust proxy', 1);

const io = new Server(server, {
  cors: { origin: '*', methods: ['GET','POST'] }
});

const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: [
    'http://localhost:5500',
    'http://127.0.0.1:5500',
    'https://ganeshmpt.github.io'
  ],
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// Pasar io a las rutas que lo necesiten
app.set('io', io);

// ── Rutas API ─────────────────────────────────────────
app.use('/api/auth',           require('./routes/auth.routes'));
app.use('/api/solicitudes',    require('./routes/solicitud.routes'));
app.use('/api/perfil',         require('./routes/perfil.routes'));
app.use('/api/trabajos',       require('./routes/trabajo.routes'));
app.use('/api/stats',          require('./routes/stats.routes'));
app.use('/api/trabajadores',   require('./routes/trabajador.routes'));
app.use('/api/calificaciones', require('./routes/calificacion.routes'));
app.use('/api/admin',          require('./routes/admin.routes'));
app.use('/api/reportes',       require('./routes/reportes.routes'));
app.use('/api/chat',           require('./routes/chat.routes'));
app.use('/api/notificaciones', require('./routes/notificacion.routes'));

// ── Health check ──────────────────────────────────────
app.get('/api', (req, res) => {
  res.json({ ok: true, mensaje: 'API OficiosYA v1.0', timestamp: new Date() });
});

// ── Socket.io ─────────────────────────────────────────
require('./sockets/index')(io);

// ── 404 ───────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ error: 'Ruta no encontrada.' }));

// ── Error global ──────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Error interno del servidor.' });
});

// ── Iniciar con server (no app) para Socket.io ────────
server.listen(PORT, () => {
  console.log(`\n🚀 OficiosYA API corriendo en http://localhost:${PORT}`);
  console.log(`💬 Socket.io activo`);
  console.log(`\n📋 Endpoints activos:`);
  console.log(`   POST /api/auth/register`);
  console.log(`   POST /api/auth/login`);
  console.log(`   GET  /api/solicitudes/abiertas`);
  console.log(`   GET  /api/trabajadores`);
  console.log(`   GET  /api/chat/conversacion/:userId`);
  console.log(`   POST /api/chat/enviar\n`);
});