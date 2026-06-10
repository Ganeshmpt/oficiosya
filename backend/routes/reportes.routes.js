const express = require('express');
const router  = express.Router();
const ReporteController = require('../controllers/reportes.controller');
const { verificarToken, soloAdmin } = require('../middlewares/auth.middleware');

router.post('/',   verificarToken,            ReporteController.registrar);
router.get('/',    verificarToken, soloAdmin,  ReporteController.listar);
router.put('/:id', verificarToken, soloAdmin,  ReporteController.gestionar);

module.exports = router;