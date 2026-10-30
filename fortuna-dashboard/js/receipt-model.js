// Fortuna Laundry — receipt model (SUMBER TUNGGAL isi struk)
//
// Dipakai oleh:
//   - receipt.js  -> preview di layar (mode "Sesuai printer" & "Tampilan nota")
//   - printer.js  -> cetak ESC/POS ke thermal printer 58 mm
//
// Aturan: satuan, nama paket, total, tanggal, parsing nominal, dan semua teks
// statis struk HANYA boleh ditentukan di file ini. Jangan dihitung ulang di tempat lain.
//
// Bergantung (dipanggil saat runtime, urutan load bebas): packageDisplayName, getOrderUnit (orders.js)

const RECEIPT_COLUMNS = 32;                 // 58 mm, Font A 12x24 = 32 karakter
const RECEIPT_TIMEZONE = 'Asia/Jakarta';    // tanggal struk selalu WIB, apa pun zona waktu perangkat

// Zona waktu string START dari backend yang TIDAK punya offset (contoh "2026-10-14 03:30:00").
//   'UTC' -> backend menulis waktu UTC; struk digeser +7 jam ke WIB  (perilaku struk sebelumnya)
//   'WIB' -> backend sudah menulis waktu Jakarta; struk menampilkan jam apa adanya
// Cara memastikan: buat 1 order, lalu di console dashboard jalankan
//   orders[0].START   (atau cari order barunya) dan bandingkan dengan jam WIB saat order dibuat.
// String yang sudah punya offset ("Z" atau "+07:00") tidak terpengaruh pengaturan ini.
const RECEIPT_NAIVE_TIME_IS = 'UTC';
const RECEIPT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

const RECEIPT_STORE = {
  name: 'FORTUNA LAUNDRY',
  address: ['Jalan Raya Inpres no 4', 'Jakarta Timur'],
  phone: '085693280500'
};
// dipecah manual per baris agar rapi di 32 kolom (jika digabung: "-- PEMBAYARAN HARAP MENGGUNAKAN QRIS --")
const RECEIPT_PAYMENT_NOTE = ['-- PEMBAYARAN HARAP', 'MENGGUNAKAN QRIS --'];
const RECEIPT_NOTES = [
  'Baju putih dicuci terpisah minimal 3 kg.',
  'Kami tidak menerima komplain lebih dari 2x24jam setelah customer menerima Laundry.',
  'Baju yang mudah luntur TAPI tidak memberitahu kami sebelumnya, bukan tanggung jawab kami.',
  'Di sarankan baju luntur untuk cuci satuan.',
  'Jika ingin pakaian Bapak/Ibu dikerjakan lebih optimal disarankan untuk pengerjaan satuan.',
  'Laundry yang lebih dari 10 hari tidak diambil bukan menjadi tanggung jawab kami.',
  'Laundry anda GRATIS apabila tidak mendapatkan nota.'
];
const RECEIPT_FEEDBACK_TITLE = 'Kritik dan saran';
const RECEIPT_THANKS = '#Terimakasih Kasih#';

/* ------------------------------- helper teks ------------------------------- */

// Ubah teks apa pun jadi ASCII aman untuk printer thermal (tanpa code page).
function receiptAscii(value) {
  let s = String(value == null ? '' : value);
  s = s
    .replace(/[\u2022\u00B7\u2023\u25CF]/g, '-')     // bullet
    .replace(/[\u2013\u2014\u2212]/g, '-')           // en/em dash, minus
    .replace(/[\u2018\u2019\u201A\u2032]/g, "'")     // kutip tunggal pintar
    .replace(/[\u201C\u201D\u201E\u2033]/g, '"')     // kutip ganda pintar
    .replace(/\u2026/g, '...')
    .replace(/\u00A0/g, ' ');
  if (typeof s.normalize === 'function') s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); // é -> e
  return s
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/[^\x20-\x7E]/g, '?')
    .replace(/\s+/g, ' ')
    .trim();
}

// Keterangan tambahan (opsional) yang diisi sebelum cetak. Baris baru dari input dipertahankan,
// tiap baris dijadikan ASCII aman printer; baris kosong di awal/akhir dibuang.
function receiptNoteLines(value) {
  const lines = String(value == null ? '' : value).split(/\r?\n/).map(function (s) { return receiptAscii(s); });
  while (lines.length && !lines[0]) lines.shift();
  while (lines.length && !lines[lines.length - 1]) lines.pop();
  return lines;
}

// Parser nominal rupiah TUNGGAL. Hasil selalu bilangan bulat.
//   25000 | "25000" | "25.000" | "Rp 25.000" | "25.000,00" | "12500.5" -> bulat
function receiptParseMoney(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? Math.round(value) : 0;
  let s = String(value == null ? '' : value).trim();
  if (!s) return 0;
  const neg = /^[^\d]*-/.test(s);
  s = s.replace(/[^\d.,]/g, '');
  if (!s) return 0;
  const hasDot = s.indexOf('.') >= 0, hasComma = s.indexOf(',') >= 0;
  if (hasDot && hasComma) {
    const dec = s.lastIndexOf('.') > s.lastIndexOf(',') ? '.' : ',';
    const thou = dec === '.' ? ',' : '.';
    s = s.split(thou).join('').replace(dec, '.');
  } else if (hasDot || hasComma) {
    const sep = hasDot ? '.' : ',';
    const parts = s.split(sep);
    const thousands = parts.length > 2 || (parts.length === 2 && parts[1].length === 3);
    s = thousands ? parts.join('') : parts[0] + '.' + parts[1];
  }
  const n = Number(s);
  if (!Number.isFinite(n)) return 0;
  return (neg ? -1 : 1) * Math.round(n);
}

function receiptRupiah(n) {
  const v = Math.round(Number(n) || 0);
  const s = String(Math.abs(v)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return (v < 0 ? '-' : '') + 'Rp ' + s;
}

// Timestamp tanpa offset ditafsirkan menurut RECEIPT_NAIVE_TIME_IS ('UTC' atau 'WIB').
function receiptParseDate(value) {
  const raw = String(value == null ? '' : value).trim();
  if (!raw) return new Date();
  let iso = raw.indexOf('T') >= 0 ? raw : raw.replace(' ', 'T');
  iso = iso.replace(/T(\d):/, 'T0$1:');   // "2026-10-14 1:10:34" (jam tanpa angka 0) -> "01:10:34"
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) iso += 'T00:00:00';
  const naiveSuffix = RECEIPT_NAIVE_TIME_IS === 'WIB' ? '+07:00' : 'Z';
  const d = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(iso) ? new Date(iso) : new Date(iso + naiveSuffix);
  return isNaN(d.getTime()) ? new Date() : d;
}

// Format tetap, tidak bergantung locale browser: "14 Okt 2026 10.30" (selalu 18 karakter)
function receiptFormatDate(d) {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: RECEIPT_TIMEZONE, day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
    }).formatToParts(d);
    const get = t => (parts.find(p => p.type === t) || {}).value || '';
    const m = parseInt(get('month'), 10);
    return get('day') + ' ' + (RECEIPT_MONTHS[m - 1] || get('month')) + ' ' + get('year') + ' ' + get('hour') + '.' + get('minute');
  } catch (e) {
    const p2 = n => String(n).padStart(2, '0');
    return p2(d.getDate()) + ' ' + RECEIPT_MONTHS[d.getMonth()] + ' ' + d.getFullYear() + ' ' + p2(d.getHours()) + '.' + p2(d.getMinutes());
  }
}

// Bungkus kata ke lebar tertentu (kata yang lebih panjang dari lebar dipotong).
function receiptWrapText(text, width) {
  width = width || RECEIPT_COLUMNS;
  const clean = receiptAscii(text);
  if (!clean) return [''];
  const lines = [];
  let line = '';
  for (const word of clean.split(' ')) {
    if (word.length > width) {
      if (line) { lines.push(line); line = ''; }
      let i = 0;
      for (; i + width < word.length; i += width) lines.push(word.slice(i, i + width));
      line = word.slice(i);
      continue;
    }
    const candidate = line ? line + ' ' + word : word;
    if (candidate.length <= width) line = candidate;
    else { lines.push(line); line = word; }
  }
  if (line) lines.push(line);
  return lines;
}

// Kiri-kanan. Kalau tidak muat satu baris, kolom kanan turun ke baris sendiri (rata kanan).
function receiptLayoutLR(left, right, width) {
  width = width || RECEIPT_COLUMNS;
  const r = receiptAscii(right).slice(0, width);
  const lines = receiptWrapText(left, width);
  const last = lines[lines.length - 1];
  if (last.length + r.length + 1 <= width) {
    lines[lines.length - 1] = last + ' '.repeat(width - last.length - r.length) + r;
  } else {
    lines.push(' '.repeat(width - r.length) + r);
  }
  return lines;
}

// Label instansi untuk struk, contoh "SECABA-038".
// ORDER_ID sekarang numerik global (mis. 20894); identitas instansi ada di ITEM_ID ("SECABA-038-01").
// Preview sebelum simpan belum punya ITEM_ID -> hanya nama instansi ("SECABA").
// Data lama yang ORDER_ID-nya sudah "SECABA-038" tidak diberi label tambahan (hindari dobel).
function receiptInstansiLabel(o) {
  o = o || {};
  const type = typeof getOrderType === 'function' ? getOrderType(o) : { type: 'REGULER', instansi: '' };
  if (type.type !== 'INSTANSI') return '';
  if (String(o.ORDER_ID || '').toUpperCase().indexOf(type.instansi + '-') === 0) return '';
  const items = Array.isArray(o.items) ? o.items : [];
  for (let i = 0; i < items.length; i++) {
    const id = String((items[i] && items[i].ITEM_ID) || '').toUpperCase();
    const m = id.match(/^(SECATA|SECABA|PUSPOMAD)-(\d+)/);
    if (m) return m[1] + '-' + m[2];
  }
  return type.instansi;
}

/* --------------------------------- MODEL ---------------------------------- */

function buildReceiptModel(o) {
  o = o || {};
  const rawItems = Array.isArray(o.items) ? o.items : [];

  const items = rawItems.map(function (x, i) {
    x = x || {};
    const rawName = String(x.PAKET || '-');
    const display = typeof packageDisplayName === 'function' ? packageDisplayName(rawName) : rawName;
    const unit = typeof getOrderUnit === 'function' ? getOrderUnit(o, x.PAKET) : 'kg';
    return {
      no: i + 1,
      name: receiptAscii(display) || '-',
      qty: receiptAscii(x.BERAT) || '0',
      unit: receiptAscii(unit) || 'kg',
      amount: receiptParseMoney(x.TAGIHAN)
    };
  });

  const hasItemAmounts = rawItems.some(function (x) {
    return x && x.TAGIHAN !== undefined && x.TAGIHAN !== null && String(x.TAGIHAN).trim() !== '';
  });
  const total = hasItemAmounts
    ? items.reduce(function (s, it) { return s + it.amount; }, 0)
    : receiptParseMoney(o.TOTAL_TAGIHAN);

  const methodRaw = receiptAscii(o.METODE_TRANSAKSI || 'BELUM LUNAS').toUpperCase();
  const method = methodRaw !== 'BELUM LUNAS' ? methodRaw : '';
  // Status eksplisit dari backend menang. Kalau belum ada (preview order baru), simpulkan dari metode bayar.
  const statusRaw = receiptAscii(o.STATUS_PEMBAYARAN || '').toUpperCase();
  const status = statusRaw || (method ? 'LUNAS' : 'BELUM LUNAS');

  // Struk instansi dibuat ramping: tanpa logo dan tanpa blok teks bawah
  // (catatan QRIS, PERHATIAN, kritik & saran, ucapan terima kasih).
  const orderType = typeof getOrderType === 'function' ? getOrderType(o) : { type: 'REGULER' };

  return {
    slim: orderType.type === 'INSTANSI',
    store: RECEIPT_STORE,
    dateText: receiptFormatDate(o.START ? receiptParseDate(o.START) : new Date()),
    orderNo: '#' + (receiptAscii(o.ORDER_ID || 'PREVIEW') || 'PREVIEW'),
    instansi: receiptAscii(receiptInstansiLabel(o)).toUpperCase(),
    name: receiptAscii(o.NAMA || '-').toUpperCase() || '-',
    items: items,
    extraNote: receiptNoteLines(o.RECEIPT_NOTE),
    total: total,
    status: status,
    method: method,
    paymentNote: RECEIPT_PAYMENT_NOTE,
    notes: RECEIPT_NOTES,
    feedbackTitle: RECEIPT_FEEDBACK_TITLE,
    phone: RECEIPT_STORE.phone,
    thanks: RECEIPT_THANKS
  };
}

/* ----------------------- Layout baris (dipakai preview & printer) ----------------------- */
// Hasil: array baris fisik, tiap elemen {text, align:'left'|'center', bold, logo?, feed?}
// Setiap text dijamin <= RECEIPT_COLUMNS karakter dan ASCII murni.
// logo:true  -> tempat logo raster dicetak
// feed:true  -> baris kosong penutup (agar kertas bisa disobek), tidak ditampilkan di preview

function buildReceiptLines(m) {
  const L = [];
  const add = function (text, align, bold, extra) {
    L.push(Object.assign({ text: text, align: align || 'left', bold: !!bold }, extra || {}));
  };
  const center = function (t, b) { receiptWrapText(t).forEach(function (x) { add(x, 'center', b); }); };
  const left = function (t, b) { receiptWrapText(t).forEach(function (x) { add(x, 'left', b); }); };
  const lr = function (l, r, b) { receiptLayoutLR(l, r).forEach(function (x) { add(x, 'left', b); }); };
  const blank = function () { add('', 'left', false); };
  const sep = function () { add('-'.repeat(RECEIPT_COLUMNS), 'left', false); };

  if (!m.slim) {
    add('', 'center', false, { logo: true });
    blank();
  }
  center(m.store.name, true);
  m.store.address.forEach(function (a) { center(a); });
  center(m.store.phone);
  blank();

  lr(m.dateText, m.orderNo);
  if (m.instansi) left(m.instansi, true);
  left(m.name, true);
  sep();

  m.items.forEach(function (it) {
    left(it.name, true);
    lr(it.qty + ' ' + it.unit, receiptRupiah(it.amount));
  });

  sep();
  // Keterangan tambahan: tepat di atas TOTAL
  if (m.extraNote && m.extraNote.length) {
    left('KETERANGAN:', true);
    m.extraNote.forEach(function (t) { left(t); });
    sep();
  }
  lr('TOTAL', receiptRupiah(m.total), true);
  blank();
  center(m.status, true);
  if (m.method) center('Metode: ' + m.method);
  blank();
  if (!m.slim) {
    m.paymentNote.forEach(function (x) { center(x); });
    blank();
    center('PERHATIAN', true);
    blank();
    m.notes.forEach(function (n) { center('- ' + n); blank(); });
    center(m.feedbackTitle);
    center(m.phone);
    blank();
    center(m.thanks, true);
  }
  // struk ramping lebih pendek -> beri sedikit kertas ekstra agar mudah disobek
  const feedLines = m.slim ? 6 : 4;
  for (let i = 0; i < feedLines; i++) add('', 'left', false, { feed: true });
  return L;
}

// Untuk debug di console: receiptLinesToText(buildReceiptLines(buildReceiptModel(order)))
function receiptLinesToText(lines) {
  return lines.filter(function (l) { return !l.feed; }).map(function (l) {
    if (l.logo) return '[ LOGO ]'.padStart(Math.floor((RECEIPT_COLUMNS + 8) / 2)).padEnd(RECEIPT_COLUMNS);
    if (l.align === 'center') {
      const pad = Math.max(0, Math.floor((RECEIPT_COLUMNS - l.text.length) / 2));
      return ' '.repeat(pad) + l.text;
    }
    return l.text;
  }).join('\n');
}
