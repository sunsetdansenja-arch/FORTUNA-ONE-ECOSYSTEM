// Fortuna Laundry — orders module

function normalize(o){return o}

const INSTITUTION_CATALOG={
  SECATA:{'EXPRESS 1':'20000','KAOS':'2000','KAOS KAKI':'2000','CELANA PENDEK':'2000','CD':'2000'},
  SECABA:{'EXPRESS 1':'25000','KAOS':'3000','KAOS KAKI':'3000','CELANA PENDEK':'3000','CD':'3000'},
  PUSPOMAD:{'EXPRESS 1':'15000','+ HANGER':'5000'}
};
function institutionItems(){
  const inst=$('f-instansi')?.value||'SECATA';
  return Object.entries(INSTITUTION_CATALOG[inst]||{}).map(([name,price])=>({name,price}));
}
function addPackage(data={}){
  const row=document.createElement('div');row.className='package-row';
  if(orderMode==='INSTANSI'){
    const items=institutionItems();
    row.innerHTML=`<div class="flex gap-2"><select class="input package flex-1">${items.map((p,i)=>`<option value="${esc(p.name)}" data-price="${p.price}" ${p.name===(data.PAKET||items[0]?.name)?'selected':''}>${esc(p.name)}</option>`).join('')}</select><button type="button" onclick="this.closest('.package-row').remove();calcTotal()" class="w-10 rounded-xl bg-red-50 text-red-600"><i class="fa-solid fa-trash"></i></button></div><div class="grid grid-cols-2 gap-2 mt-2"><input class="input weight num-input" data-int="1" inputmode="numeric" value="${esc(data.BERAT||1)}" placeholder="Jumlah"><input class="input amount num-input bg-slate-50" inputmode="numeric" value="${esc(data.TAGIHAN||items[0]?.price||0)}" placeholder="Harga" readonly></div>`;
    $('packageRows').appendChild(row);
    const select=row.querySelector('.package'), qty=row.querySelector('.weight'), amount=row.querySelector('.amount');
    const sync=()=>{const p=items.find(x=>x.name===select.value);const n=Number(String(qty.value||'').replace(',','.'));const count=qty.value!==''&&Number.isFinite(n)?Math.max(0,Math.round(n)):0;if(qty.value!==''&&qty.value!==String(count))qty.value=String(count);amount.value=count*(Number(p?.price)||0);calcTotal()};
    select.addEventListener('change',sync);qty.addEventListener('input',sync);sync();
  }else{
    row.innerHTML=`<div class="flex gap-2"><select class="input package flex-1">${PACKAGES.map(p=>`<option ${p===(data.PAKET||'FLEKSIBEL')?'selected':''}>${p}</option>`).join('')}</select><button type="button" onclick="this.closest('.package-row').remove();calcTotal()" class="w-10 rounded-xl bg-red-50 text-red-600"><i class="fa-solid fa-trash"></i></button></div><div class="grid grid-cols-2 gap-2 mt-2"><input class="input weight num-input" inputmode="decimal" value="${esc(data.BERAT||'')}" placeholder="Berat (kg)"><input class="input amount num-input" inputmode="decimal" value="${esc(data.TAGIHAN||'')}" placeholder="Tagihan"></div>`;
    $('packageRows').appendChild(row);row.querySelectorAll('input').forEach(x=>x.addEventListener('input',calcTotal));
  }
}

function calcTotal(){let t=0;document.querySelectorAll('#packageRows .amount').forEach(x=>t+=Number(String(x.value).replace(/[^0-9.-]/g,''))||0);$('orderTotal').textContent=rupiah(t)}
document.addEventListener('change',e=>{if(e.target.id==='f-instansi'&&orderMode==='INSTANSI'){const rows=$('packageRows');rows.innerHTML='';addPackage();calcTotal()}});

function draftOrder(e){e.preventDefault();const rows=[...document.querySelectorAll('#packageRows .package-row')];if(!rows.length){toast(orderMode==='INSTANSI'?'Tambahkan minimal satu item':'Tambahkan minimal satu paket',false);return}draft={NAMA:$('f-nama').value.trim(),NO_WA:$('f-wa').value.trim(),METODE_TRANSAKSI:$('f-payment').value,JENIS_ORDER:orderMode,NAMA_INSTANSI:orderMode==='INSTANSI'?$('f-instansi').value:'',items:rows.map(r=>({PAKET:r.querySelector('.package').value,BERAT:r.querySelector('.weight').value,TAGIHAN:r.querySelector('.amount').value}))};try{previewMode='create';previewOrder={...draft,ORDER_ID:'PREVIEW'};$('receiptPreview').innerHTML=receiptHTML(previewOrder);setPreviewButtons('create');$('previewTitle').textContent='Preview Struk';$('previewSubtitle').textContent='Periksa sebelum menyimpan';$('previewModal').classList.add('show');document.body.classList.add('overflow-hidden')}catch(err){toast('Preview gagal: '+err.message,false)}}

function getOrderType(orderId){
  const id=String(orderId||'').toUpperCase();
  if(id.startsWith('SECATA-'))return{type:'INSTANSI',instansi:'SECATA'};
  if(id.startsWith('SECABA-'))return{type:'INSTANSI',instansi:'SECABA'};
  if(id.startsWith('PUSPOMAD-'))return{type:'INSTANSI',instansi:'PUSPOMAD'};
  return{type:'REGULER',instansi:''};
}

function updateOrderBackupAlert(){
  const tray=$('globalDeadlineTray');
  if(!tray)return;
  const existing=$('orderBackupAlert');
  const shouldShow=(orders||[]).length>=700;
  if(!shouldShow){
    existing?.remove();
    return;
  }
  if(existing)return;
  const alert=document.createElement('div');
  alert.id='orderBackupAlert';
  alert.className='mb-4 rounded-2xl border-2 border-red-600 bg-red-50 px-5 py-5 text-red-900 shadow-sm';
  alert.innerHTML='<div class="flex items-start gap-4"><div class="w-12 h-12 rounded-xl bg-red-600 text-white flex items-center justify-center shrink-0"><i class="fa-solid fa-triangle-exclamation text-xl"></i></div><div><div class="text-base sm:text-lg font-black uppercase tracking-wide">DEAR FORTUNA</div><div class="text-sm sm:text-base font-extrabold leading-relaxed mt-1">Data order sudah mencapai 700 selama menggunakan sistem ini, segera hubungi developer untuk backup data demi kenyamanan dan kecepatan operasional.</div></div></div>';
  tray.parentNode.insertBefore(alert,tray);
}

function renderOrders(){
  const q=($('search')?.value||'').toLowerCase();
  const activeMode=orderMode==='INSTANSI'?'INSTANSI':'REGULER';
  const list=orders.filter(o=>{
    const items=o.items||[];
    const identity=getOrderType(o.ORDER_ID);
    const matchesMode=identity.type===activeMode;
    const matchesStatus=statusFilter==='ALL'||items.some(i=>String(i.STATUS||'').toUpperCase()===statusFilter);
    const matchesSearch=(o.ORDER_ID+' '+identity.type+' '+identity.instansi+' '+o.NAMA+' '+o.PAKET+' '+items.map(i=>i.PAKET).join(' ')).toLowerCase().includes(q);
    return matchesMode&&matchesStatus&&matchesSearch;
  });
  $('orderCount').textContent=list.length+' order'+(statusFilter!=='ALL'?' • filter '+statusFilter:'')+' • '+activeMode;
  $('orderRows').innerHTML=list.map(o=>{
    const identity=getOrderType(o.ORDER_ID);
    const unpaid=o.STATUS_PEMBAYARAN==='BELUM LUNAS';
    const allDone=(o.items||[]).length>0&&(o.items||[]).every(i=>i.STATUS==='SELESAI');
    const itemHtml=(o.items||[]).map(i=>`
      <div class="order-item">
        <div class="order-item-head">
          <div class="order-item-name">${esc(i.PAKET)}</div>
          <span class="pill s-${esc(i.STATUS)}">${esc(i.STATUS)}</span>
        </div>
        <div class="order-item-meta"><span>${esc(i.BERAT)} ${getOrderUnit(o)}</span><span>•</span><span>${rupiah(i.TAGIHAN)}</span></div>
      </div>`).join('');
    const itemActions=(o.items||[]).filter(i=>i.STATUS!=='SELESAI').map(i=>`
      <div class="order-action-item">
        <span class="text-[8px] font-black text-slate-400 self-center mr-1">${esc(i.ITEM_ID)}</span>
        <button onclick="editItem('${esc(i.ITEM_ID)}')" title="Edit ${esc(i.ITEM_ID)}" class="btn text-slate-500 bg-slate-100 rounded-lg px-2 py-1 text-[10px]"><i class="fa-solid fa-pen"></i></button>
        ${i.STATUS==='DITERIMA'?'<button onclick="setStatus(\''+esc(i.ITEM_ID)+'\',\'DIPROSES\')" class="btn text-[9px] bg-orange-50 text-orange-700 rounded-lg px-2 py-1">PROSES</button>':''}
        ${i.STATUS==='DIPROSES'?'<button onclick="setStatus(\''+esc(i.ITEM_ID)+'\',\'QC\')" class="btn text-[9px] bg-blue-50 text-blue-700 rounded-lg px-2 py-1">QC</button>':''}
        ${i.STATUS==='QC'||i.STATUS==='DIPROSES'?'<button onclick="setStatus(\''+esc(i.ITEM_ID)+'\',\'SIAP\')" class="btn text-[9px] bg-emerald-50 text-emerald-700 rounded-lg px-2 py-1">SIAP</button>':''}
        ${i.STATUS==='SIAP'?'<button onclick="setStatus(\''+esc(i.ITEM_ID)+'\',\'SELESAI\')" class="btn text-[9px] bg-slate-900 text-white rounded-lg px-2 py-1">SELESAI</button>':''}
      </div>`).join('');
    return `<tr class="border-t border-slate-100 align-top">
      <td class="px-3 py-2.5 whitespace-nowrap">
        <div class="flex items-center gap-2">
          <span class="font-black">#${esc(o.ORDER_ID)}</span>
          ${identity.type==='INSTANSI'?'<span class="inline-flex items-center rounded-full bg-amber-50 text-amber-700 border border-amber-100 px-2 py-0.5 text-[8px] font-black tracking-wide">INSTANSI • '+esc(identity.instansi)+'</span>':'<span class="inline-flex items-center rounded-full bg-slate-100 text-slate-500 border border-slate-200 px-2 py-0.5 text-[8px] font-black tracking-wide">REGULER</span>'}
        </div>
        <div class="text-[9px] text-slate-400 mt-0.5">${o.START?new Date(o.START.replace(' ','T')).toLocaleString('id-ID',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}):''}</div>
      </td>
      <td class="px-3 py-2.5 min-w-[130px]"><b class="text-xs">${esc(o.NAMA)}</b><div class="text-[9px] text-slate-400">${esc(o.NO_WA)}</div>${unpaid?'<span class="pill unpaid inline-block mt-1">BELUM LUNAS</span>':''}</td>
      <td class="px-3 py-2.5 min-w-[270px]"><div class="order-package-list">${itemHtml}</div></td>
      <td class="px-3 py-2.5 whitespace-nowrap"><div class="order-total"><span class="order-total-label">Total</span><span class="order-total-value">${rupiah(getOrderTotalAmount(o))}</span></div></td>
      <td class="px-3 py-2.5 min-w-[185px]"><div class="order-actions">
        <div class="order-action-top">
          ${unpaid&&!allDone?'<button onclick="openPay(\''+esc(o.ORDER_ID)+'\')" class="btn text-[10px] font-black bg-red-50 text-red-700 rounded-lg px-2.5 py-1.5"><i class="fa-solid fa-check mr-1"></i>LUNAS</button>':''}
          <button onclick="printOrder('${esc(o.ORDER_ID)}')" title="Print" class="btn text-slate-600 bg-slate-100 rounded-lg px-2.5 py-1.5"><i class="fa-solid fa-print"></i></button>
          <button onclick="waOrder('${esc(o.ORDER_ID)}')" title="WhatsApp" class="btn text-emerald-700 bg-emerald-50 rounded-lg px-2.5 py-1.5"><i class="fa-brands fa-whatsapp"></i></button>
        </div>
        ${!allDone&&itemActions?'<div class="order-action-status">'+itemActions+'</div>':''}
      </div></td>
    </tr>`;
  }).join('')||`<tr><td colspan="5" class="p-10 text-center text-slate-400">Belum ada order ${activeMode.toLowerCase()}.</td></tr>`;
}

function toggleStatusFilter(filter,force=false){if(!force&&statusFilter===filter&&filter!=='ALL')statusFilter='ALL';else statusFilter=filter;document.querySelectorAll('.summary-filter').forEach(b=>b.classList.toggle('active',b.dataset.filter===statusFilter));renderOrders()}

function renderSummary(){
  const activeMode=orderMode==='INSTANSI'?'INSTANSI':'REGULER';
  const modeOrders=orders.filter(o=>getOrderType(o.ORDER_ID).type===activeMode);
  const counts={total:modeOrders.length,diterima:0,diproses:0,qc:0,siap:0,selesai:0};
  modeOrders.forEach(o=>(o.items||[]).forEach(i=>{
    const s=String(i.STATUS||'').toLowerCase();
    if(s==='diterima')counts.diterima++;
    else if(s==='diproses')counts.diproses++;
    else if(s==='qc')counts.qc++;
    else if(s==='siap')counts.siap++;
    else if(s==='selesai')counts.selesai++;
  }));
  $('sum-total').textContent=counts.total;
  $('sum-diterima').textContent=counts.diterima;
  $('sum-diproses').textContent=counts.diproses;
  $('sum-qc').textContent=counts.qc;
  $('sum-siap').textContent=counts.siap;
  $('sum-selesai').textContent=counts.selesai;
}
let summary={};

async function loadDashboard(silent=false){
  try{
    const j=await api('read');
    orders=j.data?.orders||[];
    updateOrderBackupAlert();
    renderSummary();
    renderOrders();
    if(!silent)toast('Data berhasil diperbarui')
  }catch(e){toast('Gagal memuat dashboard: '+e.message,false)}
}

function findItem(id){for(const o of orders){const i=(o.items||[]).find(x=>x.ITEM_ID===id);if(i)return{o,i}}return null}

function orderMoneyValue(value){
  const raw=String(value??'').trim();
  if(!raw)return 0;
  const n=Number(raw.replace(/[^\d-]/g,''));
  return Number.isFinite(n)?n:0;
}
function getOrderTotalAmount(order){
  const items=Array.isArray(order?.items)?order.items:[];
  const hasItemAmounts=items.some(item=>item?.TAGIHAN!==undefined&&item?.TAGIHAN!==null&&String(item.TAGIHAN).trim()!=='');
  return hasItemAmounts?items.reduce((sum,item)=>sum+orderMoneyValue(item.TAGIHAN),0):orderMoneyValue(order?.TOTAL_TAGIHAN);
}
function isInstitutionOrder(order){
  return getOrderType(order?.ORDER_ID).type==='INSTANSI' ||
    String(order?.JENIS_ORDER||'').toUpperCase()==='INSTANSI' ||
    Boolean(String(order?.NAMA_INSTANSI||'').trim());
}
function getOrderUnit(order){
  return isInstitutionOrder(order)?'pcs':'kg';
}
function parseOrderQuantity(value){
  const raw=String(value??'').trim().replace(/,/g,'.').replace(/[^\d.-]/g,'');
  const n=Number(raw);
  return Number.isFinite(n)?n:0;
}

async function setStatus(item,status){if(!confirm('Ubah item menjadi '+status+'?'))return;try{await api('update_status',{ITEM_ID:item,STATUS:status});await loadDashboard(true);if(status==='SIAP')loadDeadline();toast('Status berhasil diperbarui')}catch(e){toast(e.message,false)}}

async function markReady(item){if(!confirm('Tandai item sebagai SIAP?'))return;try{await api('ready_item',{ITEM_ID:item,STATUS:'SIAP'});await loadDashboard(true);await loadDeadline();toast('Item ditandai SIAP')}catch(e){toast(e.message,false)}}

function editItem(id){
  const f=findItem(id);
  if(!f)return toast('Item tidak ditemukan. Refresh dashboard lalu coba lagi.',false);
  const o=f.o,i=f.i;
  if(String(i.STATUS||'').toUpperCase()==='SELESAI')return toast('Item SELESAI tidak dapat diedit.',false);

  const identity=getOrderType(o.ORDER_ID);
  const instansi=identity.instansi||String(o.NAMA_INSTANSI||'').toUpperCase();
  const inst=isInstitutionOrder(o);
  const unit=inst?'pcs':'kg';
  const catalog=inst?(INSTITUTION_CATALOG[instansi]?Object.keys(INSTITUTION_CATALOG[instansi]):[]):[...PACKAGES];
  const current=String(i.PAKET||'');
  if(current&&!catalog.includes(current))catalog.unshift(current);

  $('edit-item').value=id;
  $('edit-id').textContent='#'+o.ORDER_ID+' • '+id;
  $('edit-nama').value=o.NAMA||'';
  $('edit-wa').value=o.NO_WA||'';
  $('edit-paket').innerHTML=catalog.map(p=>'<option value="'+esc(p)+'"'+(p===current?' selected':'')+'>'+esc(p)+'</option>').join('');
  $('edit-paket').dataset.mode=inst?'INSTANSI':'REGULER';
  $('edit-paket').dataset.instansi=instansi;
  $('edit-paket-label').textContent=inst?'ITEM':'PAKET';
  $('edit-berat-label').textContent=unit==='pcs'?'JUMLAH (PCS)':'BERAT (KG)';
  const qty=$('edit-berat');
  qty.dataset.int=unit==='pcs'?'1':'';
  qty.inputMode=unit==='pcs'?'numeric':'decimal';
  qty.value=unit==='pcs'?String(Math.round(parseOrderQuantity(i.BERAT))):String(i.BERAT??'');
  $('edit-tagihan').value=String(orderMoneyValue(i.TAGIHAN)||'');
  $('edit-help').textContent=inst
    ?'Jumlah dihitung per PCS. Tagihan mengikuti tarif item instansi dan dihitung ulang saat item/jumlah berubah.'
    :'Untuk order reguler, periksa dan sesuaikan tagihan secara manual jika paket atau berat berubah.';
  editRecalc();
  $('editModal').classList.add('show');
  document.body.classList.add('overflow-hidden');
}

function editRecalc(){
  const qtyField=$('edit-berat');
  if(qtyField.dataset.int==='1'&&qtyField.value!==''){
    const normalized=String(Math.max(0,Math.round(parseOrderQuantity(qtyField.value))));
    if(qtyField.value!==normalized)qtyField.value=normalized;
  }
  const input=$('edit-tagihan');
  const inst=$('edit-paket').dataset.mode==='INSTANSI';
  const instansi=$('edit-paket').dataset.instansi||'';
  const paket=$('edit-paket').value;
  if(!inst){
    input.readOnly=false;
    input.classList.add('num-input');
    return;
  }
  const price=Number(INSTITUTION_CATALOG[instansi]?.[paket]);
  if(Number.isFinite(price)&&price>0){
    const qty=Math.round(parseOrderQuantity(qtyField.value));
    input.value=String(Math.max(0,qty)*price);
    input.readOnly=true;
    input.classList.remove('num-input');
  }else{
    input.readOnly=false;
    input.classList.add('num-input');
  }
}

async function saveEdit(e){
  e.preventDefault();
  const btn=$('editSaveBtn'),txt=$('editSaveText');
  if(btn.disabled)return;
  const id=$('edit-item').value,f=findItem(id);
  if(!f)return toast('Item tidak ditemukan. Refresh dashboard lalu coba lagi.',false);
  const o=f.o,old=f.i;
  if(String(old.STATUS||'').toUpperCase()==='SELESAI')return toast('Item SELESAI tidak dapat diedit.',false);

  const inst=isInstitutionOrder(o);
  const unit=inst?'pcs':'kg';
  const rawQty=parseOrderQuantity($('edit-berat').value);
  const qty=unit==='pcs'?Math.round(rawQty):rawQty;
  if(!(qty>0))return toast((unit==='pcs'?'Jumlah (PCS)':'Berat (KG)')+' harus lebih dari 0.',false);

  const paket=$('edit-paket').value;
  let bill=orderMoneyValue($('edit-tagihan').value);
  const identity=getOrderType(o.ORDER_ID);
  const instansi=identity.instansi||String(o.NAMA_INSTANSI||$('edit-paket').dataset.instansi||'').toUpperCase();
  const price=Number(INSTITUTION_CATALOG[instansi]?.[paket]);
  if(inst&&Number.isFinite(price)&&price>0)bill=qty*price;
  if(!(bill>0))return toast('Tagihan harus lebih dari 0.',false);

  const nama=$('edit-nama').value.trim()||'TANPA NAMA';
  const wa=$('edit-wa').value.trim();
  const nameOrWaChanged=nama!==String(o.NAMA||'TANPA NAMA')||wa!==String(o.NO_WA||'');
  btn.disabled=true;
  if(txt)txt.textContent='Menyimpan...';
  let syncFailed=false;
  try{
    await api('order_edit',{
      ITEM_ID:id,NAMA:nama,NO_WA:wa,PAKET:paket,
      BERAT:String(qty),
      TAGIHAN:String(Math.round(bill))
    });
    if(nameOrWaChanged){
      for(const sibling of (o.items||[])){
        if(sibling.ITEM_ID===id||String(sibling.STATUS||'').toUpperCase()==='SELESAI')continue;
        try{
          await api('order_edit',{ITEM_ID:sibling.ITEM_ID,NAMA:nama,NO_WA:wa});
        }catch(err){
          syncFailed=true;
          console.error('Gagal menyinkronkan nama/WA item '+sibling.ITEM_ID,err);
        }
      }
    }
    closeModal('editModal');
    await loadDashboard(true);
    if(syncFailed)toast('Perubahan item tersimpan, tetapi nama/WA pada sebagian item lain gagal diperbarui. Refresh dan periksa kembali.',false);
    else toast('Item diperbarui • Tagihan '+rupiah(bill));
  }catch(err){
    toast('Gagal menyimpan perubahan: '+err.message,false);
  }finally{
    btn.disabled=false;
    if(txt)txt.textContent='Simpan Perubahan';
  }
}

function openPay(id){payOrder=id;$('payModal').classList.add('show')}

async function pay(method){try{await api('payment_update',{ORDER_ID:payOrder,METODE_TRANSAKSI:method});closeModal('payModal');await loadDashboard(true);toast('Pembayaran #'+payOrder+' menjadi LUNAS')}catch(e){toast(e.message,false)}}
