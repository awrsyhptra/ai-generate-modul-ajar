const bcrypt = require('bcryptjs');
const User = require('../models/userModel');

exports.tampilLogin = (req, res) => {
  if (req.session.user) return res.redirect('/' + req.session.user.role);
  res.render('login', { title: 'Masuk', error: null });
};

exports.prosesLogin = async (req, res) => {
  const user = await User.findByEmail(req.body.email);
  const cocok = user && await bcrypt.compare(req.body.password, user.password_hash);
  if (!cocok) return res.render('login', { title: 'Masuk', error: 'Email atau password salah' });

  req.session.user = { id: user.id, nama: user.nama, role: user.role };
  res.redirect('/' + user.role);       // /admin atau /guru
};

exports.logout = (req, res) => req.session.destroy(() => res.redirect('/login'));
