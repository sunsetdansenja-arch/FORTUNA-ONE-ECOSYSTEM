// Fortuna Laundry — tambah item/paket ke order yang sudah ada.
// Memakai payload backend yang sudah ada: 'order_add_item' { ORDER_ID, PAKET, BERAT, TAGIHAN }.
// Backend yang menentukan ITEM_ID, START (waktu sekarang), deadline, status DITERIMA, dan status bayar.

function addItemTarget() {
  const id = $('add-order').value;
  return orders.find(x => String(x.ORDER_ID) === String(id)) || null;
}

function openAddItem(orderId) {
  const o = orders.find(x => String(x.ORDER_ID) === String(orderId));
  if (!o) return toast('Order tidak ditemukan. Refresh dashboard lalu coba lagi.', false);
  const identity = getOrderType(o);
  const instansi = identity.instansi || String(o.NAMA_INSTANSI || '').toUpperCase();
  const inst = isInstitutionOrder(o);
  const catalog = inst ? Object.keys(INSTITUTION_CATALOG[instansi] || {}) : [...PACKAGES];

  $('add-order').value = o.ORDER_ID;
  $('add-id').textContent = '#' + o.ORDER_ID + ' • ' + (o.NAMA || '-') + (inst ? ' • ' + instansi : '');
  $('add-paket-label').textContent = inst ? 'ITEM' : 'PAKET';
  const select = $('add-paket');
  select.innerHTML = '<option value="">— Pilih ' + (inst ? 'item' : 'paket') + ' —</option>'
    + catalog.map(p => '<option value="' + esc(p) + '">' + esc(inst ? institutionPackageLabel(instansi, p, INSTITUTION_CATALOG[instansi][p]) : packageOptionLabel(p)) + '</option>').join('')
    + '<option value="' + PACKAGE_CUSTOM_OPTION + '">CUSTOM — Isi nama paket sendiri</option>';
  select.value = '';
  select.dataset.mode = inst ? 'INSTANSI' : 'REGULER';
  select.dataset.instansi = instansi;
  $('add-custom-name').value = '';
  $('add-berat').value = '';
  $('add-tagihan').value = '0';

  const notes = [];
  if (String(o.STATUS_PEMBAYARAN || '').toUpperCase() === 'LUNAS') notes.push('Order ini sudah LUNAS. Item baru dicatat BELUM LUNAS, jadi order perlu dilunasi lagi.');
  if ((o.items || []).length && (o.items || []).every(i => i.STATUS === 'SELESAI')) notes.push('Semua item sudah SELESAI. Item baru akan membuka kembali order ini.');
  const note = $('add-note');
  note.textContent = notes.join(' ');
  note.classList.toggle('hidden', !notes.length);

  select.onchange = () => addPaketChanged();
  $('add-berat').oninput = () => addRecalc(true);
  $('add-custom-name').oninput = () => { };
  addRecalc(false);
  $('addItemModal').classList.add('show');
  document.body.classList.add('overflow-hidden');
}

function closeAddItem() {
  $('addItemModal').classList.remove('show');
  document.body.classList.remove('overflow-hidden');
}

// Saat paket instansi dipilih dan jumlah masih kosong, isi jumlah standar (mis. PDL SET = 2 pcs).
function addPaketChanged() {
  const select = $('add-paket');
  if (select.dataset.mode === 'INSTANSI' && select.value && select.value !== PACKAGE_CUSTOM_OPTION && String($('add-berat').value || '') === '') {
    $('add-berat').value = String(institutionDefaultQuantity(select.dataset.instansi, select.value));
  }
  addRecalc(true);
}

function addRecalc(forceAuto = false) {
  const qtyField = $('add-berat'), select = $('add-paket'), bill = $('add-tagihan');
  const inst = select.dataset.mode === 'INSTANSI';
  const instansi = select.dataset.instansi || '';
  const custom = select.value === PACKAGE_CUSTOM_OPTION;
  $('add-custom-wrap').style.display = custom ? '' : 'none';
  const paket = custom ? String($('add-custom-name').value || '').trim() : select.value;
  const unit = inst ? 'pcs' : (custom ? 'unit' : (PACKAGE_CATALOG[paket]?.unit || 'unit'));

  qtyField.dataset.int = (!inst && unit === 'kg') ? '' : '1';
  qtyField.inputMode = (!inst && unit === 'kg') ? 'decimal' : 'numeric';
  $('add-berat-label').textContent = inst ? 'JUMLAH (PCS)' : (unit === 'kg' ? 'BERAT (KG)' : 'JUMLAH (' + unit.toUpperCase() + ')');
  if (qtyField.dataset.int === '1' && qtyField.value !== '') {
    const normalized = String(Math.max(0, Math.round(parseOrderQuantity(qtyField.value))));
    if (qtyField.value !== normalized) qtyField.value = normalized;
  }
  bill.readOnly = false;
  bill.classList.add('num-input');
  if (forceAuto) {
    if (!paket || custom) bill.value = '0';
    else if (inst) bill.value = String(institutionItemAmount(instansi, paket, qtyField.value));
    else bill.value = String(regularPackageAmount(paket, qtyField.value));
  }
}

async function saveAddItem(e) {
  e.preventDefault();
  const btn = $('addSaveBtn'), txt = $('addSaveText');
  if (btn.disabled) return;
  const o = addItemTarget();
  if (!o) return toast('Order tidak ditemukan. Refresh dashboard lalu coba lagi.', false);

  const selected = $('add-paket').value;
  if (!selected) return toast('Pilih paket terlebih dahulu.', false);
  const paket = selected === PACKAGE_CUSTOM_OPTION ? String($('add-custom-name').value || '').trim() : selected;
  if (!paket) return toast('Isi nama paket custom terlebih dahulu.', false);

  const inst = isInstitutionOrder(o);
  const unit = inst ? 'pcs' : (PACKAGE_CATALOG[paket]?.unit || 'unit');
  const rawQty = parseOrderQuantity($('add-berat').value);
  const qty = unit === 'kg' ? rawQty : Math.round(rawQty);
  if (!(qty > 0)) return toast((unit === 'kg' ? 'Berat (KG)' : 'Jumlah (' + unit.toUpperCase() + ')') + ' harus lebih dari 0.', false);
  const bill = orderMoneyValue($('add-tagihan').value);
  if (!(bill > 0)) return toast('Tagihan harus lebih dari 0.', false);

  btn.disabled = true;
  if (txt) txt.textContent = 'Menyimpan...';
  try {
    await api('order_add_item', { ORDER_ID: String(o.ORDER_ID), PAKET: paket, BERAT: String(qty), TAGIHAN: String(Math.round(bill)) });
    closeAddItem();
    toast('Item berhasil ditambahkan ke order #' + o.ORDER_ID);
    await loadDashboard(true);
    if (typeof loadDeadline === 'function') loadDeadline();
  } catch (err) {
    toast('Gagal menambah item: ' + err.message, false);
  } finally {
    btn.disabled = false;
    if (txt) txt.textContent = 'Tambah Item';
  }
}
