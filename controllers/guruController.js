const Modul = require('../models/modulModel');
const Ref = require('../models/referensiModel');
const openai = require('../config/ai');

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

exports.generateModul = async (req, res) => {
  const modulId = req.params.id;
  const userId = req.session.user.id;

  try {
    const modul = await Modul.findById(modulId, userId);
    if (!modul) {
      req.session.error = 'Modul tidak ditemukan';
      return res.redirect('/guru');
    }

    // Set status modul menjadi generating
    await Modul.updateStatus(modulId, 'generating');

    // Ambil data TP dan CP terkait
    const tpList = await Modul.getTpCp(modul.atp_id);
    const tpText = tpList.length > 0
      ? tpList.map(t => `- [${t.kode_tp}] ${t.deskripsi_tp} (Elemen: ${t.elemen})`).join('\n')
      : 'Tujuan Pembelajaran sesuai kurikulum';
    const cpText = tpList.length > 0
      ? tpList.map(t => t.deskripsi_cp).join('; ')
      : '-';

    const modelName = process.env.NINEROUTER_MODEL || 'combo-modulajar';

    // Kontrak format: ditulis sekali di system prompt agar stabil di setiap generate
    const systemPrompt = `Kamu adalah penyusun Modul Ajar Kurikulum Merdeka (Kemendikbudristek) untuk jenjang SD yang presisi dan konsisten.

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
7. Isi memakai <p>, <ul>/<ol> dengan <li>, atau <table> sesuai perintah tiap sub-bagian.`;

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
<h3>A. Identitas Modul</h3> : tabel 2 kolom (Aspek | Keterangan) berisi Nama Penyusun, Satuan Pendidikan, Tahun Ajaran, Jenjang/Fase/Kelas, Alokasi Waktu.
<h3>B. Kompetensi Awal</h3> : satu <p> berisi 2-3 kalimat.
<h3>C. Profil Pelajar Pancasila</h3> : <ul>, tiap dimensi disertai satu kalimat alasan.
<h3>D. Sarana dan Prasarana</h3> : <ul>.
<h3>E. Target Peserta Didik dan Model Pembelajaran</h3> : satu <p>.

<h2>2. KOMPONEN INTI</h2>
<h3>A. Tujuan Pembelajaran Operasional</h3> : <ol> tujuan yang operasional dan terukur (pola ABCD: Audience, Behavior, Condition, Degree).
<h3>B. Pemahaman Bermakna</h3> : satu <p>.
<h3>C. Pertanyaan Pemantik</h3> : <ul> berisi 3-5 pertanyaan.
<h3>D. Kegiatan Pembelajaran</h3> : tiga <h4> berurutan.
<h4>1. Kegiatan Pendahuluan</h4> : tabel (Kegiatan | Alokasi Waktu).
<h4>2. Kegiatan Inti</h4> : tabel (Kegiatan | Alokasi Waktu); setiap baris kegiatan WAJIB mencantumkan kode TP yang dirujuk, contoh (TP A.1.1).
<h4>3. Kegiatan Penutup</h4> : tabel (Kegiatan | Alokasi Waktu).
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
</ATURAN_ISI>`;

    // Panggil 9Router API (menggunakan OpenAI SDK)
    const response = await openai.chat.completions.create({
      model: modelName,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.2, // rendah = struktur konsisten antar generate
    });

    let htmlResult = response.choices[0].message.content || '';
    htmlResult = htmlResult.replace(/```html/gi, '').replace(/```/g, '').trim();

    // Simpan konten modul dan update status menjadi selesai
    await Modul.saveContent(modulId, 1, htmlResult);
    await Modul.updateStatus(modulId, 'selesai');

    req.session.pesan = `Modul "${modul.judul}" berhasil disusun dengan AI 9Router!`;
    res.redirect(`/guru/modul/${modulId}`);
  } catch (error) {
    console.error('Error generate modul dengan 9Router:', error);
    await Modul.updateStatus(modulId, 'gagal');
    req.session.error = `Gagal menyusun modul dengan AI: ${error.message}`;
    res.redirect('/guru');
  }
};

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

