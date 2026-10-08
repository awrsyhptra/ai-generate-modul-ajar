const db = require('../config/db');

exports.findByEmail = async (email) => {
  const [rows] = await db.query('SELECT * FROM users WHERE email = ? AND is_active = 1', [email]);
  return rows[0];
};

exports.allGuru = async () => {
  const [rows] = await db.query(
    "SELECT id, nama, email, nip, is_active FROM users WHERE role = 'guru' ORDER BY nama");
  return rows;
};

exports.createGuru = (nama, email, passwordHash, nip) =>
  db.query("INSERT INTO users (nama, email, password_hash, role, nip) VALUES (?, ?, ?, 'guru', ?)",
    [nama, email, passwordHash, nip || null]);

exports.setActive = (id, aktif) =>
  db.query("UPDATE users SET is_active = ? WHERE id = ? AND role = 'guru'", [aktif, id]);
