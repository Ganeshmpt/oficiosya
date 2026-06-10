const jwt = require('jsonwebtoken');
const pool = require('../config/db'); // Importamos la conexión a la base de datos
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'oficiosya_secreto_2026';

// Hacemos la función asíncrona (async) para poder consultar la BD
async function verificarToken(req, res, next) {
  const auth  = req.headers['authorization'];
  const token = auth && auth.startsWith('Bearer ') ? auth.slice(7) : null;
  
  if (!token) return res.status(401).json({ error: 'Token requerido. Inicia sesión.' });
  
  try {
    // 1. Desciframos el token
    const payload = jwt.verify(token, JWT_SECRET);
    
    // 2. 🛡️ VERIFICACIÓN EN TIEMPO REAL 🛡️
    // Consultamos el estado actual del usuario directamente en la base de datos
    // Asumimos que el payload del token tiene el ID del usuario (payload.id)
    const result = await pool.query('SELECT estado, rol FROM usuarios WHERE id = $1', [payload.id]);
    
    if (result.rows.length > 0) {
        const usuarioDB = result.rows[0];
        
        // Si fue bloqueado, lo expulsamos inmediatamente de cualquier ruta
        if (usuarioDB.estado && usuarioDB.estado.toLowerCase() === 'bloqueado') {
            return res.status(403).json({ error: 'Tu cuenta ha sido bloqueada por un administrador. Acceso denegado.' });
        }

        // Si está todo bien, guardamos sus datos (incluyendo su rol actualizado) para la siguiente función
        req.usuario = {
            ...payload,
            rol: usuarioDB.rol,
            is_admin: usuarioDB.rol === 'admin'
        };
    } else {
        return res.status(401).json({ error: 'El usuario ya no existe en el sistema.' });
    }

    next();
  } catch (error) {
    return res.status(403).json({ error: 'Token inválido o expirado.' });
  }
}

function soloAdmin(req, res, next) {
  if (!req.usuario) return res.status(401).json({ error: 'No autenticado.' });
  
  // Ahora la validación es mucho más segura porque leemos el "is_admin" que sacamos 
  // directo de la base de datos en la función de arriba.
  if (!req.usuario.is_admin) {
      return res.status(403).json({ error: 'Acceso denegado. Solo administradores.' });
  }
  
  next();
}

module.exports = { verificarToken, soloAdmin };