const router = require('express').Router();
const { wajibLogin, wajibRole } = require('../middlewares/auth');
const admin = require('../controllers/adminController');

router.use(wajibLogin, wajibRole('admin'));   // semua rute di bawah hanya untuk admin
router.get('/', admin.dashboard);
router.post('/guru', admin.tambahGuru);
router.post('/guru/:id/status', admin.ubahStatusGuru);

module.exports = router;
