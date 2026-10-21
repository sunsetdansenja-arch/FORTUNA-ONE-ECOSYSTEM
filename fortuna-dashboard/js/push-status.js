// Fortuna Laundry — "Push" status: naikkan item ke status berikutnya sekaligus.
// Memakai payload backend yang sudah ada ('update_status' per item). Tidak ada perubahan backend.
// Alur: DITERIMA → DIPROSES → QC → SIAP → SELESAI

const NEXT_STATUS = { DITERIMA: 'DIPROSES', DIPROSES: 'QC', QC: 'SIAP', SIAP: 'SELESAI' };
const NEXT_STATUS_LABEL = { DIPROSES: 'PROSES', QC: 'QC', SIAP: 'SIAP', SELESAI: 'SELESAI' };
let pushingStatus = false;

const nextItemStatus = s => NEXT_STATUS[String(s || '').toUpperCase()] || '';

// Label tombol per order: bila semua item aktif ada di status yang sama → tampilkan tujuan, kalau campur → "SEMUA".
function pushOrderLabel(order) {
  const active = (order.items || []).filter(i => nextItemStatus(i.STATUS));
  const targets = [...new Set(active.map(i => nextItemStatus(i.STATUS)))];
  return targets.length === 1 ? 'Semua → ' + NEXT_STATUS_LABEL[targets[0]] : 'Semua → berikutnya';
}

function pushSummary(targets) {
  const g = {};
  targets.forEach(t => { const k = t.from + ' → ' + t.to; g[k] = (g[k] || 0) + 1; });
  return Object.entries(g).map(([k, n]) => '• ' + n + ' item: ' + k).join('\n');
}

async function runStatusPush(targets, title) {
  if (pushingStatus) return;
  if (!targets.length) { toast('Tidak ada item yang bisa dinaikkan.', false); return; }
  if (!confirm(title + '\n\n' + pushSummary(targets) + '\n\nLanjutkan?')) return;
  pushingStatus = true;
  let ok = 0, failed = [];
  try {
    // Berurutan (bukan paralel) supaya aman untuk data table backend.
    for (let i = 0; i < targets.length; i++) {
      toast('Memproses ' + (i + 1) + '/' + targets.length + '...');
      try { await api('update_status', { ITEM_ID: targets[i].ITEM_ID, STATUS: targets[i].to }); ok++; }
      catch (e) { failed.push(targets[i].ITEM_ID + ' (' + e.message + ')'); }
    }
    await loadDashboard(true);
    if (targets.some(t => t.to === 'SIAP') && typeof loadDeadline === 'function') loadDeadline();
    if (failed.length) toast(ok + ' item berhasil, ' + failed.length + ' gagal: ' + failed.join(', '), false);
    else toast(ok + ' item berhasil dinaikkan');
  } finally {
    pushingStatus = false;
  }
}

// Tombol di satu order: semua item aktif → status berikutnya masing-masing.
function pushOrder(orderId) {
  const o = orders.find(x => String(x.ORDER_ID) === String(orderId));
  if (!o) { toast('Order tidak ditemukan. Muat ulang daftar.', false); return; }
  const targets = (o.items || []).filter(i => nextItemStatus(i.STATUS))
    .map(i => ({ ITEM_ID: i.ITEM_ID, from: String(i.STATUS).toUpperCase(), to: nextItemStatus(i.STATUS) }));
  return runStatusPush(targets, 'Naikkan status order #' + o.ORDER_ID + ' (' + (o.NAMA || '-') + ')?');
}

// Item yang akan dinaikkan oleh tombol filter: item berstatus = filter aktif pada order yang sedang tampil.
function filteredPushTargets() {
  if (statusFilter === 'ALL' || !nextItemStatus(statusFilter)) return [];
  const t = [];
  getVisibleOrders().list.forEach(o => (o.items || []).forEach(i => {
    if (String(i.STATUS || '').toUpperCase() === statusFilter) t.push({ ITEM_ID: i.ITEM_ID, from: statusFilter, to: nextItemStatus(statusFilter) });
  }));
  return t;
}
function pushFiltered() {
  const t = filteredPushTargets();
  return runStatusPush(t, 'Naikkan semua item ' + statusFilter + ' pada daftar yang tampil?');
}
// Dipanggil renderOrders(): tampilkan tombol hanya saat filter status aktif (hemat ruang).
function updatePushFilteredButton() {
  const btn = $('pushFilteredBtn');
  if (!btn) return;
  const n = filteredPushTargets().length;
  btn.classList.toggle('hidden', !n);
  if (n) btn.querySelector('span').textContent = 'Semua ' + statusFilter + ' → ' + NEXT_STATUS_LABEL[nextItemStatus(statusFilter)] + ' (' + n + ')';
}
