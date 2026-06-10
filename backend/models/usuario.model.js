const pool = require('../config/db');

const UsuarioModel = {

  async findByEmail(email) {
    const res = await pool.query('SELECT * FROM usuarios WHERE email = $1', [email]);
    return res.rows[0] || null;
  },

  async findById(id) {
    const res = await pool.query('SELECT * FROM usuarios WHERE id = $1', [id]);
    return res.rows[0] || null;
  },

  async findByResetToken(token) {
    const res = await pool.query(
      'SELECT * FROM usuarios WHERE reset_token = $1 AND reset_token_expiry > NOW()', [token]
    );
    return res.rows[0] || null;
  },

  async create({ nombre, apellido, email, password_hash, telefono, zona, email_token }) {
    const res = await pool.query(
      `INSERT INTO usuarios (nombre, apellido, email, password_hash, telefono, zona, email_token)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [nombre, apellido||'', email, password_hash, telefono||'', zona||'', email_token||'']
    );
    return res.rows[0];
  },

  async updatePassword(id, password_hash) {
    await pool.query(
      `UPDATE usuarios SET password_hash=$1, reset_token=NULL,
       reset_token_expiry=NULL, updatedat=NOW() WHERE id=$2`,
      [password_hash, id]
    );
  },

  async setResetToken(id, token, expiry) {
    await pool.query(
      'UPDATE usuarios SET reset_token=$1, reset_token_expiry=$2 WHERE id=$3',
      [token, expiry, id]
    );
  },

  async setEmailToken(id, email_token) {
    await pool.query(
      'UPDATE usuarios SET email_token=$1 WHERE id=$2',
      [email_token, id]
    );
  },

  async verificarEmail(id) {
    await pool.query(
      'UPDATE usuarios SET email_verificado=TRUE, email_token=NULL WHERE id=$1', [id]
    );
  },

  async updateFoto(id, foto_url, foto_public_id) {
    const res = await pool.query(
      'UPDATE usuarios SET foto_url=$1, foto_public_id=$2, updatedat=NOW() WHERE id=$3 RETURNING *',
      [foto_url, foto_public_id, id]
    );
    return res.rows[0];
  },

  async updatePerfil(id, { nombre, apellido, telefono, zona }) {
    const res = await pool.query(
      `UPDATE usuarios SET nombre=$1, apellido=$2, telefono=$3, zona=$4, updatedat=NOW()
       WHERE id=$5 RETURNING *`,
      [nombre, apellido, telefono, zona, id]
    );
    return res.rows[0];
  },

  sanitize(u) {
    if (!u) return null;
    const { password_hash, reset_token, reset_token_expiry, email_token, ...safe } = u;
    return safe;
  }
};

module.exports = UsuarioModel;