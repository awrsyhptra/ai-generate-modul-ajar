const bcrypt = require('bcryptjs');
const User = require('../models/userModel');
const Ref = require('../models/referensiModel');

exports.dashboard = async (req, res) => {
  const [guru, cp, statistik] = await Promise.all([User.allGuru(), Ref.allCP(), Ref.hitung()]);
  const pesan = req.session.pesan; delete req.session.pesan;
  res.render('admin/dashboard', { title: 'Dashboard Administrator', guru, cp, statistik, pesan });
};

exports.tambahGuru = async (req, res) => {
  const { nama, email, password, nip } = req.body;
  try {
    await User.createGuru(nama, email, await bcrypt.hash(password, 10), nip);
    req.session.pesan = 'Guru berhasil ditambahkan';
  } catch (e) {
    req.session.pesan = e.code === 'ER_DUP_ENTRY' ? 'Email sudah terdaftar' : 'Gagal menyimpan data';
  }
  res.redirect('/admin');
};

exports.ubahStatusGuru = async (req, res) => {
  await User.setActive(req.params.id, req.body.aktif === '1' ? 1 : 0);
  res.redirect('/admin');
};
