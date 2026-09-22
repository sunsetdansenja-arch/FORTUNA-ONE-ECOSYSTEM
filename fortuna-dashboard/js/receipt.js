// Fortuna Laundry — receipt module

function receiptHTML(o){
  const items=Array.isArray(o.items)?o.items:[];
  const total=items.reduce((s,x)=>s+(Number(String(x.TAGIHAN||'').replace(/[^0-9.-]/g,''))||0),0);
  const dt=o.START?new Date(String(o.START).replace(' ','T')):new Date();
  const date=isNaN(dt.getTime())?new Date().toLocaleString('id-ID',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}):dt.toLocaleString('id-ID',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});
  const paymentStatus=String(o.STATUS_PEMBAYARAN||'BELUM LUNAS').toUpperCase();
  const notes=[
    'Baju putih dicuci terpisah minimal 3 kg.',
    'Kami tidak menerima komplain lebih dari 2x24jam setelah customer menerima Laundry.',
    'Baju yang mudah luntur TAPI tidak memberitahu kami sebelumnya, bukan tanggung jawab kami.',
    'Di sarankan baju luntur untuk cuci satuan.',
    'Jika ingin pakaian Bapak/Ibu dikerjakan lebih optimal disarankan untuk pengerjaan satuan.',
    'Laundry yang lebih dari 10 hari tidak diambil bukan menjadi tanggung jawab kami.',
    'Laundry anda GRATIS apabila tidak mendapatkan nota.'
  ];
  return `<div class="receipt">
    <div style="text-align:center"><img src="${FORTUNA_LOGO_PNG}" alt="Fortuna Laundry"><div class="receipt-brand">FORTUNA LAUNDRY</div><div class="receipt-sub">Jalan Raya Inpres no 4</div><div class="receipt-sub">Jakarta Timur</div><div class="receipt-sub">085693280500</div></div>
    <div class="row" style="margin-top:6px"><span>${esc(date)}</span><b>#${esc(o.ORDER_ID||'PREVIEW')}</b></div>
    <div style="font-weight:800;margin-top:2px">${esc(o.NAMA||'-')}</div>
    <hr>
    ${items.map((x,i)=>`<div class="item"><div class="item-name">${i+1}. ${esc(x.PAKET||'-')}</div><div class="item-meta"><span>${esc(x.BERAT||'0')}Kg</span><span>${rupiah(x.TAGIHAN)}</span></div></div>`).join('')}
    <hr>
    <div class="row total"><span>Total</span><span>${rupiah(total)}</span></div>
    <div style="text-align:right;font-size:10px">${esc(paymentStatus)}${o.METODE_TRANSAKSI&&o.METODE_TRANSAKSI!=='BELUM LUNAS'?` • ${esc(o.METODE_TRANSAKSI)}`:''}</div>
    <div style="text-align:center;margin-top:5px;font-size:10px">-- PEMBAYARAN HARAP MENGGUNAKAN QRIS --</div>
    <div class="note-title">PERHATIAN</div>
    <div class="notes">${notes.map(n=>`- ${esc(n)}`).join('<br><br>')}</div>
    <div class="footer">Kritik dan saran<br>085693280500<br><br>#Terimakasih Kasih#</div>
  </div>`
}

function setPreviewButtons(mode){
  const create=mode==='create';
  $('previewCreatePrint').classList.toggle('hidden',!create);
  $('previewCreatePrintWa').classList.toggle('hidden',!create);
  $('previewCreateSave').classList.toggle('hidden',!create);
  $('previewReprint').classList.toggle('hidden',create);
}

function openPrintPreview(o){
  previewMode='reprint'; previewOrder=o;
  $('receiptPreview').innerHTML=receiptHTML(o);
  $('previewTitle').textContent='Preview Struk';
  $('previewSubtitle').textContent='Order #'+o.ORDER_ID+' • siap untuk dicetak';
  setPreviewButtons('reprint');
  $('previewModal').classList.add('show');
  document.body.classList.add('overflow-hidden');
}

async function confirmReprint(){
  if(!previewOrder||busy)return;
  try{busy=true;await printReceipt(previewOrder);closeModal('previewModal');toast('Struk #'+previewOrder.ORDER_ID+' dikirim ke printer')}catch(e){toast('Printer: '+e.message,false)}finally{busy=false}
}

async function confirmCreate(print,sendWa){if(busy||!draft)return;busy=true;try{const res=await api('order_create',draft);const o=res.data;closeModal('previewModal');$('f-nama').value='';$('f-wa').value='';$('f-payment').value='BELUM LUNAS';$('packageRows').innerHTML='';addPackage();calcTotal();await loadDashboard(true);const full={...draft,...o};if(print){try{await printReceipt(full)}catch(err){toast('Printer gagal: '+err.message,false)}}if(sendWa){const n=normalizeWaNumber(full.NO_WA);const link=buildStatusLink(full);if(n){const items=Array.isArray(full.items)?full.items:[];const itemText=items.map(x=>`- ${x.PAKET||'-'} — ${x.BERAT||0}Kg`).join('\n');const msg=`Halo ${full.NAMA||'Customer'},\n\nTerima kasih sudah menggunakan Fortuna Laundry.\n\nPesanan #${full.ORDER_ID} sudah kami terima.\n${itemText}\n\nTotal: ${rupiah(items.reduce((sum,x)=>sum+(Number(x.TAGIHAN)||0),0))}\n\nCek status cucian:\n${link||'Link status akan tersedia di customer dashboard.'}\n\nTerima kasih.\nFortuna Laundry`;window.open('https://wa.me/'+n+'?text='+encodeURIComponent(msg),'_blank')}else toast('Order tersimpan, tetapi nomor WhatsApp customer kosong.',false)}toast('Order #'+o.ORDER_ID+' berhasil disimpan');}catch(e){toast(e.message,false)}finally{busy=false}}

async function printOrder(id){const o=orders.find(x=>x.ORDER_ID===id);if(!o)return;openPrintPreview(o)}
