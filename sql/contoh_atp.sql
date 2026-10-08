USE db_modul_ajar;

-- Contoh 1 ATP Fase A dengan 2 tujuan pembelajaran (HANYA UNTUK UJI COBA)
INSERT INTO atp (fase_id, judul, tahun_ajaran, is_default, status)
VALUES (1, 'ATP PAI-BP Fase A (contoh)', '2025/2026', 1, 'aktif');

SET @atp := LAST_INSERT_ID();

INSERT INTO tujuan_pembelajaran (atp_id, cp_id, kelas_id, semester, urutan, kode_tp, deskripsi, materi_pokok, alokasi_jp)
VALUES
(@atp, 1, 1, 1, 1, 'A.1.1', 'Peserta didik dapat mengenal huruf hijaiah beserta harakatnya.', 'Huruf hijaiah dan harakat', 4),
(@atp, 2, 1, 1, 2, 'A.2.1', 'Peserta didik dapat menyebutkan rukun iman.', 'Rukun iman', 4);
