const bcrypt       = require('bcryptjs');
const jwt          = require('jsonwebtoken');
const crypto       = require('crypto');
const { OAuth2Client } = require('google-auth-library'); // ← NUEVO
const UsuarioModel = require('../models/usuario.model');
const { enviarRecuperacion, enviarBienvenida } = require('../utils/email');
require('dotenv').config();

const JWT_SECRET  = process.env.JWT_SECRET  || 'oficiosya_secreto_2026';
const JWT_EXPIRES = process.env.JWT_EXPIRES || '7d';
const FRONTEND = process.env.FRONTEND_URL || 'http://localhost:5500/frontend';

function generarToken(usuario) {
  return jwt.sign(
    {
      id:       usuario.id,
      email:    usuario.email,
      is_admin: usuario.is_admin || false
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES }
  );
}

const AuthService = {

  // ── REGISTRO ─────────────────────────────────────────
  async registrar({ nombre, apellido, email, telefono, zona, password }) {
    const existe = await UsuarioModel.findByEmail(email);
    if (existe) throw new Error('Ya existe una cuenta con ese correo electrónico.');

    const password_hash = await bcrypt.hash(password, 12);
    const email_token   = crypto.randomBytes(32).toString('hex');

    const usuario = await UsuarioModel.create({
      nombre, apellido, email, password_hash, telefono, zona, email_token
    });

    try {
      const verifyUrl = `${FRONTEND}/pages/verificar-email.html?token=${email_token}&id=${usuario.id}`;
      await enviarBienvenida({ email, nombre, verifyUrl });
    } catch (e) {
      console.warn('⚠ Email bienvenida no enviado:', e.message);
    }

    const token = generarToken(usuario);
    return { usuario: UsuarioModel.sanitize(usuario), token };
  },

  // ── LOGIN ─────────────────────────────────────────────
  async login({ email, password }) {
    const usuario = await UsuarioModel.findByEmail(email);
    if (!usuario)           throw new Error('Correo o contraseña incorrectos.');
    if (!usuario.activo)    throw new Error('Cuenta inactiva. Contacta al administrador.');
    if (usuario.bloqueado)  throw new Error('Tu cuenta ha sido bloqueada.');
    if (usuario.suspendido) throw new Error('Tu cuenta está suspendida temporalmente.');

    const match = await bcrypt.compare(password, usuario.password_hash);
    if (!match) throw new Error('Correo o contraseña incorrectos.');

    const token = generarToken(usuario);
    return { usuario: UsuarioModel.sanitize(usuario), token };
  },

  // ── SOLICITAR RECUPERACIÓN ────────────────────────────
  async solicitarRecuperacion({ email }) {
    const usuario = await UsuarioModel.findByEmail(email);
    if (!usuario) return { mensaje: 'Si el correo existe, recibirás un enlace.' };

    const token  = crypto.randomBytes(32).toString('hex');
    const expiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hora

    await UsuarioModel.setResetToken(usuario.id, token, expiry);

    try {
      const resetUrl = `${FRONTEND}/pages/nueva-password.html?token=${token}`;
      await enviarRecuperacion({ email, nombre: usuario.nombre, token, resetUrl });
    } catch (e) {
      console.warn('⚠ Email recuperación no enviado:', e.message);
    }

    return { mensaje: 'Si el correo existe, recibirás un enlace para restablecer tu contraseña.' };
  },

  // ── RESTABLECER CONTRASEÑA ────────────────────────────
  async restablecerPassword({ token, nuevaPassword }) {
    const usuario = await UsuarioModel.findByResetToken(token);
    if (!usuario) throw new Error('El enlace es inválido o ha expirado. Solicita uno nuevo.');
    if (nuevaPassword.length < 8) throw new Error('La contraseña debe tener al menos 8 caracteres.');

    const hash = await bcrypt.hash(nuevaPassword, 12);
    await UsuarioModel.updatePassword(usuario.id, hash);
    return { mensaje: 'Contraseña actualizada correctamente. Ya puedes iniciar sesión.' };
  },

  // ── VERIFICAR EMAIL ───────────────────────────────────
  async verificarEmail({ token, id }) {
    if (!token || !id) throw new Error('Datos de verificación incompletos.');
    const usuario = await UsuarioModel.findById(parseInt(id));
    if (!usuario) throw new Error('Usuario no encontrado.');
    if (usuario.email_verificado) return { mensaje: 'El correo ya fue verificado anteriormente.' };
    if (usuario.email_token !== token) throw new Error('Enlace de verificación inválido o expirado.');
    await UsuarioModel.verificarEmail(usuario.id);
    return { mensaje: 'Email verificado correctamente. ¡Bienvenido a OficiosYA!' };
  },

  // ── CAMBIAR CONTRASEÑA (autenticado) ──────────────────
  async cambiarPassword({ userId, passwordActual, nuevaPassword }) {
    // 1. Buscar al usuario en la base de datos
    const usuario = await UsuarioModel.findById(userId);
    if (!usuario) throw new Error('Usuario no encontrado.');

    // 2. Comparar la contraseña actual proporcionada con el hash de la BD
    const match = await bcrypt.compare(passwordActual, usuario.password_hash);
    if (!match) throw new Error('La contraseña actual es incorrecta.');

    // 3. Validar longitud de la nueva contraseña
    if (nuevaPassword.length < 8) {
      throw new Error('La nueva contraseña debe tener al menos 8 caracteres.');
    }

    // 4. Generar el nuevo hash con 12 rondas de sal (estándar del proyecto)
    const hash = await bcrypt.hash(nuevaPassword, 12);

    // 5. Actualizar en la base de datos
    await UsuarioModel.updatePassword(usuario.id, hash);

    return { mensaje: 'Contraseña actualizada correctamente.' };
  },

  // ── LOGIN CON GOOGLE ──────────────────────────────────
  async loginGoogle(credential) {
    const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    const email = payload.email;
    const nombre = payload.given_name || '';
    const apellido = payload.family_name || '';

    let usuario = await UsuarioModel.findByEmail(email);
    if (!usuario) {
      // Crear un nuevo usuario con datos de Google (sin contraseña, email verificado)
      usuario = await UsuarioModel.create({
        nombre,
        apellido,
        email,
        password_hash: null,
        email_verificado: true,
        activo: true
      });
    }

    const token = generarToken(usuario);
    return { usuario: UsuarioModel.sanitize(usuario), token };
  }
};

module.exports = AuthService;