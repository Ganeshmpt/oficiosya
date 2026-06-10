const AuthService = require('../services/auth.service');
const UsuarioModel = require('../models/usuario.model');
const { enviarBienvenida } = require('../utils/email');
const crypto = require('crypto');
require('dotenv').config();

const FRONTEND = process.env.FRONTEND_URL || 'http://localhost:5500';

const AuthController = {

  async registrar(req, res) {
    try {
      const { nombre, apellido, email, telefono, zona, password, confirmarPassword } = req.body;
      if (!nombre || !email || !password)
        return res.status(400).json({ error: 'Nombre, email y contraseña son obligatorios.' });
      if (password !== confirmarPassword)
        return res.status(400).json({ error: 'Las contraseñas no coinciden.' });
      if (password.length < 8)
        return res.status(400).json({ error: 'La contraseña debe tener mínimo 8 caracteres.' });
      const data = await AuthService.registrar({ nombre, apellido, email, telefono, zona, password });
      return res.status(201).json({ mensaje: 'Cuenta creada exitosamente.', ...data });
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  },

  async login(req, res) {
    try {
      const { email, password } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({ error: 'Email y contraseña son obligatorios.' });
      }

      // 👇 NUEVA VALIDACIÓN: Revisar si el usuario está bloqueado 👇
      const usuario = await UsuarioModel.findByEmail(email);
      
      // Si el usuario existe y su estado es 'bloqueado', le negamos el acceso inmediatamente
      if (usuario && usuario.estado && usuario.estado.toLowerCase() === 'bloqueado') {
        return res.status(403).json({ 
            error: 'Tu cuenta ha sido suspendida o bloqueada por un administrador. Si crees que es un error, contáctanos.' 
        });
      }
      // 👆 FIN DE LA VALIDACIÓN 👆

      // Si todo está bien y no está bloqueado, procedemos con el login normal
      const data = await AuthService.login({ email, password });
      return res.json({ mensaje: 'Inicio de sesión exitoso.', ...data });
      
    } catch (err) {
      return res.status(401).json({ error: err.message });
    }
  },

  async olvidoPassword(req, res) {
    try {
      const { email } = req.body;
      if (!email) return res.status(400).json({ error: 'El email es obligatorio.' });
      const data = await AuthService.solicitarRecuperacion({ email });
      return res.json(data);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  },

  async resetPassword(req, res) {
    try {
      const { token, nuevaPassword, confirmarPassword } = req.body;
      if (!token || !nuevaPassword) return res.status(400).json({ error: 'Datos incompletos.' });
      if (nuevaPassword !== confirmarPassword)
        return res.status(400).json({ error: 'Las contraseñas no coinciden.' });
      const data = await AuthService.restablecerPassword({ token, nuevaPassword });
      return res.json(data);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  },

  async verificarEmail(req, res) {
    try {
      const { token, id } = req.query;
      const data = await AuthService.verificarEmail({ token, id });
      return res.json(data);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  },

  async cambiarPassword(req, res) {
    try {
      const { passwordActual, nuevaPassword, confirmarPassword } = req.body;

      if (!passwordActual || !nuevaPassword || !confirmarPassword) {
        return res.status(400).json({ error: 'Todos los campos son obligatorios.' });
      }

      if (nuevaPassword !== confirmarPassword) {
        return res.status(400).json({ error: 'La nueva contraseña y la confirmación no coinciden.' });
      }

      if (nuevaPassword.length < 8) {
        return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 8 caracteres.' });
      }

      const data = await AuthService.cambiarPassword({ 
        userId: req.usuario.id, 
        passwordActual, 
        nuevaPassword 
      });

      return res.json({ mensaje: 'Contraseña actualizada correctamente.', ...data });
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  },

  async reenviarVerificacion(req, res) {
    try {
      const { email } = req.body;
      if (!email) return res.status(400).json({ error: 'El email es obligatorio.' });

      const usuario = await UsuarioModel.findByEmail(email);

      if (!usuario || usuario.email_verificado) {
        return res.json({ mensaje: 'Si el correo existe y no está verificado, recibirás un enlace.' });
      }

      const email_token = crypto.randomBytes(32).toString('hex');
      await UsuarioModel.setEmailToken(usuario.id, email_token);

      const verifyUrl = `${FRONTEND}/pages/verificar-email.html?token=${email_token}&id=${usuario.id}`;
      await enviarBienvenida({ email: usuario.email, nombre: usuario.nombre, verifyUrl });

      return res.json({ mensaje: 'Si el correo existe y no está verificado, recibirás un enlace.' });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Error al reenviar el correo.' });
    }
  },

  // ── NUEVO: LOGIN CON GOOGLE ─────────────────────────
  async loginGoogle(req, res) {
    try {
      const { credential } = req.body;
      if (!credential) return res.status(400).json({ error: 'Token de Google requerido.' });
      
      const data = await AuthService.loginGoogle(credential);
      
      // Bloqueo de seguridad adicional: Si Google lo autenticó pero el usuario está bloqueado en BD
      if (data && data.usuario && data.usuario.estado && data.usuario.estado.toLowerCase() === 'bloqueado') {
        return res.status(403).json({ 
            error: 'Tu cuenta ha sido suspendida o bloqueada por un administrador.' 
        });
      }

      return res.json({ mensaje: 'Inicio de sesión con Google exitoso.', ...data });
    } catch (err) {
      return res.status(401).json({ error: err.message });
    }
  }
};

module.exports = AuthController;