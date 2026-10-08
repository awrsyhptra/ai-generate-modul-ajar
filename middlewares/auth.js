// Wajib login
exports.wajibLogin = (req, res, next) => {
  if (!req.session.user) return res.redirect('/login');
  next();
};

// Wajib punya role tertentu ('admin' atau 'guru')
exports.wajibRole = (role) => (req, res, next) => {
  if (req.session.user.role !== role) return res.status(403).send('Akses ditolak');
  next();
};
