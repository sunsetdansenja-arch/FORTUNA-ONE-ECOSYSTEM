// Fortuna Laundry — receipt module (preview + alur simpan/cetak)
//
// Isi struk SELALU berasal dari receipt-model.js (buildReceiptModel / buildReceiptLines).
// File ini hanya MENAMPILKAN (preview) dan menjalankan alur simpan/cetak.
// Bergantung pada: receipt-model.js, printer.js, config.js ($, esc, rupiah, toast, globals), orders.js, whatsapp.js

// 'printer' = tampilan persis baris yang dikirim ke printer 58 mm (default)
// 'paper'   = tampilan nota seperti dulu
const RECEIPT_DEFAULT_VIEW = 'printer';
let receiptViewMode = RECEIPT_DEFAULT_VIEW;
let receiptLastOrder = null;

function ensureReceiptStyles() {
  if (document.getElementById('receiptExtraStyles')) return;
  const s = document.createElement('style');
  s.id = 'receiptExtraStyles';
  s.textContent =
    '.receipt-view-tabs{display:flex;gap:6px;margin-bottom:8px;justify-content:center}' +
    '.receipt-view-tabs button{font-size:11px;font-weight:800;padding:5px 11px;border-radius:999px;background:#e2e8f0;color:#475569}' +
    '.receipt-view-tabs button.on{background:#0f5a47;color:#fff}' +
    '.receipt-raw{width:32ch;background:#fff;color:#111;padding:10px 12px;box-sizing:content-box;' +
    'font:14px/1.35 ui-monospace,SFMono-Regular,Menlo,Consolas,"Courier New",monospace}' +
    '.receipt-raw .ln{white-space:pre;min-height:1.35em}' +
    '.receipt-raw .c{text-align:center}' +
    '.receipt-raw img{display:block;margin:0 auto}' +
    '.receipt-raw-hint{font-size:10px;color:#64748b;text-align:center;margin-top:6px}';
  document.head.appendChild(s);
}

/* ----------------------- Renderer 1: persis printer ----------------------- */

function receiptRawHTML(m) {
  const lines = buildReceiptLines(m).filter(function (l) { return !l.feed; });
  const logoPct = (typeof LOGO_WIDTH !== 'undefined' && typeof PRINTER_WIDTH !== 'undefined')
    ? Math.round(LOGO_WIDTH / PRINTER_WIDTH * 100) : 42;
  const hasLogo = typeof FORTUNA_LOGO_PNG !== 'undefined' && FORTUNA_LOGO_PNG;
  const body = lines.map(function (l) {
    if (l.logo) {
      return hasLogo ? '<div class="ln"><img src="' + FORTUNA_LOGO_PNG + '" alt="" style="width:' + logoPct + '%"></div>' : '';
    }
    const t = esc(l.text);
    return '<div class="ln' + (l.align === 'center' ? ' c' : '') + '">' + (l.bold ? '<b>' + t + '</b>' : t) + '</div>';
  }).join('');
  return '<div class="receipt-raw">' + body + '</div>';
}

/* ----------------------- Renderer 2: tampilan nota ----------------------- */

function receiptPaperHTML(m) {
  const hasLogo = typeof FORTUNA_LOGO_PNG !== 'undefined' && FORTUNA_LOGO_PNG;
  const logo = hasLogo ? '<img src="' + FORTUNA_LOGO_PNG + '" alt="Fortuna Laundry">' : '';
  return `<div class="receipt">
    <div style="text-align:center">${logo}<div class="receipt-brand">${esc(m.store.name)}</div>${m.store.address.map(a => `<div class="receipt-sub">${esc(a)}</div>`).join('')}<div class="receipt-sub">${esc(m.store.phone)}</div></div>
    <div class="row" style="margin-top:6px"><span>${esc(m.dateText)}</span><b>${esc(m.orderNo)}</b></div>
    ${m.instansi ? `<div style="font-weight:800;margin-top:2px">${esc(m.instansi)}</div>` : ''}
    <div style="font-weight:800;margin-top:2px">${esc(m.name)}</div>
    <hr>
    ${m.items.map(it => `<div class="item"><div class="item-name">${it.no}. ${esc(it.name)}</div><div class="item-meta"><span>${esc(it.qty)} ${esc(it.unit)}</span><span>${esc(receiptRupiah(it.amount))}</span></div></div>`).join('')}
    <hr>
    <div class="row total"><span>TOTAL</span><span>${esc(receiptRupiah(m.total))}</span></div>
    <div style="text-align:center;font-weight:800;margin-top:6px">${esc(m.status)}</div>
    ${m.method ? `<div style="text-align:center;font-size:10px">Metode: ${esc(m.method)}</div>` : ''}
    <div style="text-align:center;margin-top:5px;font-size:10px">${esc(m.paymentNote.join(' '))}</div>
    <div class="note-title">PERHATIAN</div>
    <div class="notes">${m.notes.map(n => `- ${esc(n)}`).join('<br><br>')}</div>
    <div class="footer">${esc(m.feedbackTitle)}<br>${esc(m.phone)}<br><br>${esc(m.thanks)}</div>
  </div>`;
}

/* --------------------------- Preview (dipanggil orders.js) --------------------------- */

// Tetap bernama receiptHTML(o) agar orders.js tidak perlu diubah.
// Mengembalikan tab pilihan tampilan + struk sesuai mode yang aktif.
function receiptHTML(o) {
  ensureReceiptStyles();
  receiptLastOrder = o;
  const m = buildReceiptModel(o);
  const tab = (mode, label) =>
    `<button type="button" class="${receiptViewMode === mode ? 'on' : ''}" onclick="setReceiptView('${mode}')">${label}</button>`;
  const raw = receiptViewMode === 'printer';
  const hint = raw ? '<div class="receipt-raw-hint">Sama persis dengan baris yang dikirim ke printer 58 mm.</div>' : '';
  return `<div style="display:flex;flex-direction:column;align-items:center;width:100%">
    <div class="receipt-view-tabs">${tab('printer', 'Sesuai printer')}${tab('paper', 'Tampilan nota')}</div>
    ${raw ? receiptRawHTML(m) : receiptPaperHTML(m)}${hint}
  </div>`;
}

function setReceiptView(mode) {
  receiptViewMode = mode === 'paper' ? 'paper' : 'printer';
  const box = $('receiptPreview');
  if (box && receiptLastOrder) box.innerHTML = receiptHTML(receiptLastOrder);
}

function setPreviewButtons(mode) {
  const create = mode === 'create';
  $('previewCreatePrint').classList.toggle('hidden', !create);
  $('previewCreatePrintWa').classList.toggle('hidden', !create);
  $('previewCreateSave').classList.toggle('hidden', !create);
  $('previewReprint').classList.toggle('hidden', create);
}

function openPrintPreview(o) {
  previewMode = 'reprint'; previewOrder = o;
  $('receiptPreview').innerHTML = receiptHTML(o);
  $('previewTitle').textContent = 'Preview Struk';
  $('previewSubtitle').textContent = 'Order #' + o.ORDER_ID + ' • siap untuk dicetak';
  setPreviewButtons('reprint');
  $('previewModal').classList.add('show');
  document.body.classList.add('overflow-hidden');
}

async function confirmReprint() {
  if (!previewOrder || busy) return;
  try {
    busy = true;
    const r = await printReceipt(previewOrder);
    closeModal('previewModal');
    const noLogo = !!(r && r.logoSkipped);
    toast('Struk #' + previewOrder.ORDER_ID + ' dikirim ke printer' + (noLogo ? ' (tanpa logo, logo gagal dimuat)' : ''), !noLogo);
  } catch (e) {
    toast('Printer: ' + e.message, false);
  } finally {
    busy = false;
  }
}

/* ------------------------------ Simpan + cetak ------------------------------ */

async function confirmCreate(print, sendWa) {
  if (busy || !draft) return;
  busy = true;
  try {
    const res = await api('order_create', draft);
    const o = res.data;
    const full = { ...draft, ...o };

    closeModal('previewModal');
    $('f-nama').value = '';
    $('f-wa').value = '';
    $('f-payment').value = 'BELUM LUNAS';
    $('packageRows').innerHTML = '';
    addPackage();
    calcTotal();

    // Order sudah tersimpan: kalau refresh dashboard gagal, cetak tetap harus jalan.
    try { await loadDashboard(true); } catch (err) { console.warn('[receipt] loadDashboard gagal:', err); }

    let printFailed = false;
    let printNote = '';
    if (print) {
      try {
        const r = await printReceipt(full);
        if (r && r.logoSkipped) printNote = ' (struk tercetak tanpa logo)';
      } catch (err) {
        printFailed = true;
        toast('Order #' + o.ORDER_ID + ' tersimpan, tetapi cetak gagal: ' + err.message + ' Cetak ulang dari tabel order.', false);
      }
    }

    if (sendWa) {
      const n = normalizeWaNumber(full.NO_WA);
      const link = buildStatusLink(full);
      if (n) {
        const m = buildReceiptModel(full);
        const items = Array.isArray(full.items) ? full.items : [];
        const itemText = items
          .map((x, i) => `- ${x.PAKET || '-'} — ${x.BERAT || 0} ${(m.items[i] || {}).unit || 'kg'}`)
          .join('\n');
        const msg = [
          'Halo ' + (full.NAMA || 'Customer') + ',',
          '',
          'Terima kasih sudah menggunakan Fortuna Laundry.',
          '',
          'Pesanan #' + full.ORDER_ID + ' sudah kami terima.',
          itemText,
          '',
          'Total: ' + rupiah(m.total),
          '',
          'Cek status cucian:',
          link || 'Link status akan tersedia di customer dashboard.',
          '',
          'Terima kasih.',
          'Fortuna Laundry'
        ].join('\n');
        window.open('https://wa.me/' + n + '?text=' + encodeURIComponent(msg), '_blank');
      } else {
        toast('Order tersimpan, tetapi nomor WhatsApp customer kosong.', false);
      }
    }

    // Jangan menimpa toast error cetak dengan toast sukses.
    if (!printFailed) toast('Order #' + o.ORDER_ID + ' berhasil disimpan' + printNote);
  } catch (e) {
    toast(e.message, false);
  } finally {
    busy = false;
  }
}

async function printOrder(id) {
  const o = orders.find(x => x.ORDER_ID === id);
  if (!o) return;
  openPrintPreview(o);
}
