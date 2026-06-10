const pool = require('../config/db');

const CategoriaModel = {
  async listar() {
    const res = await pool.query('SELECT * FROM categorias WHERE activa = true ORDER BY nombre');
    return res.rows;
  }
};

module.exports = CategoriaModel;
