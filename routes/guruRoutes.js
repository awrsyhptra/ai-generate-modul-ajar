const router = require('express').Router();
const { wajibLogin, wajibRole } = require('../middlewares/auth');
const guru = require('../controllers/guruController');

router.use(wajibLogin, wajibRole('guru'));
router.get('/', guru.dashboard);
router.post('/modul', guru.buatModul);
router.post('/modul/:id/generate', guru.mintaGenerate);   // POST only: generate adalah aksi yang mengubah data
router.get('/modul/:id', guru.lihatModul);
router.post('/modul/:id/hapus', guru.hapusModul);

module.exports = router;

