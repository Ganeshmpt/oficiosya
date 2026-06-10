const express    = require('express');
const router     = express.Router();
const ctrl       = require('../controllers/auth.controller');
const { verificarToken } = require('../middlewares/auth.middleware');
const rateLimit  = require('express-rate-limit');

// Límite para login y acciones sensibles como cambiar contraseña
const loginLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 15, 
  message: { error: 'Demasiados intentos. Espera 15 minutos.' }
});

// Rutas Públicas
router.post('/register',            ctrl.registrar);
router.post('/login',                loginLimit, ctrl.login);
router.post('/google',               ctrl.loginGoogle); // ← NUEVA RUTA
router.post('/forgot-password',       ctrl.olvidoPassword);
router.post('/reset-password',        ctrl.resetPassword);
router.get ('/verify-email',          ctrl.verificarEmail);

// Ruta para reenviar verificación (pública, usa el email del body)
router.post('/resend-verification',   ctrl.reenviarVerificacion); 

// Rutas Protegidas (requieren token de sesión activo)
router.post('/change-password',       verificarToken, loginLimit, ctrl.cambiarPassword);

module.exports = router;