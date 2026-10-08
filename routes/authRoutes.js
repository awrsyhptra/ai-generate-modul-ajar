const router = require('express').Router();
const auth = require('../controllers/authController');

router.get('/', (req, res) => res.redirect('/login'));
router.get('/login', auth.tampilLogin);
router.post('/login', auth.prosesLogin);
router.post('/logout', auth.logout);

module.exports = router;
