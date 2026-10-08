const mysql = require('mysql2/promise');

// Pool koneksi dipakai bersama oleh semua model
module.exports = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'db_modul_ajar',
  charset: 'utf8mb4',
  waitForConnections: true,
  connectionLimit: 10,
});
