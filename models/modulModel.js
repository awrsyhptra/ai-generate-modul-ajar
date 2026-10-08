const db = require('../config/db');

exports.byUser = async (userId) => {
  const [rows] = await db.query(
    `SELECT m.id, m.judul, m.semester, m.status, m.created_at, k.tingkat AS kelas
       FROM modul_ajar m JOIN kelas k ON k.id = m.kelas_id
      WHERE m.user_id = ? AND m.deleted_at IS NULL ORDER BY m.created_at DESC`, [userId]);
  return rows;
};

exports.create = async (userId, atpId, kelasId, judul, semester, jumlahPertemuan) => {
  const [res] = await db.query(
    'INSERT INTO modul_ajar (user_id, atp_id, kelas_id, judul, semester, jumlah_pertemuan) VALUES (?, ?, ?, ?, ?, ?)',
    [userId, atpId, kelasId, judul, semester, jumlahPertemuan || 4]);
  return res.insertId;
};

exports.findById = async (id, userId) => {
  const [rows] = await db.query(
    `SELECT m.*, k.tingkat AS kelas, f.kode AS fase, a.judul AS judul_atp
       FROM modul_ajar m
       JOIN kelas k ON k.id = m.kelas_id
       JOIN atp a ON a.id = m.atp_id
       JOIN fase f ON f.id = a.fase_id
      WHERE m.id = ? AND m.user_id = ? AND m.deleted_at IS NULL`,
    [id, userId]
  );
  return rows[0] || null;
};

exports.getTpCp = async (atpId) => {
  const [rows] = await db.query(
    `SELECT tp.kode_tp, tp.deskripsi AS deskripsi_tp, cp.deskripsi AS deskripsi_cp, e.nama AS elemen
       FROM tujuan_pembelajaran tp
       JOIN capaian_pembelajaran cp ON tp.cp_id = cp.id
       JOIN elemen e ON cp.elemen_id = e.id
      WHERE tp.atp_id = ?
      ORDER BY tp.urutan`,
    [atpId]
  );
  return rows;
};

exports.updateStatus = (id, status) =>
  db.query('UPDATE modul_ajar SET status = ? WHERE id = ?', [status, id]);

exports.saveContent = (modulId, komponenId, konten) =>
  db.query(
    `INSERT INTO modul_komponen (modul_id, komponen_id, konten, versi)
     VALUES (?, ?, ?, 1)
     ON DUPLICATE KEY UPDATE konten = VALUES(konten), updated_at = NOW()`,
    [modulId, komponenId, konten]
  );

exports.getContent = async (modulId) => {
  const [rows] = await db.query(
    'SELECT konten FROM modul_komponen WHERE modul_id = ? AND komponen_id = 1',
    [modulId]
  );
  return rows[0] ? rows[0].konten : null;
};

exports.delete = (id, userId) =>
  db.query('UPDATE modul_ajar SET deleted_at = NOW() WHERE id = ? AND user_id = ?', [id, userId]);


// Klaim atomik anti double-generate: hanya berhasil jika status BUKAN 'generating'
exports.claimGenerating = async (id, userId) => {
  const [res] = await db.query(
    `UPDATE modul_ajar SET status = 'generating'
       WHERE id = ? AND user_id = ? AND deleted_at IS NULL
         AND (status IS NULL OR status <> 'generating')`,
    [id, userId]
  );
  return res.affectedRows > 0;
};

