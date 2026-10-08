const Modul = require('../models/modulModel');
const Ref = require('../models/referensiModel');
const openai = require('../config/ai');
const sanitizeHtml = require('sanitize-html');

exports.dashboard = async (req, res) => {
  const [modul, kelas, atp, cp] = await Promise.all([
    Modul.byUser(req.session.user.id), Ref.allKelas(), Ref.allATP(), Ref.allCP()]);
  const pesan = req.session.pesan;
  const error = req.session.error;
  delete req.session.pesan;
  delete req.session.error;
  res.render('guru/dashboard', { title: 'Dashboard Guru', modul, kelas, atp, cp, pesan, error });
};

exports.buatModul = async (req, res) => {
  const { judul, kelas_id, atp_id, semester } = req.body;
  await Modul.create(req.session.user.id, atp_id, kelas_id, judul, semester);

  req.session.pesan = 'Draf modul ajar berhasil dibuat. Silakan klik "⚡ Generate AI" untuk mulai menyusun isi modul.';
  res.redirect('/guru');
};

// POST /guru/modul/:id/generate — minta generate; AI berjalan di background
exports.mintaGenerate = async (req, res) => {
  const modulId = req.params.id;
  const userId = req.session.user.id;

  // Klaim atomik: gagal jika modul tidak ada ATAU sedang dalam proses generate
  const diklaim = await Modul.claimGenerating(modulId, userId);
  if (diklaim) {
    // Jalankan di background tanpa di-await agar respons langsung kembali
    prosesGenerate(modulId, userId).catch((err) =>
      console.error('Background generate gagal:', err)
    );
    req.session.pesan = 'AI sedang menyusun modul. Halaman akan refresh otomatis sampai selesai.';
  } else {
    const modul = await Modul.findById(modulId, userId);
    if (modul && modul.status === 'generating') {
      req.session.pesan = 'Modul masih dalam proses penyusunan AI. Mohon tunggu sebentar.';
    } else {
      req.session.error = 'Modul tidak ditemukan';
    }
  }
  res.redirect('/guru');
};

// Pekerja background: menyusun modul dengan AI lalu menyimpan hasilnya
async function prosesGenerate(modulId, userId) {
  try {
    const modul = await Modul.findById(modulId, userId);
    if (!modul) return;

    // Ambil data TP dan CP terkait
    const tpList = await Modul.getTpCp(modul.atp_id);
    const tpText = tpList.length > 0
      ? tpList.map(t => `- [${t.kode_tp}] ${t.deskripsi_tp} (Elemen: ${t.elemen})`).join('\n')
      : 'Tujuan Pembelajaran sesuai kurikulum';
    // Dedupe CP: satu CP yang dipakai banyak TP cukup dikirim sekali (hemat token)
    const cpText = tpList.length > 0
      ? [...new Set(tpList.map((t) => t.deskripsi_cp).filter(Boolean))].join('; ')
      : '-';

    const { systemPrompt, userPrompt } = bangunPrompt(modul, tpText, cpText);

    // Panggil 9Router API (menggunakan OpenAI SDK) dengan batas waktu
    const response = await panggilAI(systemPrompt, userPrompt);

    let htmlResult = response.choices[0].message.content || '';
    htmlResult = htmlResult.replace(/```html/gi, '').replace(/```/g, '').trim();

    // Sanitasi: hanya tag yang diizinkan kontrak format yang boleh lolos
    htmlResult = sanitizeHtml(htmlResult, {
      allowedTags: ['h2', 'h3', 'h4', 'p', 'ul', 'ol', 'li', 'table', 'thead', 'tbody',
                    'tr', 'th', 'td', 'strong', 'em', 'br'],
      allowedAttributes: {},
    });

    // Simpan konten modul dan update status menjadi selesai
    await Modul.saveContent(modulId, 1, htmlResult);
    await Modul.updateStatus(modulId, 'selesai');
  } catch (error) {
    console.error('Error generate modul dengan 9Router:', error);
    try {
      await Modul.updateStatus(modulId, 'gagal');
    } catch (e) {
      console.error('Gagal menandai modul sebagai gagal:', e.message);
    }
  }
}

// Susun system prompt + user prompt dari data modul
function bangunPrompt(modul, tpText, cpText) {
// Kontrak format: ditulis sekali di system prompt agar stabil di setiap generate
    const systemPrompt = `Anda adalah penyusun Modul Ajar Kurikulum Merdeka (Kemendikbudristek) untuk jenjang SD yang presisi dan konsisten.

KONTRAK FORMAT OUTPUT — patuhi di setiap respons tanpa kecuali:
1. Seluruh respons HARUS berupa satu dokumen HTML valid. Dilarang menulis kalimat pembuka, kalimat penutup, atau penjelasan apa pun di luar HTML.
2. Dilarang membungkus output dengan blok kode markdown (seperti \`\`\`html atau \`\`\`).
3. Hanya boleh memakai tag: h2, h3, h4, p, ul, ol, li, table, thead, tbody, tr, th, td, strong, em.
4. Dokumen HARUS memuat TEPAT 3 heading <h2> dengan teks dan urutan persis seperti ini:
   <h2>1. INFORMASI UMUM</h2>
   <h2>2. KOMPONEN INTI</h2>
   <h2>3. LAMPIRAN</h2>
5. Dilarang menambah bagian baru, menghapus bagian, mengubah urutan, atau mengubah teks heading — walau satu huruf.
6. Sub-bagian memakai <h3> dengan judul persis seperti pada <STRUKTUR_WAJIB> di pesan pengguna; sub-sub-bagian memakai <h4>.
7. Isi memakai <p>, <ul>/<ol> dengan <li>, atau <table> sesuai perintah tiap sub-bagian.
8. Mulailah dokumen LANGSUNG dengan <h2>1. INFORMASI UMUM</h2>. Jangan membuat blok judul, kop, atau salam pembuka — kop dokumen sudah disediakan oleh template aplikasi.`;

    // Data dipisah dari instruksi dengan delimiter agar AI tidak tercampur
    const userPrompt = `Susun draf Modul Ajar berdasarkan <DATA> berikut. Ikuti <STRUKTUR_WAJIB> dan <ATURAN_ISI> dengan tepat.

<DATA>
Judul / Topik: ${modul.judul}
Jenjang: Fase ${modul.fase} (Kelas ${modul.kelas})
Semester: Semester ${modul.semester}
Alur Tujuan Pembelajaran (ATP): ${modul.judul_atp}
Capaian Pembelajaran (CP): "${cpText}"
Tujuan Pembelajaran (TP):
${tpText}
</DATA>

<STRUKTUR_WAJIB>
<h2>1. INFORMASI UMUM</h2>
<h3>A. Identitas Modul</h3> : tabel 2 kolom (Aspek | Keterangan) berisi TEPAT 4 baris ini — Judul/Topik, Jenjang/Fase/Kelas, Semester, Alur Tujuan Pembelajaran (ATP). Dilarang menambah baris lain seperti nama penyusun, satuan pendidikan, tahun ajaran, atau alokasi waktu karena datanya tidak tersedia.
<h3>B. Kompetensi Awal</h3> : satu <p> berisi 2-3 kalimat.
<h3>C. Profil Pelajar Pancasila</h3> : <ul>, tiap dimensi disertai satu kalimat alasan.
<h3>D. Sarana dan Prasarana</h3> : <ul>.
<h3>E. Target Peserta Didik dan Model Pembelajaran</h3> : satu <p>.

<h2>2. KOMPONEN INTI</h2>
<h3>A. Tujuan Pembelajaran Operasional</h3> : <ol> tujuan yang operasional dan terukur (pola ABCD: Audience, Behavior, Condition, Degree).
<h3>B. Pemahaman Bermakna</h3> : satu <p>.
<h3>C. Pertanyaan Pemantik</h3> : <ul> berisi 3-5 pertanyaan.
<h3>D. Kegiatan Pembelajaran</h3> : bagi seluruh materi menjadi beberapa pertemuan yang berurutan dan berkesinambungan. Tentukan sendiri jumlah pertemuan yang ideal (2 sampai 8 pertemuan) berdasarkan keluasan materi dan banyaknya TP — materi yang padat boleh lebih banyak pertemuan, materi yang ringan cukup sedikit.
Setiap pertemuan memakai <h4>Pertemuan N: [fokus materi pertemuan tersebut]</h4> diikuti tabel 3 kolom (Tahapan | Kegiatan | Alokasi Waktu) dengan tiga baris tahapan: Pendahuluan, Kegiatan Inti, Penutup.
Setiap kegiatan inti WAJIB mencantumkan kode TP yang dirujuk, contoh (TP A.1.1).
<h3>E. Asesmen Pembelajaran</h3> : tiga <h4> berurutan.
<h4>1. Asesmen Diagnostik</h4> : <p> atau <ul>.
<h4>2. Asesmen Formatif</h4> : <p> atau <ul>.
<h4>3. Asesmen Sumatif</h4> : <p> atau <ul>.
<h3>F. Pengayaan dan Remedial</h3> : satu <p> pembuka lalu <ul> daftar kegiatan.

<h2>3. LAMPIRAN</h2>
<h3>A. Lembar Kerja Peserta Didik (LKPD)</h3> : ringkas — tujuan, langkah kerja (<ol>), dan satu tabel isian.
<h3>B. Bahan Bacaan Guru dan Siswa</h3> : <ul>.
<h3>C. Glosarium</h3> : tabel 2 kolom (Istilah | Arti).
<h3>D. Daftar Pustaka</h3> : <ul>.
</STRUKTUR_WAJIB>

<ATURAN_ISI>
- Bahasa Indonesia formal edukatif; konsisten memakai istilah "peserta didik".
- Jangan menyalin mentah deskripsi TP/CP; olah menjadi kalimat operasional.
- Dilarang menambah bagian apa pun di luar <STRUKTUR_WAJIB>.
- Hindari basa-basi; isi padat dan siap pakai.
- Alokasi waktu tiap tahapan wajar untuk jenjang SD (mis. 2 x 35 menit per pertemuan).
</ATURAN_ISI>`;

  return { systemPrompt, userPrompt };
}

// Panggil 9Router dengan batas waktu agar request tidak menggantung selamanya
function panggilAI(systemPrompt, userPrompt) {
  const modelName = process.env.NINEROUTER_MODEL || 'combo-modulajar';
  const BATAS_MS = 180000; // 3 menit

  const p = openai.chat.completions.create({
    model: modelName,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.2, // rendah = struktur konsisten antar generate
    max_tokens: 12000, // batas atas agar output tidak liar
  });
  const pewaktu = new Promise((_, tolak) =>
    setTimeout(() => tolak(new Error('AI timeout setelah 3 menit')), BATAS_MS)
  );
  return Promise.race([p, pewaktu]);
}

exports.lihatModul = async (req, res) => {
  const modulId = req.params.id;
  const userId = req.session.user.id;
  const modul = await Modul.findById(modulId, userId);
  if (!modul) {
    return res.status(404).send('Modul ajar tidak ditemukan');
  }
  const konten = await Modul.getContent(modulId);
  res.render('guru/detailModul', { title: modul.judul, modul, konten });
};

exports.hapusModul = async (req, res) => {
  await Modul.delete(req.params.id, req.session.user.id);
  req.session.pesan = 'Modul ajar berhasil dihapus';
  res.redirect('/guru');
};






