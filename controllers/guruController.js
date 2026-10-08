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

    console.log(modul);
    // Set status modul menjadi generating
    await Modul.updateStatus(modulId, 'generating');

    // Ambil data TP dan CP terkait
    const tpList = await Modul.getTpCp(modul.atp_id);
    const tpText = tpList.length > 0
      ? tpList.map(t => `- [${t.kode_tp}] ${t.deskripsi_tp} (Elemen: ${t.elemen})`).join('\n')
      : 'Tujuan Pembelajaran sesuai kurikulum';
    const cpText = tpList.length > 0 && tpList.map(t => t.deskripsi_cp).join(', ');

    const modelName = process.env.NINEROUTER_MODEL || 'combo-modulajar';

    const prompt = `Anda adalah pakar penyusun Modul Ajar Kurikulum Merdeka resmi Kemendikbudristek untuk jenjang SD.
Tolong susunkan draf dokumen Modul Ajar yang lengkap, mendalam, dan siap pakai berdasarkan data berikut:
- Judul / Topik: ${modul.judul}
- Jenjang / Fase: Fase ${modul.fase} (Kelas ${modul.kelas})
- Semester: Semester ${modul.semester}
- Alur Tujuan Pembelajaran: ${modul.judul_atp}
- Capaian Pembelajaran (CP): "${cpText}"
- Tujuan Pembelajaran (TP):
${tpText}

Format output HARUS berupa HTML rapi (gunakan <h2>, <h3>, <h4>, <p>, <ul>, <li>, <table>, <tr>, <th>, <td>, <strong>) tanpa pembungkus markdown seperti \`\`\`html atau \`\`\`.

Struktur Dokumen Modul Ajar harus mencakup:
1. <h2>1. INFORMASI UMUM</h2>
   - Identitas Modul (Nama Penyusun, Satuan Pendidikan, Tahun Ajaran, Jenjang, Fase/Kelas, Alokasi Waktu)
   - Kompetensi Awal
   - Profil Pelajar Pancasila yang dikembangkan
   - Sarana dan Prasarana
   - Target Peserta Didik & Model Pembelajaran
2. <h2>2. KOMPONEN INTI</h2>
   - Tujuan Pembelajaran Operasional
   - Pemahaman Bermakna
   - Pertanyaan Pemantik
   - Kegiatan Pembelajaran Terperinci (Kegiatan Pendahuluan, Kegiatan Inti, Kegiatan Penutup)
   - Asesmen Pembelajaran (Diagnostik, Formatif, dan Sumatif)
   - Pengayaan dan Remedial
3. <h2>3. LAMPIRAN</h2>
   - Lembar Kerja Peserta Didik (LKPD) ringkas
   - Bahan Bacaan Guru dan Siswa
   - Glosarium & Daftar Pustaka`;

    console.log(prompt);

    // Panggil 9Router API (menggunakan OpenAI SDK)
    const response = await openai.chat.completions.create({
      model: modelName,
      messages: [
        {
          role: 'system',
          content: 'Kamu adalah AI asisten penyusun Modul Ajar Kurikulum Merdeka yang profesional. Berikan jawaban dalam format HTML siap tampil tanpa backtick markdown ```html.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
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
