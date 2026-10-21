// Fortuna Laundry — finance module
// Tab Finance: omset, profit, pemasukan (Reguler / Instansi / Overall) + laporan.
// Memakai payload backend yang sudah ada: 'read' (order) dan 'expense_read' (pengeluaran).
// Tidak ada perubahan backend.

const FIN_PIN = '8888'; // PIN hardcode — ubah di sini bila perlu
const FIN_INSTITUTIONS = ['SECATA', 'SECABA', 'PUSPOMAD'];
const FIN_METHODS = ['CASH', 'QRIS', 'TRANSFER'];
const FIN_TX_PAGE = 25;

let finUnlocked = false;
let finOrders = [];
let finExpenses = [];
let finLoading = false;
let finPinValue = '';
let finTxLimit = FIN_TX_PAGE;
const finFilter = { preset: 'month', from: '', to: '', scope: 'ALL', inst: 'ALL', txStatus: 'ALL', txQuery: '' };

/* ---------- helpers ---------- */
const finISO = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const finDay = v => { const m = String(v || '').match(/^(\d{4}-\d{2}-\d{2})/); return m ? m[1] : ''; };
const finMoney = v => (typeof receiptParseMoney === 'function' ? receiptParseMoney(v) : (Number(String(v ?? '').replace(/[^0-9.-]/g, '')) || 0));
const finPct = (a, b) => (b > 0 ? Math.round((a / b) * 1000) / 10 : 0);
const finPctText = (a, b) => (b > 0 ? String(finPct(a, b)).replace('.', ',') + '%' : '0%');
const finFmtDate = v => { const d = finDay(v); return d ? d.split('-').reverse().join('/') : '-'; };
const finOrderDate = o => (typeof orderDateFilterValue === 'function' ? orderDateFilterValue(o) : finDay(o && o.START));
const finOrderTotal = o => (typeof getOrderTotalAmount === 'function' ? getOrderTotalAmount(o) : finMoney(o && o.TOTAL_TAGIHAN));
const finIsPaid = o => String(o && o.STATUS_PEMBAYARAN || '').toUpperCase() === 'LUNAS';
const finMethodOf = o => String(o && o.METODE_TRANSAKSI || '').toUpperCase();
const finIdentity = o => (typeof getOrderType === 'function' ? getOrderType(o) : { type: 'REGULER', instansi: '' });
const finPkgName = n => (typeof packageDisplayName === 'function' ? packageDisplayName(n) : String(n || ''));
const finSet = (id, html) => { const el = $(id); if (el) el.innerHTML = html; };
const finMonthLabel = ym => { const [y, m] = ym.split('-'); return ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'][Number(m) - 1] + ' ' + y.slice(2); };

/* ---------- PIN ---------- */
function financePinRender() {
  const dots = $('finPinDots');
  if (dots) dots.innerHTML = [0, 1, 2, 3].map(i => `<span class="${i < finPinValue.length ? 'on' : ''}"></span>`).join('');
}
function openFinancePin() {
  finPinValue = '';
  financePinRender();
  const err = $('finPinError'); if (err) err.textContent = '';
  $('financePinModal').classList.add('show');
  document.body.classList.add('overflow-hidden');
}
function closeFinancePin() {
  $('financePinModal').classList.remove('show');
  document.body.classList.remove('overflow-hidden');
  finPinValue = '';
}
function financePinKey(k) {
  const err = $('finPinError');
  if (k === 'C') finPinValue = '';
  else if (k === 'BACK') finPinValue = finPinValue.slice(0, -1);
  else if (/^\d$/.test(k) && finPinValue.length < 4) finPinValue += k;
  if (err) err.textContent = '';
  financePinRender();
  if (finPinValue.length === 4) setTimeout(financePinSubmit, 120);
}
function financePinSubmit() {
  if (finPinValue === FIN_PIN) {
    closeFinancePin();
    finUnlocked = true;
    showTab('finance');
    return;
  }
  const box = $('finPinBox');
  if (box) { box.classList.remove('fin-shake'); void box.offsetWidth; box.classList.add('fin-shake'); }
  const err = $('finPinError'); if (err) err.textContent = 'PIN salah. Coba lagi.';
  finPinValue = '';
  financePinRender();
}
document.addEventListener('keydown', e => {
  const modal = $('financePinModal');
  if (!modal || !modal.classList.contains('show')) return;
  if (/^\d$/.test(e.key)) { financePinKey(e.key); e.preventDefault(); }
  else if (e.key === 'Backspace') { financePinKey('BACK'); e.preventDefault(); }
  else if (e.key === 'Escape') closeFinancePin();
});

// Dipanggil showTab() saat meninggalkan tab Finance: kunci ulang & buang data dari memori/DOM.
function lockFinance() {
  finUnlocked = false;
  finOrders = [];
  finExpenses = [];
  ['finKpis', 'finStats', 'finCompare', 'finInstitutions', 'finMethods', 'finTrend', 'finPackages', 'finExpenseBreak', 'finReceivables', 'finTxBody']
    .forEach(id => finSet(id, ''));
}

/* ---------- filter / periode ---------- */
function finSetPreset(preset) {
  const now = new Date();
  const y = now.getFullYear(), m = now.getMonth();
  let from = '', to = '';
  if (preset === 'today') { from = to = finISO(now); }
  else if (preset === '7d') { const s = new Date(now); s.setDate(s.getDate() - 6); from = finISO(s); to = finISO(now); }
  else if (preset === 'month') { from = finISO(new Date(y, m, 1)); to = finISO(now); }
  else if (preset === 'lastmonth') { from = finISO(new Date(y, m - 1, 1)); to = finISO(new Date(y, m, 0)); }
  else if (preset === 'year') { from = finISO(new Date(y, 0, 1)); to = finISO(now); }
  finFilter.preset = preset; finFilter.from = from; finFilter.to = to;
  if ($('finDateFrom')) $('finDateFrom').value = from;
  if ($('finDateTo')) $('finDateTo').value = to;
  finTxLimit = FIN_TX_PAGE;
  finRender();
}
function finApplyDates() {
  const from = $('finDateFrom').value, to = $('finDateTo').value;
  if (from && to && from > to) { toast('Tanggal mulai tidak boleh setelah tanggal akhir.', false); return; }
  finFilter.preset = 'custom'; finFilter.from = from; finFilter.to = to;
  finTxLimit = FIN_TX_PAGE;
  finRender();
}
function finSetScope(scope) {
  finFilter.scope = scope;
  if (scope !== 'INSTANSI') finFilter.inst = 'ALL';
  finTxLimit = FIN_TX_PAGE;
  finRender();
}
function finSetInst(v) { finFilter.inst = v; finTxLimit = FIN_TX_PAGE; finRender(); }
function finSetTx() {
  finFilter.txStatus = $('finTxStatus').value;
  finFilter.txQuery = String($('finTxSearch').value || '').trim().toLowerCase();
  finTxLimit = FIN_TX_PAGE;
  finRenderTx();
}
function finMoreTx() { finTxLimit = Infinity; finRenderTx(); }

// Dipanggil showTab() saat tab Finance baru dibuka (setelah PIN benar): reset filter lalu muat data.
function finOpen() {
  finFilter.scope = 'ALL'; finFilter.inst = 'ALL'; finFilter.txStatus = 'ALL'; finFilter.txQuery = '';
  if ($('finTxStatus')) $('finTxStatus').value = 'ALL';
  if ($('finTxSearch')) $('finTxSearch').value = '';
  finSetPreset('month');
  loadFinance(true);
}

/* ---------- data ---------- */
async function loadFinance(silent = false) {
  if (!finUnlocked || finLoading) return;
  finLoading = true;
  const hint = $('finLoading'); if (hint) hint.classList.remove('hidden');
  try {
    const [a, b] = await Promise.all([api('read'), api('expense_read')]);
    finOrders = Array.isArray(a?.data?.orders) ? a.data.orders : [];
    finExpenses = Array.isArray(b?.data?.expenses) ? b.data.expenses : [];
    finRender();
    if (!silent) toast('Data finance berhasil diperbarui');
  } catch (e) {
    toast('Finance gagal dimuat: ' + e.message, false);
  } finally {
    finLoading = false;
    if (hint) hint.classList.add('hidden');
  }
}

function finInRange(day) {
  if (!day) return !finFilter.from && !finFilter.to;
  if (finFilter.from && day < finFilter.from) return false;
  if (finFilter.to && day > finFilter.to) return false;
  return true;
}
function finRangeOrders() { return finOrders.filter(o => finInRange(finOrderDate(o))); }
function finRangeExpenses() { return finExpenses.filter(e => finInRange(finDay(e.TANGGAL))); }
function finScopeMatch(o) {
  if (finFilter.scope === 'ALL') return true;
  const id = finIdentity(o);
  if (id.type !== finFilter.scope) return false;
  if (finFilter.scope === 'INSTANSI' && finFilter.inst !== 'ALL' && id.instansi !== finFilter.inst) return false;
  return true;
}

function finAgg(list) {
  const r = { count: list.length, omset: 0, paid: 0, unpaid: 0, unpaidCount: 0, items: 0, methods: { CASH: 0, QRIS: 0, TRANSFER: 0 } };
  list.forEach(o => {
    const t = finOrderTotal(o);
    r.omset += t;
    r.items += Array.isArray(o.items) ? o.items.length : 0;
    if (finIsPaid(o)) {
      r.paid += t;
      const m = finMethodOf(o);
      if (r.methods[m] !== undefined) r.methods[m] += t;
    } else { r.unpaid += t; r.unpaidCount++; }
  });
  return r;
}
const finExpTotal = list => list.reduce((s, e) => s + finMoney(e.NOMINAL), 0);

/* ---------- render ---------- */
function finScopeLabel() {
  if (finFilter.scope === 'REGULER') return 'Reguler';
  if (finFilter.scope === 'INSTANSI') return finFilter.inst === 'ALL' ? 'Semua Instansi' : 'Instansi ' + finFilter.inst;
  return 'Overall';
}
function finPeriodLabel() {
  const f = finFilter.from, t = finFilter.to;
  if (!f && !t) return 'Semua periode';
  return (f ? finFmtDate(f) : 'Awal data') + ' — ' + (t ? finFmtDate(t) : 'Hari ini');
}

function finRender() {
  if (!finUnlocked) return;
  // kontrol filter
  document.querySelectorAll('[data-fin-preset]').forEach(b => b.classList.toggle('active', b.dataset.finPreset === finFilter.preset));
  document.querySelectorAll('[data-fin-scope]').forEach(b => b.classList.toggle('active', b.dataset.finScope === finFilter.scope));
  const instWrap = $('finInstWrap'); if (instWrap) instWrap.classList.toggle('hidden', finFilter.scope !== 'INSTANSI');
  if ($('finInst')) $('finInst').value = finFilter.inst;
  if ($('finPeriodLabel')) $('finPeriodLabel').textContent = finPeriodLabel() + ' • ' + finScopeLabel();

  const range = finRangeOrders();
  const scoped = range.filter(finScopeMatch);
  const exps = finRangeExpenses();
  const a = finAgg(scoped);
  const expTotal = finExpTotal(exps);
  const isAll = finFilter.scope === 'ALL';
  const profit = a.omset - expTotal;
  const cash = a.paid - expTotal;

  // KPI
  const na = '<span class="fin-na">—</span>';
  const cls = n => (n < 0 ? 'neg' : 'pos');
  finSet('finKpis', [
    ['OMSET', rupiah(a.omset), a.count + ' order • total tagihan', 'dark'],
    ['PEMASUKAN DITERIMA', rupiah(a.paid), finPctText(a.paid, a.omset) + ' dari omset (lunas)', 'pos'],
    ['PIUTANG', rupiah(a.unpaid), a.unpaidCount + ' order belum lunas', a.unpaid > 0 ? 'warn' : 'dark'],
    ['PENGELUARAN', isAll ? rupiah(expTotal) : na, isAll ? exps.length + ' transaksi' : 'Hanya di tampilan Overall', 'dark'],
    ['PROFIT', isAll ? rupiah(profit) : na, isAll ? 'Omset − pengeluaran • margin ' + (a.omset > 0 ? String(finPct(profit, a.omset)).replace('.', ',') : '0') + '%' : 'Hanya di tampilan Overall', isAll ? cls(profit) : 'dark'],
    ['SALDO KAS BERSIH', isAll ? rupiah(cash) : na, isAll ? 'Pemasukan diterima − pengeluaran' : 'Hanya di tampilan Overall', isAll ? cls(cash) : 'dark']
  ].map(k => `<div class="card fin-kpi ${k[3]}"><div class="fin-kpi-label">${k[0]}</div><div class="fin-kpi-value">${k[1]}</div><div class="fin-kpi-sub">${k[2]}</div></div>`).join(''));

  // statistik ringkas
  finSet('finStats', [
    ['Jumlah order', a.count],
    ['Jumlah item', a.items],
    ['Rata-rata / order', rupiah(a.count ? Math.round(a.omset / a.count) : 0)],
    ['Tingkat pelunasan', finPctText(a.paid, a.omset)]
  ].map(s => `<div class="fin-stat"><span>${s[0]}</span><b>${s[1]}</b></div>`).join(''));

  finRenderCompare(range, exps);
  finRenderInstitutions(range);
  finRenderMethods(a, exps, isAll);
  finRenderTrend(scoped, exps, isAll);
  finRenderPackages(scoped, a.omset);
  finRenderExpenseBreak(exps, expTotal);
  finRenderReceivables(scoped);
  finRenderTx();
}

function finRenderCompare(range, exps) {
  const reg = finAgg(range.filter(o => finIdentity(o).type === 'REGULER'));
  const ins = finAgg(range.filter(o => finIdentity(o).type === 'INSTANSI'));
  const all = finAgg(range);
  const expTotal = finExpTotal(exps);
  const share = (x) => finPctText(x.omset, all.omset);
  const row = (label, f, cls = '') => `<tr class="${cls}"><th>${label}</th><td>${f(reg)}</td><td>${f(ins)}</td><td>${f(all)}</td></tr>`;
  finSet('finCompare', `<table class="fin-table fin-compare"><thead><tr><th></th><th>Reguler</th><th>Instansi</th><th>Overall</th></tr></thead><tbody>
    ${row('Order', x => x.count)}
    ${row('Omset', x => rupiah(x.omset), 'strong')}
    ${row('Pemasukan diterima', x => rupiah(x.paid), 'good')}
    ${row('Piutang', x => rupiah(x.unpaid), 'bad')}
    ${row('Kontribusi omset', share)}
    <tr><th>Pengeluaran</th><td class="fin-na">—</td><td class="fin-na">—</td><td>${rupiah(expTotal)}</td></tr>
    <tr class="strong"><th>Profit</th><td class="fin-na">—</td><td class="fin-na">—</td><td class="${all.omset - expTotal < 0 ? 'neg' : 'pos'}">${rupiah(all.omset - expTotal)}</td></tr>
  </tbody></table><p class="fin-note">Pengeluaran belum dipisah per jenis order di backend, jadi profit hanya dihitung untuk Overall.</p>`);
}

function finRenderInstitutions(range) {
  const rows = FIN_INSTITUTIONS.map(name => ({ name, a: finAgg(range.filter(o => { const i = finIdentity(o); return i.type === 'INSTANSI' && i.instansi === name; })) }));
  const totalOmset = rows.reduce((s, r) => s + r.a.omset, 0);
  finSet('finInstitutions', rows.map(r => `<div class="fin-row">
    <div class="fin-row-top"><b>${r.name}</b><span>${rupiah(r.a.omset)}</span></div>
    <div class="fin-bar"><span style="width:${finPct(r.a.omset, totalOmset)}%"></span></div>
    <div class="fin-row-sub">${r.a.count} order • diterima ${rupiah(r.a.paid)} • piutang ${rupiah(r.a.unpaid)}</div>
  </div>`).join(''));
}

function finRenderMethods(a, exps, isAll) {
  const out = { CASH: 0, QRIS: 0, TRANSFER: 0 };
  exps.forEach(e => { const m = String(e.METODE_TRANSAKSI || 'CASH').toUpperCase(); if (out[m] !== undefined) out[m] += finMoney(e.NOMINAL); });
  finSet('finMethods', FIN_METHODS.map(m => `<div class="fin-row">
    <div class="fin-row-top"><b>${m}</b><span>${rupiah(a.methods[m])}</span></div>
    <div class="fin-bar"><span style="width:${finPct(a.methods[m], a.paid)}%"></span></div>
    <div class="fin-row-sub">${finPctText(a.methods[m], a.paid)} dari pemasukan${isAll ? ' • keluar ' + rupiah(out[m]) + ' • bersih ' + rupiah(a.methods[m] - out[m]) : ''}</div>
  </div>`).join(''));
}

function finRenderTrend(scoped, exps, isAll) {
  // Tentukan rentang bucket
  const days = [...scoped.map(o => finOrderDate(o)), ...(isAll ? exps.map(e => finDay(e.TANGGAL)) : [])].filter(Boolean).sort();
  let from = finFilter.from || days[0] || '', to = finFilter.to || days[days.length - 1] || '';
  if (!from || !to) { finSet('finTrend', '<div class="fin-empty">Belum ada data pada periode ini.</div>'); return; }
  const spanDays = Math.round((new Date(to + 'T00:00:00') - new Date(from + 'T00:00:00')) / 86400000) + 1;
  const monthly = spanDays > 45;
  const keyOf = d => (monthly ? d.slice(0, 7) : d);
  const buckets = new Map();
  if (monthly) {
    let [y, m] = from.split('-').map(Number); const [ty, tm] = to.split('-').map(Number);
    while (y < ty || (y === ty && m <= tm)) { buckets.set(y + '-' + String(m).padStart(2, '0'), { o: 0, e: 0 }); m++; if (m > 12) { m = 1; y++; } }
  } else {
    const d = new Date(from + 'T00:00:00'); const end = new Date(to + 'T00:00:00');
    while (d <= end) { buckets.set(finISO(d), { o: 0, e: 0 }); d.setDate(d.getDate() + 1); }
  }
  scoped.forEach(o => { const b = buckets.get(keyOf(finOrderDate(o) || '')); if (b) b.o += finOrderTotal(o); });
  if (isAll) exps.forEach(e => { const b = buckets.get(keyOf(finDay(e.TANGGAL))); if (b) b.e += finMoney(e.NOMINAL); });
  const max = Math.max(1, ...[...buckets.values()].map(b => Math.max(b.o, b.e)));
  const bars = [...buckets.entries()].map(([k, b]) => {
    const label = monthly ? finMonthLabel(k) : k.slice(8, 10);
    const tip = (monthly ? finMonthLabel(k) : finFmtDate(k)) + ' — Omset ' + rupiah(b.o) + (isAll ? ' • Keluar ' + rupiah(b.e) : '');
    return `<div class="fin-col" title="${esc(tip)}"><div class="fin-col-bars"><i class="o" style="height:${Math.max(b.o ? 3 : 0, (b.o / max) * 100)}%"></i>${isAll ? `<i class="e" style="height:${Math.max(b.e ? 3 : 0, (b.e / max) * 100)}%"></i>` : ''}</div><span>${label}</span></div>`;
  }).join('');
  finSet('finTrend', `<div class="fin-legend"><span><i class="o"></i>Omset</span>${isAll ? '<span><i class="e"></i>Pengeluaran</span>' : ''}<em>per ${monthly ? 'bulan' : 'hari'} • puncak ${rupiah(max)}</em></div><div class="fin-trend-scroll"><div class="fin-trend-bars">${bars}</div></div>`);
}

function finRenderPackages(scoped, omset) {
  const map = new Map();
  scoped.forEach(o => (o.items || []).forEach(it => {
    const name = finPkgName(it.PAKET) || '-';
    const cur = map.get(name) || { name, amount: 0, qty: 0 };
    cur.amount += finMoney(it.TAGIHAN); cur.qty++;
    map.set(name, cur);
  }));
  const list = [...map.values()].sort((a, b) => b.amount - a.amount).slice(0, 8);
  finSet('finPackages', list.length ? list.map(p => `<div class="fin-row">
    <div class="fin-row-top"><b>${esc(p.name)}</b><span>${rupiah(p.amount)}</span></div>
    <div class="fin-bar"><span style="width:${finPct(p.amount, omset)}%"></span></div>
    <div class="fin-row-sub">${p.qty} item • ${finPctText(p.amount, omset)} dari omset</div>
  </div>`).join('') : '<div class="fin-empty">Belum ada item pada periode ini.</div>');
}

function finRenderExpenseBreak(exps, total) {
  const cat = {};
  exps.forEach(e => { const k = String(e.KATEGORI || 'LAINNYA').toUpperCase(); cat[k] = (cat[k] || 0) + finMoney(e.NOMINAL); });
  const top = exps.slice().sort((a, b) => finMoney(b.NOMINAL) - finMoney(a.NOMINAL)).slice(0, 5);
  finSet('finExpenseBreak', exps.length ? `
    <div class="fin-chips">${Object.entries(cat).map(([k, v]) => `<span class="fin-chip-static">${esc(k)} <b>${rupiah(v)}</b></span>`).join('')}</div>
    <div class="fin-sub-title">Pengeluaran terbesar</div>
    ${top.map(e => `<div class="fin-row-top fin-line"><span class="fin-clip">${esc(e.KETERANGAN || '-')}<small>${finFmtDate(e.TANGGAL)} • ${esc(String(e.METODE_TRANSAKSI || 'CASH').toUpperCase())}</small></span><b>${rupiah(finMoney(e.NOMINAL))}</b></div>`).join('')}
    <p class="fin-note">Total ${rupiah(total)} • ${exps.length} transaksi. Input & hapus pengeluaran tetap lewat tab Log Finance.</p>` : '<div class="fin-empty">Belum ada pengeluaran pada periode ini.</div>');
}

function finRenderReceivables(scoped) {
  const today = new Date(finISO(new Date()) + 'T00:00:00');
  const list = scoped.filter(o => !finIsPaid(o)).map(o => {
    const d = finOrderDate(o);
    return { o, d, age: d ? Math.max(0, Math.round((today - new Date(d + 'T00:00:00')) / 86400000)) : 0 };
  }).sort((a, b) => (a.d || '').localeCompare(b.d || ''));
  const total = list.reduce((s, x) => s + finOrderTotal(x.o), 0);
  const shown = list.slice(0, 10);
  if ($('finReceivableBadge')) $('finReceivableBadge').textContent = list.length + ' order • ' + rupiah(total);
  finSet('finReceivables', list.length ? shown.map(x => `<div class="fin-row-top fin-line"><span class="fin-clip"><b>#${esc(x.o.ORDER_ID)}</b> ${esc(x.o.NAMA || '-')}<small>${finFmtDate(x.d)} • ${x.age} hari${finIdentity(x.o).instansi ? ' • ' + finIdentity(x.o).instansi : ''}</small></span><b class="${x.age > 7 ? 'neg' : ''}">${rupiah(finOrderTotal(x.o))}</b></div>`).join('')
    + (list.length > shown.length ? `<p class="fin-note">+ ${list.length - shown.length} order lain. Pelunasan dilakukan dari tab Operasional → Daftar Order.</p>` : '<p class="fin-note">Pelunasan dilakukan dari tab Operasional → Daftar Order.</p>')
    : '<div class="fin-empty">Tidak ada piutang pada filter ini. 🎉</div>');
}

function finTxList() {
  const q = finFilter.txQuery, st = finFilter.txStatus;
  return finRangeOrders().filter(finScopeMatch).filter(o => {
    const paid = finIsPaid(o);
    if (st === 'LUNAS' && !paid) return false;
    if (st === 'BELUM' && paid) return false;
    if (!q) return true;
    const hay = [o.ORDER_ID, o.NAMA, o.PAKET, finIdentity(o).instansi].join(' ').toLowerCase();
    return hay.includes(q);
  }).sort((a, b) => (finOrderDate(b) || '').localeCompare(finOrderDate(a) || ''));
}
function finRenderTx() {
  const list = finTxList();
  const shown = list.slice(0, finTxLimit);
  const sum = list.reduce((s, o) => s + finOrderTotal(o), 0);
  if ($('finTxCount')) $('finTxCount').textContent = list.length + ' transaksi • ' + rupiah(sum);
  finSet('finTxBody', shown.length ? shown.map(o => {
    const paid = finIsPaid(o); const id = finIdentity(o);
    const m = finMethodOf(o) || 'BELUM LUNAS';
    return `<tr><td>${finFmtDate(finOrderDate(o))}</td><td><b>#${esc(o.ORDER_ID)}</b></td><td>${esc(o.NAMA || '-')}</td><td>${id.type === 'INSTANSI' ? esc(id.instansi) : 'Reguler'}</td><td class="fin-wrap">${esc(o.PAKET || '-')}</td><td>${esc(m)}</td><td><span class="fin-badge ${paid ? 'paid' : 'unpaid'}">${paid ? 'LUNAS' : 'BELUM LUNAS'}</span></td><td class="r">${rupiah(finOrderTotal(o))}</td></tr>`;
  }).join('') : '<tr><td colspan="8" class="fin-empty">Tidak ada transaksi pada filter ini.</td></tr>');
  const more = $('finTxMore');
  if (more) { more.classList.toggle('hidden', list.length <= shown.length); more.textContent = 'Tampilkan semua (' + list.length + ')'; }
}

/* ---------- cetak / PDF (memakai openPrintDocument dari print.js) ---------- */
function printFinance() {
  if (!finUnlocked) return;
  const range = finRangeOrders(), scoped = range.filter(finScopeMatch), exps = finRangeExpenses();
  const a = finAgg(scoped), expTotal = finExpTotal(exps), isAll = finFilter.scope === 'ALL';
  const reg = finAgg(range.filter(o => finIdentity(o).type === 'REGULER'));
  const ins = finAgg(range.filter(o => finIdentity(o).type === 'INSTANSI'));
  const all = finAgg(range);
  const R = rupiah;
  const summary = `<table><thead><tr><th></th><th class="amount">Reguler</th><th class="amount">Instansi</th><th class="amount">Overall</th></tr></thead><tbody>
    <tr><td>Order</td><td class="amount">${reg.count}</td><td class="amount">${ins.count}</td><td class="amount">${all.count}</td></tr>
    <tr><td>Omset</td><td class="amount">${R(reg.omset)}</td><td class="amount">${R(ins.omset)}</td><td class="amount">${R(all.omset)}</td></tr>
    <tr><td>Pemasukan diterima</td><td class="amount">${R(reg.paid)}</td><td class="amount">${R(ins.paid)}</td><td class="amount">${R(all.paid)}</td></tr>
    <tr><td>Piutang</td><td class="amount">${R(reg.unpaid)}</td><td class="amount">${R(ins.unpaid)}</td><td class="amount">${R(all.unpaid)}</td></tr>
    <tr><td>Pengeluaran</td><td class="amount">-</td><td class="amount">-</td><td class="amount">${R(expTotal)}</td></tr>
    <tr><td><b>Profit (omset − pengeluaran)</b></td><td class="amount">-</td><td class="amount">-</td><td class="amount"><b>${R(all.omset - expTotal)}</b></td></tr>
    <tr><td><b>Saldo kas bersih (diterima − pengeluaran)</b></td><td class="amount">-</td><td class="amount">-</td><td class="amount"><b>${R(all.paid - expTotal)}</b></td></tr>
  </tbody></table>`;
  const methods = `<table><thead><tr><th>Metode (pemasukan diterima, ${esc(finScopeLabel())})</th><th class="amount">Nominal</th></tr></thead><tbody>${FIN_METHODS.map(m => `<tr><td>${m}</td><td class="amount">${R(a.methods[m])}</td></tr>`).join('')}</tbody></table>`;
  const tx = scoped.slice().sort((x, y) => (finOrderDate(x) || '').localeCompare(finOrderDate(y) || '')).map((o, i) => {
    const id = finIdentity(o);
    return `<tr class="${finIsPaid(o) ? 'paid' : ''}"><td class="no">${i + 1}</td><td class="tgl">${finFmtDate(finOrderDate(o))}</td><td>#${esc(o.ORDER_ID)}</td><td>${esc(o.NAMA || '-')}</td><td>${id.type === 'INSTANSI' ? esc(id.instansi) : 'Reguler'}</td><td>${esc(o.PAKET || '-')}</td><td>${esc(finMethodOf(o) || '-')}</td><td>${finIsPaid(o) ? 'LUNAS' : 'BELUM LUNAS'}</td><td class="amount">${R(finOrderTotal(o))}</td></tr>`;
  }).join('') || '<tr><td colspan="9" style="text-align:center">Tidak ada transaksi.</td></tr>';
  const txTable = `<table><thead><tr><th class="no">No</th><th>Tanggal</th><th>Order</th><th>Pelanggan</th><th>Jenis</th><th>Paket</th><th>Metode</th><th>Status</th><th class="amount">Tagihan</th></tr></thead><tbody>${tx}</tbody></table><div class="total">Total omset (${esc(finScopeLabel())}): ${R(a.omset)}</div>`;
  const expRows = exps.slice().sort((x, y) => finDay(x.TANGGAL).localeCompare(finDay(y.TANGGAL))).map(e => `<tr><td class="tgl">${finFmtDate(e.TANGGAL)}</td><td>${esc(e.KETERANGAN || '-')}</td><td>${esc(String(e.KATEGORI || 'LAINNYA').toUpperCase())}</td><td>${esc(String(e.METODE_TRANSAKSI || 'CASH').toUpperCase())}</td><td class="amount">${R(finMoney(e.NOMINAL))}</td></tr>`).join('') || '<tr><td colspan="5" style="text-align:center">Tidak ada pengeluaran.</td></tr>';
  const expTable = `<table><thead><tr><th>Tanggal</th><th>Keterangan</th><th>Kategori</th><th>Metode</th><th class="amount">Nominal</th></tr></thead><tbody>${expRows}</tbody></table><div class="total">Total pengeluaran: ${R(expTotal)}</div>`;
  openPrintDocument(
    'Laporan Keuangan — Fortuna Laundry',
    finPeriodLabel() + ' • Tampilan: ' + finScopeLabel(),
    '<h1 style="margin-top:8px">Ringkasan</h1>' + summary + '<h1 style="margin-top:10px">Metode Pembayaran</h1>' + methods + '<h1 style="margin-top:10px">Transaksi Penjualan</h1>' + txTable + (isAll ? '<h1 style="margin-top:10px">Pengeluaran</h1>' + expTable : '')
  );
}
