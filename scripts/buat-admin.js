// Pemakaian: node scripts/buat-admin.js "Nama" email@contoh.id passwordnya
require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('../config/db');

(async () => {
  const [nama, email, password] = process.argv.slice(2);
  if (!nama || !email || !password) { console.log('Isi: nama email password'); process.exit(1); }
  await db.query("INSERT INTO users (nama, email, password_hash, role) VALUES (?, ?, ?, 'admin')",
    [nama, email, await bcrypt.hash(password, 10)]);
  console.log('Admin dibuat:', email);
  process.exit(0);
})();
