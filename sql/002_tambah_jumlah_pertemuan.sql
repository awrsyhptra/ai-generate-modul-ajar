-- Tambah kolom jumlah_pertemuan pada tabel modul_ajar
-- Jalankan SEKALI di phpMyAdmin (tab SQL) pada database db_modul_ajar.
-- Modul yang sudah ada otomatis bernilai 4 (default).
ALTER TABLE modul_ajar ADD COLUMN jumlah_pertemuan INT NOT NULL DEFAULT 4;
