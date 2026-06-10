const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
  service: process.env.MAIL_SERVICE || 'gmail',
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
});

// ── Verificar conexión al iniciar ─────────────────────
transporter.verify((err) => {
  if (err) console.warn('⚠️  Email no configurado:', err.message);
  else     console.log('📧 Servicio de email listo.');
});

// ── Template base ─────────────────────────────────────
function htmlBase(titulo, contenido) {
  return `
  <!DOCTYPE html>
  <html>
  <head><meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; background:#F3F4F6; margin:0; padding:20px; }
    .card { background:#fff; max-width:500px; margin:0 auto; border-radius:12px; overflow:hidden; }
    .header { background:#1D9E75; padding:28px; text-align:center; }
    .header h1 { color:#fff; font-size:22px; margin:0; }
    .header span { color:#C8860A; }
    .body { padding:28px; color:#374151; }
    .body h2 { color:#111827; font-size:18px; margin-top:0; }
    .body p { line-height:1.6; font-size:14px; }
    .btn { display:inline-block; background:#1D9E75; color:#fff; padding:13px 28px;
           border-radius:8px; text-decoration:none; font-weight:700; font-size:15px;
           margin:16px 0; }
    .code { background:#F3F4F6; border:2px dashed #D1D5DB; border-radius:8px;
            padding:16px; text-align:center; font-size:28px; font-weight:800;
            letter-spacing:8px; color:#111827; margin:16px 0; }
    .footer { text-align:center; padding:16px; color:#9CA3AF; font-size:12px; }
    .warn { color:#9CA3AF; font-size:12px; margin-top:16px; }
  </style>
  </head>
  <body>
    <div class="card">
      <div class="header">
        <h1>Oficios<span>YA</span></h1>
      </div>
      <div class="body">
        <h2>${titulo}</h2>
        ${contenido}
      </div>
      <div class="footer">© 2026 OficiosYA — Universidad Técnica de Ambato</div>
    </div>
  </body>
  </html>`;
}

// ── Email: recuperar contraseña ───────────────────────
async function enviarRecuperacion({ email, nombre, token, resetUrl }) {
  const html = htmlBase('Recupera tu contraseña', `
    <p>Hola <strong>${nombre}</strong>,</p>
    <p>Recibimos una solicitud para restablecer la contraseña de tu cuenta.</p>
    <p style="text-align:center;">
      <a href="${resetUrl}" class="btn">Restablecer contraseña</a>
    </p>
    <p class="warn">Este enlace expira en <strong>1 hora</strong>. Si no solicitaste esto, ignora este correo.</p>
    <p class="warn">O copia este enlace en tu navegador:<br>${resetUrl}</p>
  `);

  await transporter.sendMail({
    from:    process.env.MAIL_FROM || 'OficiosYA <noreply@oficiosya.com>',
    to:      email,
    subject: '🔑 Recupera tu contraseña — OficiosYA',
    html,
  });
}

// ── Email: bienvenida / verificar email ───────────────
async function enviarBienvenida({ email, nombre, verifyUrl }) {
  const html = htmlBase('¡Bienvenido a OficiosYA!', `
    <p>Hola <strong>${nombre}</strong>, ¡nos alegra tenerte!</p>
    <p>Verifica tu correo electrónico para activar tu cuenta:</p>
    <p style="text-align:center;">
      <a href="${verifyUrl}" class="btn">Verificar mi cuenta</a>
    </p>
    <p class="warn">Este enlace expira en 24 horas.</p>
  `);

  await transporter.sendMail({
    from:    process.env.MAIL_FROM || 'OficiosYA <noreply@oficiosya.com>',
    to:      email,
    subject: '✅ Verifica tu cuenta — OficiosYA',
    html,
  });
}
// ── Email: resolución de reporte ──────────────────────
async function enviarResolucionReporte({ email, nombre, motivo, estado, accion }) {
  const esResuelto = estado === 'resuelto';
  const html = htmlBase(
    esResuelto ? '✅ Tu reporte fue resuelto' : 'Tu reporte fue revisado',
    `
    <p>Hola <strong>${nombre}</strong>,</p>
    <p>Te informamos que el reporte que enviaste ha sido revisado por nuestro equipo.</p>
    <div style="background:#F9FAFB;border:1px solid #E5E7EB;border-radius:8px;padding:16px;margin:16px 0;">
      <p style="margin:0 0 8px 0;font-size:13px;color:#6B7280;font-weight:600;">MOTIVO DE TU REPORTE</p>
      <p style="margin:0;font-size:14px;color:#374151;">${motivo}</p>
    </div>
    <div style="background:${esResuelto ? '#F0FDF4' : '#FEF2F2'};border:1px solid ${esResuelto ? '#BBF7D0' : '#FECACA'};border-radius:8px;padding:16px;margin:16px 0;">
      <p style="margin:0 0 8px 0;font-size:13px;color:#6B7280;font-weight:600;">RESULTADO</p>
      <p style="margin:0;font-size:14px;color:${esResuelto ? '#166534' : '#991B1B'};">${accion}</p>
    </div>
    <p class="warn">Gracias por ayudarnos a mantener una comunidad segura.</p>
  `);

  await transporter.sendMail({
    from:    process.env.MAIL_FROM || 'OficiosYA <noreply@oficiosya.com>',
    to:      email,
    subject: `${esResuelto ? '✅' : '📋'} Tu reporte fue ${estado} — OficiosYA`,
    html,
  });
}

module.exports = { enviarRecuperacion, enviarBienvenida, enviarResolucionReporte };
