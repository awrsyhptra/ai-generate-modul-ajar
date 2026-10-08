require('dotenv').config();               // harus paling atas
const path = require('path');
const express = require('express');
const session = require('express-session');

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));   // css di /public/css
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, maxAge: 1000 * 60 * 60 * 8 },
}));
app.use((req, res, next) => { res.locals.user = req.session.user || null; next(); });

app.use('/', require('./routes/authRoutes'));
app.use('/admin', require('./routes/adminRoutes'));
app.use('/guru', require('./routes/guruRoutes'));

app.use((req, res) => res.status(404).send('Halaman tidak ditemukan'));

// Error handler global
app.use((err, req, res, next) => {
  console.error('Server Error:', err);
  if (err.code === 'ECONNREFUSED' || err.name === 'AggregateError' || (err.message && err.message.includes('connect'))) {
    return res.status(500).send(`
      <div style="font-family:sans-serif; padding:2rem; max-width:600px; margin:auto;">
        <h2 style="color:#dc2626;">Koneksi Database Gagal</h2>
        <p>Aplikasi tidak dapat terhubung ke server MySQL (port 3306).</p>
        <p><strong>Solusi:</strong> Buka <strong>XAMPP Control Panel</strong> dan klik <strong>Start</strong> pada modul <strong>MySQL</strong>.</p>
        <pre style="background:#f1f5f9; padding:1rem; border-radius:6px; overflow:auto;">${err.message || err}</pre>
      </div>
    `);
  }
  res.status(500).send('Terjadi kesalahan pada server: ' + (err.message || err));
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server berjalan di http://localhost:${port}`));
