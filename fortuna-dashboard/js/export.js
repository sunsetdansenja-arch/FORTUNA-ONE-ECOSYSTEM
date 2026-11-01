// Fortuna Laundry — ekspor Daftar Order ke Excel (.xlsx) / CSV.
// Mengikuti filter yang sedang aktif (mode, status, pencarian, tanggal), sama seperti Cetak / PDF.
// Murni di front end & tanpa library eksternal: file .xlsx dibuat langsung di browser.

/* ---------- data ---------- */
function exportToday() {
  const d = new Date();
  return d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
}
function exportNum(v) {
  const n = Number(String(v ?? '').replace(',', '.'));
  return String(v ?? '').trim() !== '' && isFinite(n) ? n : String(v ?? '');
}
function exportStatusSummary(items) {
  const g = {};
  items.forEach(i => { const s = String(i.STATUS || '-').toUpperCase(); g[s] = (g[s] || 0) + 1; });
  const keys = Object.keys(g);
  return keys.length === 1 ? keys[0] : keys.map(k => k + '×' + g[k]).join(', ');
}

function buildOrderExport() {
  const { list } = collectPrintOrders();
  const orderRows = [], itemRows = [];
  list.forEach((o, idx) => {
    const items = o.items || [];
    const id = getOrderType(o);
    const day = orderDateFilterValue(o) || '';
    const method = String(o.METODE_TRANSAKSI || '').trim();
    const methodLabel = !method || method.toUpperCase() === 'BELUM LUNAS' ? 'Belum ditentukan' : method;
    const pay = String(o.STATUS_PEMBAYARAN || '').trim() || (method.toUpperCase() === 'BELUM LUNAS' ? 'BELUM LUNAS' : '-');
    const jenis = id.type === 'INSTANSI' ? 'Instansi' : 'Reguler';
    const paket = items.map(i => packageDisplayName(i.PAKET) + ' (' + i.BERAT + ' ' + getOrderUnit(o, i.PAKET) + ')').join('; ');
    orderRows.push([idx + 1, '#' + o.ORDER_ID, { d: day }, jenis, id.instansi || '', o.NAMA || '', String(o.NO_WA || ''), paket || '-', items.length, exportStatusSummary(items), methodLabel, pay, { m: getOrderTotalAmount(o) }]);
    items.forEach(i => itemRows.push(['#' + o.ORDER_ID, String(i.ITEM_ID || ''), { d: day }, jenis, id.instansi || '', o.NAMA || '', packageDisplayName(i.PAKET), exportNum(i.BERAT), getOrderUnit(o, i.PAKET), { m: receiptParseMoney(i.TAGIHAN) }, String(i.STATUS || '').toUpperCase(), methodLabel, pay]));
  });
  const mode = orderMode === 'INSTANSI' ? 'instansi' : 'reguler';
  const name = 'daftar-order-' + mode + (statusFilter !== 'ALL' ? '-' + statusFilter.toLowerCase() : '') + '-' + exportToday();
  return {
    name,
    sheets: [
      { title: 'Daftar Order', header: ['No', 'Order', 'Tanggal', 'Jenis', 'Instansi', 'Pelanggan', 'No WA', 'Paket', 'Jumlah Item', 'Status Item', 'Metode Pembayaran', 'Status Pembayaran', 'Total'], rows: orderRows, totalCol: 12 },
      { title: 'Detail Item', header: ['Order', 'Item ID', 'Tanggal', 'Jenis', 'Instansi', 'Pelanggan', 'Paket', 'Berat / Qty', 'Satuan', 'Tagihan', 'Status Item', 'Metode Pembayaran', 'Status Pembayaran'], rows: itemRows, totalCol: 9 }
    ]
  };
}

// Log Finance -> sheet. Urutan & filter sama dengan tampilan / Cetak PDF (getFilteredExpenses).
function buildExpenseExport() {
  const list = getFilteredExpenses();
  const method = $('expenseMethodFilter')?.value || 'ALL';
  const { from: dateFrom, to: dateTo } = typeof expenseDateRange === 'function' ? expenseDateRange() : { from: '', to: '' };
  const rows = list.map((r, idx) => {
    const day = String(r.TANGGAL || '').slice(0, 10);
    return [idx + 1, /^\d{4}-\d{2}-\d{2}$/.test(day) ? { d: day } : String(r.TANGGAL || ''), String(r.EXPENSE_ID || ''), r.KETERANGAN || '', String(r.KATEGORI || 'LAINNYA').toUpperCase(), r.METODE_TRANSAKSI || '', { m: receiptParseMoney(r.NOMINAL) }];
  });
  return {
    name: 'log-finance-' + (method !== 'ALL' ? method.toLowerCase() + '-' : '') + (dateFrom || dateTo ? (dateFrom || 'awal') + '-sd-' + (dateTo || 'sekarang') + '-' : '') + exportToday(),
    sheets: [{ title: 'Log Finance', header: ['No', 'Tanggal', 'ID', 'Keterangan', 'Kategori', 'Metode', 'Nominal'], rows, totalCol: 6 }],
    report: buildExpenseReportSheet(list)   // sheet 'Laporan Harian' (sama dengan Cetak / PDF); hanya untuk .xlsx
  };
}

// Sheet 'Laporan Harian': tata letak sama dengan Cetak / PDF.
// DEBIT = pemasukan per metode, selain DEBIT = KREDIT (pengeluaran). Total memakai rumus Excel (nilai cache ikut disimpan).
function buildExpenseReportSheet(list) {
  const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  const isDebit = r => String(r.KATEGORI || '').toUpperCase() === 'DEBIT';
  const hasTransfer = list.some(r => String(r.METODE_TRANSAKSI || '').toUpperCase() === 'TRANSFER');
  const methods = hasTransfer ? ['CASH', 'QRIS', 'TRANSFER'] : ['CASH', 'QRIS'];
  const inBy = { CASH: 0, QRIS: 0, TRANSFER: 0 };
  let inOther = 0, out = 0;
  list.forEach(r => {
    const n = receiptParseMoney(r.NOMINAL), m = String(r.METODE_TRANSAKSI || '').toUpperCase();
    if (isDebit(r)) { if (m in inBy) inBy[m] += n; else inOther += n; } else out += n;
  });
  const days = [...new Set(list.map(r => String(r.TANGGAL || '').slice(0, 10)).filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d)))].sort();
  const uniq = a => [...new Set(a)];
  const info = [
    ['Tahun', uniq(days.map(d => d.slice(0, 4))).join(' - ') || '-'],
    ['Bulan', uniq(days.map(d => MONTHS[+d.slice(5, 7) - 1])).join(' - ') || '-'],
    ['Tanggal', days.length > 1 ? days[0].slice(8, 10) + ' - ' + days[days.length - 1].slice(8, 10) : (days[0] ? days[0].slice(8, 10) : '-')]
  ];
  const cells = [], merges = [];
  const put = (r, c, spec) => cells.push([r, c, spec]);
  const ref = (r, c) => xlCol(c) + r;
  const lastCol = 5 + methods.length;                 // A..D teks, E/F kategori, lalu kolom metode
  const mStart = 6;

  // Judul
  put(1, 0, { t: 's', v: 'Laporan Harian Keuangan Fortuna Laundry', s: 6 });
  merges.push('A1:' + ref(1, lastCol));

  // Posisi tabel
  const sumCount = 2 + methods.length + (inOther ? 1 : 0) + 1;     // pemasukan per metode (+lainnya) + pengeluaran + saldo
  const hdr = Math.max(5, 2 + sumCount) + 2;
  const first = hdr + 2, last = hdr + 1 + list.length;
  const rng = c => ref(first, c) + ':' + ref(last, c);

  // Info kiri
  info.forEach((it, i) => { put(3 + i, 0, { t: 's', v: it[0], s: 0 }); put(3 + i, 2, { t: 's', v: ': ' + it[1], s: 0 }); });

  // Ringkasan kanan (label di kolom E, nilai digabung G..akhir)
  let sr = 3;
  const sumRef = {};
  const sumRow = (label, val, formula, style, key) => {
    put(sr, 4, { t: 's', v: label, s: style === 14 ? 15 : 0 });
    put(sr, mStart, { t: formula ? 'f' : 'n', v: val, f: formula, s: style });
    for (let c = mStart + 1; c <= lastCol; c++) put(sr, c, { t: 'b', s: style });
    merges.push(ref(sr, mStart) + ':' + ref(sr, lastCol));
    sumRef[key] = ref(sr, mStart);
    sr++;
  };
  methods.forEach((k, i) => sumRow('Total ' + (k === 'QRIS' ? 'Qris' : k === 'CASH' ? 'Cash' : 'Transfer'), inBy[k],
    list.length ? 'SUMIF(' + rng(4) + ',"DEBIT",' + rng(mStart + i) + ')' : null, 13, k));
  if (inOther) sumRow('Total Lainnya', inOther, null, 13, 'OTHER');
  sumRow('Total Pengeluaran', out,
    list.length ? methods.map((k, i) => 'SUMIF(' + rng(5) + ',"KREDIT",' + rng(mStart + i) + ')').join('+') : null, 13, 'OUT');
  const inKeys = [...methods, ...(inOther ? ['OTHER'] : [])];
  sumRow('Total Saldo', inBy.CASH + inBy.QRIS + inBy.TRANSFER + inOther - out,
    list.length ? inKeys.map(k => sumRef[k]).join('+') + '-' + sumRef.OUT : null, 14, 'SALDO');

  // Header tabel (2 tingkat)
  ['No', 'Tanggal', 'ID', 'Keterangan'].forEach((h, c) => {
    put(hdr, c, { t: 's', v: h, s: 8 }); put(hdr + 1, c, { t: 'b', s: 8 });
    merges.push(ref(hdr, c) + ':' + ref(hdr + 1, c));
  });
  put(hdr, 4, { t: 's', v: 'Kategori', s: 8 }); put(hdr, 5, { t: 'b', s: 8 }); merges.push(ref(hdr, 4) + ':' + ref(hdr, 5));
  put(hdr, mStart, { t: 's', v: 'Metode/Nominal', s: 8 });
  for (let c = mStart + 1; c <= lastCol; c++) put(hdr, c, { t: 'b', s: 8 });
  merges.push(ref(hdr, mStart) + ':' + ref(hdr, lastCol));
  put(hdr + 1, 4, { t: 's', v: 'DEBIT', s: 8 }); put(hdr + 1, 5, { t: 's', v: 'KREDIT', s: 8 });
  methods.forEach((k, i) => put(hdr + 1, mStart + i, { t: 's', v: k, s: 8 }));

  // Baris data
  list.forEach((r, i) => {
    const row = first + i, debit = isDebit(r), m = String(r.METODE_TRANSAKSI || '').toUpperCase();
    const day = String(r.TANGGAL || '').slice(0, 10);
    put(row, 0, { t: 'n', v: i + 1, s: 10 });
    put(row, 1, /^\d{4}-\d{2}-\d{2}$/.test(day) ? { t: 'd', v: day, s: 11 } : { t: 's', v: String(r.TANGGAL || ''), s: 10 });
    put(row, 2, { t: 's', v: String(r.EXPENSE_ID || ''), s: 9 });
    put(row, 3, { t: 's', v: String(r.KETERANGAN || ''), s: 9 });
    put(row, 4, debit ? { t: 's', v: 'DEBIT', s: 10 } : { t: 'b', s: 10 });
    put(row, 5, debit ? { t: 'b', s: 10 } : { t: 's', v: 'KREDIT', s: 10 });
    methods.forEach((k, j) => put(row, mStart + j, m === k ? { t: 'n', v: receiptParseMoney(r.NOMINAL), s: 12 } : { t: 'b', s: 12 }));
  });

  const ketW = Math.min(Math.max(...list.map(r => String(r.KETERANGAN || '').length), 14) + 2, 45);
  const cols = [5, 12, 16, ketW, 10, 10, ...methods.map(() => 15)];
  return { title: 'Laporan Harian', grid: { cols, cells, merges }, header: [], rows: [] };
}

/* ---------- CSV ---------- */
function csvCell(v) {
  if (v && typeof v === 'object') v = v.d !== undefined ? v.d : v.m;
  let s = String(v ?? '');
  if (/^[=+@]/.test(s) || /^-(?!\d)/.test(s)) s = "'" + s; // cegah formula injection
  return /[",\n\r;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
function buildCsv(sheet) {
  return '\ufeff' + [sheet.header, ...sheet.rows].map(r => r.map(csvCell).join(',')).join('\r\n');
}

/* ---------- XLSX (writer minimal: zip tanpa kompresi) ---------- */
const XL_CRC_TABLE = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function xlCrc(b) { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = XL_CRC_TABLE[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
function xlZip(files) {
  const enc = new TextEncoder();
  const now = new Date();
  const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
  const dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
  const parts = [], central = [];
  let offset = 0;
  files.forEach(f => {
    const name = enc.encode(f.name), data = enc.encode(f.data), crc = xlCrc(data);
    const lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, 0, true);
    lh.setUint16(10, dosTime, true); lh.setUint16(12, dosDate, true); lh.setUint32(14, crc, true);
    lh.setUint32(18, data.length, true); lh.setUint32(22, data.length, true); lh.setUint16(26, name.length, true); lh.setUint16(28, 0, true);
    parts.push(new Uint8Array(lh.buffer), name, data);
    const ch = new DataView(new ArrayBuffer(46));
    ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true); ch.setUint16(10, 0, true);
    ch.setUint16(12, dosTime, true); ch.setUint16(14, dosDate, true); ch.setUint32(16, crc, true);
    ch.setUint32(20, data.length, true); ch.setUint32(24, data.length, true); ch.setUint16(28, name.length, true);
    ch.setUint32(42, offset, true);
    central.push(new Uint8Array(ch.buffer), name);
    offset += 30 + name.length + data.length;
  });
  const cdSize = central.reduce((s, p) => s + p.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
  end.setUint32(12, cdSize, true); end.setUint32(16, offset, true);
  return new Blob([...parts, ...central, new Uint8Array(end.buffer)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

const xlEsc = s => String(s).replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
function xlCol(n) { let s = ''; n++; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; }
function xlDateSerial(iso) {
  const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? Math.round((Date.UTC(+m[1], +m[2] - 1, +m[3]) - Date.UTC(1899, 11, 30)) / 86400000) : null;
}
// Style: 0 normal, 1 header, 2 uang (#,##0), 3 tanggal (dd/mm/yyyy), 4 total tebal, 5 teks tebal
function xlCell(v, r, c, style) {
  const ref = xlCol(c) + r;
  if (style === 1) return `<c r="${ref}" s="1" t="inlineStr"><is><t xml:space="preserve">${xlEsc(v)}</t></is></c>`;
  if (v && typeof v === 'object') {
    if (v.d !== undefined) { const n = xlDateSerial(v.d); return n === null ? `<c r="${ref}"/>` : `<c r="${ref}" s="3"><v>${n}</v></c>`; }
    if (v.m !== undefined) return `<c r="${ref}" s="2"><v>${Number(v.m) || 0}</v></c>`;
  }
  if (typeof v === 'number') return `<c r="${ref}"><v>${v}</v></c>`;
  const s = String(v ?? '');
  return s === '' ? `<c r="${ref}"/>` : `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${xlEsc(s)}</t></is></c>`;
}
// Sheet berbentuk grid bebas (sel gabungan, border, rumus). Dipakai Laporan Harian.
// cell spec: {t:'s'|'n'|'d'|'f'|'b', v, f, s}  (b = sel kosong bergaya)
function xlGridXml(sheet) {
  const g = sheet.grid, byRow = {};
  g.cells.forEach(([r, c, sp]) => { (byRow[r] = byRow[r] || []).push([c, sp]); });
  const one = (r, c, sp) => {
    const a = xlCol(c) + r, st = ' s="' + (sp.s || 0) + '"';
    if (sp.t === 's') return `<c r="${a}"${st} t="inlineStr"><is><t xml:space="preserve">${xlEsc(sp.v)}</t></is></c>`;
    if (sp.t === 'n') return `<c r="${a}"${st}><v>${Number(sp.v) || 0}</v></c>`;
    if (sp.t === 'd') { const n = xlDateSerial(sp.v); return n === null ? `<c r="${a}"${st}/>` : `<c r="${a}"${st}><v>${n}</v></c>`; }
    if (sp.t === 'f') return sp.f ? `<c r="${a}"${st}><f>${xlEsc(sp.f)}</f><v>${Number(sp.v) || 0}</v></c>` : `<c r="${a}"${st}><v>${Number(sp.v) || 0}</v></c>`;
    return `<c r="${a}"${st}/>`;
  };
  let xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><sheetViews><sheetView workbookViewId="0" showGridLines="0"/></sheetViews><cols>'
    + g.cols.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('') + '</cols><sheetData>';
  Object.keys(byRow).map(Number).sort((a, b) => a - b).forEach(r => {
    xml += `<row r="${r}">` + byRow[r].sort((a, b) => a[0] - b[0]).map(([c, sp]) => one(r, c, sp)).join('') + '</row>';
  });
  xml += '</sheetData>' + (g.merges.length ? `<mergeCells count="${g.merges.length}">` + g.merges.map(m => `<mergeCell ref="${m}"/>`).join('') + '</mergeCells>' : '')
    + '<pageMargins left="0.4" right="0.4" top="0.5" bottom="0.5" header="0.3" footer="0.3"/><pageSetup paperSize="9" orientation="portrait" fitToWidth="1" fitToHeight="0"/></worksheet>';
  return xml;
}
function xlSheetXml(sheet) {
  if (sheet.grid) return xlGridXml(sheet);
  const n = sheet.header.length, rows = sheet.rows;
  const widths = sheet.header.map((h, c) => {
    let w = String(h).length;
    rows.forEach(r => { const v = r[c]; const t = v && typeof v === 'object' ? (v.d !== undefined ? '00/00/0000' : '0.000.000') : String(v ?? ''); w = Math.max(w, Math.min(t.length, 60)); });
    return Math.min(Math.max(w + 2, 8), 60);
  });
  let xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>'
    + widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('') + '</cols><sheetData>';
  xml += '<row r="1">' + sheet.header.map((h, c) => xlCell(h, 1, c, 1)).join('') + '</row>';
  rows.forEach((row, i) => { xml += `<row r="${i + 2}">` + row.map((v, c) => xlCell(v, i + 2, c, 0)).join('') + '</row>'; });
  const last = rows.length + 1;
  if (rows.length && sheet.totalCol !== undefined) {
    const total = rows.reduce((s, r) => s + (Number(r[sheet.totalCol].m) || 0), 0);
    const tr = last + 1, col = xlCol(sheet.totalCol);
    xml += `<row r="${tr}"><c r="${xlCol(sheet.totalCol - 1)}${tr}" s="5" t="inlineStr"><is><t>Total</t></is></c><c r="${col}${tr}" s="4"><f>SUM(${col}2:${col}${last})</f><v>${total}</v></c></row>`;
  }
  xml += '</sheetData>' + (rows.length ? `<autoFilter ref="A1:${xlCol(n - 1)}${last}"/>` : '') + '</worksheet>';
  return xml;
}
function buildXlsx(sheets) {
  const X = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
  const files = [
    { name: '[Content_Types].xml', data: X + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' + sheets.map((s, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('') + '</Types>' },
    { name: '_rels/.rels', data: X + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>' },
    { name: 'xl/workbook.xml', data: X + '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' + sheets.map((s, i) => `<sheet name="${xlEsc(s.title)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('') + '</sheets></workbook>' },
    { name: 'xl/_rels/workbook.xml.rels', data: X + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + sheets.map((s, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('') + `<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>` },
    { name: 'xl/styles.xml', data: X + '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="3"><numFmt numFmtId="164" formatCode="dd/mm/yyyy"/><numFmt numFmtId="165" formatCode="#,##0"/><numFmt numFmtId="166" formatCode="&quot;Rp &quot;#,##0;-&quot;Rp &quot;#,##0"/></numFmts><fonts count="4"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="14"/><name val="Calibri"/></font></fonts><fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF0F5A47"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF1F1F1"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color auto="1"/></left><right style="thin"><color auto="1"/></right><top style="thin"><color auto="1"/></top><bottom style="thin"><color auto="1"/></bottom><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="16"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center"/></xf><xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"><alignment horizontal="left"/></xf><xf numFmtId="165" fontId="2" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1"/><xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="2" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf><xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf><xf numFmtId="166" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf><xf numFmtId="166" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="right"/></xf><xf numFmtId="166" fontId="2" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1" applyAlignment="1"><alignment horizontal="right"/></xf><xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>' },
    ...sheets.map((s, i) => ({ name: `xl/worksheets/sheet${i + 1}.xml`, data: xlSheetXml(s) }))
  ];
  return xlZip(files);
}

/* ---------- unduh & UI ---------- */
function exportDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
function exportOrders(format) {
  closeExportMenu();
  let data;
  try { data = buildOrderExport(); } catch (e) { toast('Gagal menyiapkan ekspor: ' + e.message, false); return; }
  if (!data.sheets[0].rows.length) { toast('Tidak ada order untuk diekspor. Cek filter.', false); return; }
  try {
    if (format === 'csv') exportDownload(new Blob([buildCsv(data.sheets[0])], { type: 'text/csv;charset=utf-8' }), data.name + '.csv');
    else exportDownload(buildXlsx(data.sheets), data.name + '.xlsx');
    toast(data.sheets[0].rows.length + ' order diekspor ke ' + (format === 'csv' ? 'CSV' : 'Excel'));
  } catch (e) { toast('Ekspor gagal: ' + e.message, false); }
}

function exportExpenses(format) {
  closeExportMenu();
  let data;
  try { data = buildExpenseExport(); } catch (e) { toast('Gagal menyiapkan ekspor: ' + e.message, false); return; }
  if (!data.sheets[0].rows.length) { toast('Tidak ada expense untuk diekspor. Cek filter.', false); return; }
  try {
    if (format === 'csv') exportDownload(new Blob([buildCsv(data.sheets[0])], { type: 'text/csv;charset=utf-8' }), data.name + '.csv');
    else exportDownload(buildXlsx([data.report, ...data.sheets]), data.name + '.xlsx');
    toast(data.sheets[0].rows.length + ' transaksi diekspor ke ' + (format === 'csv' ? 'CSV' : 'Excel'));
  } catch (e) { toast('Ekspor gagal: ' + e.message, false); }
}

// Menu dropdown memakai posisi fixed agar tidak terpotong card. id menu opsional (default: menu Daftar Order).
const EXPORT_MENU_IDS = ['exportMenu', 'expenseExportMenu'];
function toggleExportMenu(ev, id) {
  ev.stopPropagation();
  const menu = $(id || 'exportMenu');
  const wasOpen = !menu.classList.contains('hidden');
  closeExportMenu();
  if (wasOpen) return;
  const r = ev.currentTarget.getBoundingClientRect();
  menu.classList.remove('hidden');
  const w = menu.offsetWidth;
  menu.style.top = (r.bottom + 6) + 'px';
  menu.style.left = Math.max(8, Math.min(r.right - w, window.innerWidth - w - 8)) + 'px';
}
function closeExportMenu() { EXPORT_MENU_IDS.forEach(id => { const m = $(id); if (m) m.classList.add('hidden'); }); }
document.addEventListener('click', e => { const open = EXPORT_MENU_IDS.map(id => $(id)).filter(m => m && !m.classList.contains('hidden')); if (open.length && !open.some(m => m.contains(e.target))) closeExportMenu(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeExportMenu(); });
window.addEventListener('scroll', closeExportMenu, true);
window.addEventListener('resize', closeExportMenu);
