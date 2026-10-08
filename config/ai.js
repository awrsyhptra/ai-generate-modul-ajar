const { OpenAI } = require('openai');

// Inisialisasi klien OpenAI / 9router menggunakan konfigurasi dari file .env
const openai = new OpenAI({
  baseURL: process.env.NINEROUTER_BASE_URL || 'http://127.0.0.1:20128/v1',
  apiKey: process.env.NINEROUTER_API_KEY,
});

module.exports = openai;
