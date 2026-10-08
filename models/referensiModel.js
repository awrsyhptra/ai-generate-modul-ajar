const db = require('../config/db');

exports.allCP = async () => {
  const [rows] = await db.query(
    `SELECT f.kode AS fase, e.nama AS elemen, cp.deskripsi
       FROM capaian_pembelajaran cp
       JOIN fase f ON f.id = cp.fase_id
       JOIN elemen e ON e.id = cp.elemen_id
      ORDER BY f.kode, e.urutan`);
  return rows;
};

exports.allKelas = async () => {
  const [rows] = await db.query(
    'SELECT k.id, k.tingkat, f.kode AS fase FROM kelas k JOIN fase f ON f.id = k.fase_id ORDER BY k.tingkat');
  return rows;
};

exports.allATP = async () => {
  const [rows] = await db.query(
    `SELECT a.id, a.judul, f.kode AS fase FROM atp a JOIN fase f ON f.id = a.fase_id
      WHERE a.deleted_at IS NULL AND a.status = 'aktif' ORDER BY f.kode, a.judul`);
  return rows;
};

exports.hitung = async () => {
  const [[r]] = await db.query(
    `SELECT (SELECT COUNT(*) FROM users WHERE role = 'guru') AS guru,
            (SELECT COUNT(*) FROM modul_ajar WHERE deleted_at IS NULL) AS modul,
            (SELECT COUNT(*) FROM atp WHERE deleted_at IS NULL) AS atp,
            (SELECT COUNT(*) FROM capaian_pembelajaran) AS cp`);
  return r;
};
