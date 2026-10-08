const router = require('express').Router();
const { wajibLogin, wajibRole } = require('../middlewares/auth');
const guru = require('../controllers/guruController');

router.use(wajibLogin, wajibRole('guru'));
router.get('/', guru.dashboard);
router.post('/modul', guru.buatModul);
router.get('/modul/:id/generate', guru.generateModul);
router.post('/modul/:id/generate', guru.generateModul);
router.get('/modul/:id', guru.lihatModul);
router.post('/modul/:id/hapus', guru.hapusModul);

module.exports = router;
