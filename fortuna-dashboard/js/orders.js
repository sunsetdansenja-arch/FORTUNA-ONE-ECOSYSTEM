// Fortuna Laundry — orders module

function normalize(o){return o}

const INSTITUTION_CATALOG={
  SECATA:{
    'PDL SET':'20000',
    'KAOS':'2000',
    'KAOS KAKI':'2000',
    'CELANA PENDEK':'2000',
    'CD':'2000',
    'HANDUK':'2000',
    'SARUNG':'2000',
    'SARUNG BANTAL':'2000'
  },
  SECABA:{
    'EXPRESS 1':'25000',
    'KAOS':'3000',
    'KAOS KAKI':'3000',
    'CELANA PENDEK':'3000',
    'CD':'3000',
    'HANDUK':'3000',
    'SARUNG':'3000',
    'SARUNG BANTAL':'3000'
  },
  PUSPOMAD:{'EXPRESS 1':'15000','+ HANGER':'5000'}
};
function institutionFixedPackage(instansi,paket){
  const name=String(paket||'').trim().toUpperCase();
  return instansi==='SECATA'&&name==='PDL SET';
}
function institutionMinimumQuantity(instansi,paket){
  return instansi==='SECABA'&&String(paket||'').trim().toUpperCase()==='EXPRESS 1'?3:1;
}
function institutionPackagePrice(instansi,paket){
  if(instansi==='SECATA'&&String(paket||'').trim().toUpperCase()==='EXPRESS 1')return 20000;
  const value=Number(INSTITUTION_CATALOG[instansi]?.[paket]);
  return Number.isFinite(value)&&value>0?value:0;
}
function institutionPackageSize(instansi,paket){
  if(instansi==='SECATA'&&String(paket||'').trim().toUpperCase()==='PDL SET')return 2;
  if(instansi==='SECABA'&&String(paket||'').trim().toUpperCase()==='EXPRESS 1')return 5;
  return 1;
}
function institutionDefaultQuantity(instansi,paket){
  return institutionPackageSize(instansi,paket);
}
function institutionItemAmount(instansi,paket,quantity){
  const price=institutionPackagePrice(instansi,paket);
  if(!price)return 0;
  const qty=Math.max(0,Math.round(Number(quantity)||0));
  const size=institutionPackageSize(instansi,paket);
  if(instansi==='SECABA'&&String(paket||'').trim().toUpperCase()==='EXPRESS 1')return Math.round(qty*price/size);
  if(institutionFixedPackage(instansi,paket))return qty>0&&qty%size===0?(qty/size)*price:0;
  return qty*price;
}
function institutionItems(){
  const inst=$('f-instansi')?.value||'SECATA';
  return Object.entries(INSTITUTION_CATALOG[inst]||{}).map(([name,price])=>({name,price}));
}

const PACKAGE_DISPLAY_NAMES={
  'CUCI KOMPLIT REGULER':'CUCI KOMPLIT REGULER • 3 HARI',
  'EXPRESS 1 HARI':'EXPRESS 1 HARI • 24 JAM',
  'EXPRESS 3 JAM':'EXPRESS 3 JAM',
  'EXPRESS 6 JAM':'EXPRESS 6 JAM',
  'CUCI REGULER':'CUCI REGULER • 3 HARI',
  'CUCI EXPRESS 1 HARI':'CUCI EXPRESS 1 HARI • 24 JAM',
  'CUCI EXPRESS 3 JAM':'CUCI EXPRESS 3 JAM',
  'CUCI EXPRESS 6 JAM':'CUCI EXPRESS 6 JAM',
  'SETRIKA REGULER':'SETRIKA REGULER • 2 HARI',
  'SETRIKA EXPRESS 1 HARI':'SETRIKA EXPRESS 1 HARI • 24 JAM',
  'SETRIKA EXPRESS 3 JAM':'SETRIKA EXPRESS 3 JAM',
  'SETRIKA EXPRESS 6 JAM':'SETRIKA EXPRESS 6 JAM'
};

function packageDisplayName(name){
  const key=String(name||'').trim().toUpperCase();
  return PACKAGE_DISPLAY_NAMES[key]||String(name||'');
}

function packageOptionLabel(name){
  const item=PACKAGE_CATALOG[String(name||'').trim().toUpperCase()];
  if(!item)return String(name||'');
  let priceLabel='Harga manual';
  if(Number.isFinite(item.price)){
    priceLabel=rupiah(item.price);
    if(Number.isFinite(item.maxPrice)&&item.maxPrice>item.price){
      priceLabel+='–'+rupiah(item.maxPrice);
    }
    priceLabel+=' / '+(item.pricing==='perKg'?'kg':item.unit);
  }
  return packageDisplayName(name)+' — '+priceLabel+' · Deadline: '+(item.deadline||'sesuai layanan');
}

function institutionPackageLabel(instansi,paket,price){
  const amount=rupiah(price);
  if(instansi==='SECABA'&&String(paket||'').trim().toUpperCase()==='EXPRESS 1'){
    return paket+' — '+rupiah(Math.round(Number(price)/institutionPackageSize(instansi,paket)))+' / PCS (min. 3 PCS)';
  }
  if(institutionFixedPackage(instansi,paket)){
    const size=institutionPackageSize(instansi,paket);
    return paket+' — '+amount+' / '+(instansi==='SECATA'&&paket==='PDL SET'?'set':'paket')+' ('+size+' PCS)';
  }
  return paket+' — '+amount+' / PCS';
}

function regularPackageAmount(paket,quantity){
  const item=PACKAGE_CATALOG[String(paket||'').trim().toUpperCase()];
  const qty=Number(String(quantity??'').replace(',','.'));
  if(!item||!Number.isFinite(qty)||qty<=0||!Number.isFinite(item.price))return 0;
  if(item.pricing==='perKg')return Math.round(qty*item.price);
  if(item.pricing==='perUnit')return Math.round(Math.max(0,Math.round(qty))*item.price);
  return 0;
}

function packageNameFromRow(row){
  const select=row.querySelector('.package');
  if(!select)return '';
  if(select.value===PACKAGE_CUSTOM_OPTION){
    return String(row.querySelector('.custom-package-name')?.value||'').trim();
  }
  return select.value;
}

function addPackage(data={}){
  const row=document.createElement('div');
  row.className='package-row';
  const instMode=orderMode==='INSTANSI';
  const inst=$('f-instansi')?.value||'SECATA';
  const originalName=String(data.PAKET||'').trim();
  const normalizedName=originalName.toUpperCase();
  const isKnown=instMode
    ? Object.prototype.hasOwnProperty.call(INSTITUTION_CATALOG[inst]||{},normalizedName)
    : Object.prototype.hasOwnProperty.call(PACKAGE_CATALOG,normalizedName);
  const isCustom=Boolean(originalName)&&!isKnown;
  const selectedName=isKnown?normalizedName:(isCustom?PACKAGE_CUSTOM_OPTION:(instMode?Object.keys(INSTITUTION_CATALOG[inst]||{})[0]:'FLEKSIBEL'));
  const defaultQty=data.BERAT!==undefined&&data.BERAT!==null&&data.BERAT!==''
    ?String(data.BERAT)
    :(instMode?String(institutionDefaultQuantity(inst,selectedName==='__CUSTOM__'?'':selectedName)):'1');
  let initialAmount;
  if(data.TAGIHAN!==undefined&&data.TAGIHAN!==null&&String(data.TAGIHAN)!==''){
    initialAmount=String(data.TAGIHAN);
  }else if(isCustom){
    initialAmount='0';
  }else{
    initialAmount=instMode
      ?String(institutionItemAmount(inst,selectedName,defaultQty))
      :String(regularPackageAmount(selectedName,defaultQty));
  }

  const options=instMode
    ? Object.entries(INSTITUTION_CATALOG[inst]||{}).map(([name,price])=>'<option value="'+esc(name)+'" '+(name===selectedName?'selected':'')+'>'+esc(institutionPackageLabel(inst,name,price))+'</option>').join('')
    : PACKAGES.map(name=>'<option value="'+esc(name)+'" '+(name===selectedName?'selected':'')+'>'+esc(packageOptionLabel(name))+'</option>').join('');
  const customOption='<option value="'+PACKAGE_CUSTOM_OPTION+'" '+(isCustom?'selected':'')+'>CUSTOM — Isi nama paket sendiri</option>';
  const unit=instMode?'pcs':(PACKAGE_CATALOG[selectedName]?.unit||'unit');
  const customValue=isCustom?originalName:'';
  row.dataset.mode=instMode?'INSTANSI':'REGULER';
  row.innerHTML=`<div class="flex gap-2">
    <select class="input package flex-1">${options}${customOption}</select>
    <button type="button" onclick="this.closest('.package-row').remove();calcTotal()" class="w-10 rounded-xl bg-red-50 text-red-600"><i class="fa-solid fa-trash"></i></button>
  </div>
  <input class="input custom-package-name mt-2" style="${isCustom?'':'display:none'}" value="${esc(customValue)}" placeholder="Isi nama paket custom sendiri">
  <div class="grid grid-cols-2 gap-2 mt-2">
    <input class="input weight num-input" ${unit==='kg'?'inputmode="decimal"':'inputmode="numeric" data-int="1"'} value="${esc(defaultQty)}" placeholder="${unit==='kg'?'Berat (KG)':'Jumlah ('+esc(unit.toUpperCase())+')'}">
    <input class="input amount num-input" data-int="1" inputmode="numeric" value="${esc(initialAmount)}" placeholder="Total tagihan (editable)">
  </div>`;
  $('packageRows').appendChild(row);

  const select=row.querySelector('.package');
  const customName=row.querySelector('.custom-package-name');
  const qty=row.querySelector('.weight');
  const amount=row.querySelector('.amount');

  const sync=(recalculate=true)=>{
    const custom=select.value===PACKAGE_CUSTOM_OPTION;
    customName.style.display=custom?'':'none';
    let currentUnit=instMode?'pcs':(custom?'unit':(PACKAGE_CATALOG[select.value]?.unit||'unit'));
    qty.dataset.int=(!instMode&&currentUnit==='kg')?'':'1';
    qty.inputMode=(!instMode&&currentUnit==='kg')?'decimal':'numeric';
    qty.placeholder=(!instMode&&currentUnit==='kg')?'Berat (KG)':'Jumlah ('+currentUnit.toUpperCase()+')';
    if(recalculate){
      if(custom)amount.value='0';
      else if(instMode)amount.value=String(institutionItemAmount(inst,select.value,qty.value));
      else amount.value=String(regularPackageAmount(select.value,qty.value));
    }
    calcTotal();
  };
  select.addEventListener('change',()=>sync(true));
  qty.addEventListener('input',()=>sync(true));
  customName.addEventListener('input',calcTotal);
  amount.addEventListener('input',calcTotal);
  sync(false);
}

function calcTotal(){
  let total=0;
  document.querySelectorAll('#packageRows .amount').forEach(field=>{
    total+=receiptParseMoney(field.value);
  });
  const totalNode=$('orderTotal');
  if(totalNode)totalNode.textContent=rupiah(total);
}

document.addEventListener('change',e=>{if(e.target.id==='f-instansi'&&orderMode==='INSTANSI'){const rows=$('packageRows');rows.innerHTML='';addPackage();calcTotal()}});

function draftOrder(e){
  e.preventDefault();
  const sendWaOnly=!!(e.submitter&&e.submitter.dataset.sendWaOnly==='true');
  const rows=[...document.querySelectorAll('#packageRows .package-row')];
  if(!rows.length){
    toast(orderMode==='INSTANSI'?'Tambahkan minimal satu item':'Tambahkan minimal satu paket',false);
    return;
  }

  for(const row of rows){
    const select=row.querySelector('.package');
    const paket=packageNameFromRow(row);
    if(select?.value===PACKAGE_CUSTOM_OPTION&&!paket){
      toast('Isi nama paket untuk opsi Custom terlebih dahulu.',false);
      row.querySelector('.custom-package-name')?.focus();
      return;
    }
  }

  if(orderMode==='INSTANSI'){
    const inst=$('f-instansi')?.value||'SECATA';
    for(const row of rows){
      const paket=packageNameFromRow(row);
      if(row.querySelector('.package').value===PACKAGE_CUSTOM_OPTION)continue;
      const qty=Math.round(parseOrderQuantity(row.querySelector('.weight').value));
      const size=institutionPackageSize(inst,paket);
      const minimum=institutionMinimumQuantity(inst,paket);
      if(inst==='SECABA'&&paket.trim().toUpperCase()==='EXPRESS 1'&&qty<minimum){
        toast(paket+' minimal '+minimum+' PCS.',false);
        row.querySelector('.weight')?.focus();
        return;
      }
      if(institutionFixedPackage(inst,paket)&&(!(qty>0)||qty%size!==0)){
        toast(paket+' harus berjumlah kelipatan '+size+' PCS.',false);
        return;
      }
    }
  }

  draft={
    NAMA:$('f-nama').value.trim(),
    NO_WA:$('f-wa').value.trim(),
    METODE_TRANSAKSI:$('f-payment').value,
    JENIS_ORDER:orderMode,
    NAMA_INSTANSI:orderMode==='INSTANSI'?$('f-instansi').value:'',
    items:rows.map(row=>({
      PAKET:packageNameFromRow(row),
      BERAT:row.querySelector('.weight').value,
      TAGIHAN:row.querySelector('.amount').value
    }))
  };

  if(sendWaOnly){
    confirmCreate(false,true);
    return;
  }

  try{
    previewMode='create';
    previewOrder={...draft,ORDER_ID:'PREVIEW'};
    $('receiptPreview').innerHTML=receiptHTML(previewOrder);
    setPreviewButtons('create');
    $('previewTitle').textContent='Preview Struk';
    $('previewSubtitle').textContent='Periksa sebelum menyimpan';
    $('previewModal').classList.add('show');
    document.body.classList.add('overflow-hidden');
  }catch(err){
    toast('Preview gagal: '+err.message,false);
  }
}

function getOrderType(order){
  const source = order && typeof order === 'object'
    ? order
    : { ORDER_ID: order };

  const id = String(source.ORDER_ID || '').trim().toUpperCase();
  const items = Array.isArray(source.items) ? source.items : [];
  const itemIds = items.map(item =>
    String(item && item.ITEM_ID || '').trim().toUpperCase()
  );

  // Prioritaskan ITEM_ID, karena ORDER_ID baru bersifat numerik global.
  for (const instansi of ['SECATA', 'SECABA', 'PUSPOMAD']) {
    if (itemIds.some(itemId => itemId.startsWith(instansi + '-'))) {
      return { type: 'INSTANSI', instansi };
    }
  }

  // Kompatibilitas untuk data lama yang memakai ORDER_ID ber-prefix.
  for (const instansi of ['SECATA', 'SECABA', 'PUSPOMAD']) {
    if (id.startsWith(instansi + '-')) {
      return { type: 'INSTANSI', instansi };
    }
  }

  // Fallback jika backend kelak mengirim jenis/nama instansi di order.
  const explicitType = String(source.JENIS_ORDER || '').trim().toUpperCase();
  const explicitInstansi = String(source.NAMA_INSTANSI || '').trim().toUpperCase();
  if (explicitType === 'INSTANSI' &&
      ['SECATA', 'SECABA', 'PUSPOMAD'].includes(explicitInstansi)) {
    return { type: 'INSTANSI', instansi: explicitInstansi };
  }

  return { type: 'REGULER', instansi: '' };
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

function orderDateFilterValue(order){
  const raw=String(order?.START??'').trim();
  if(!raw||!/^\d{4}-\d{2}-\d{2}/.test(raw))return '';
  // Match the table/receipt date by parsing START the same way and extracting WIB date.
  const parsed=receiptParseDate(raw);
  if(!(parsed instanceof Date)||Number.isNaN(parsed.getTime()))return '';
  const parts=new Intl.DateTimeFormat('en-CA',{
    timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit'
  }).formatToParts(parsed);
  const part=type=>parts.find(p=>p.type===type)?.value||'';
  const year=part('year'),month=part('month'),day=part('day');
  return year&&month&&day?year+'-'+month+'-'+day:'';
}
function applyOrderDateFilter(){const from=$('orderDateFrom')?.value||'';const to=$('orderDateTo')?.value||'';if(from&&to&&from>to){toast('Tanggal mulai tidak boleh melewati tanggal akhir.',false);return}renderOrders()}
function resetOrderDateFilter(){if($('orderDateFrom'))$('orderDateFrom').value='';if($('orderDateTo'))$('orderDateTo').value='';renderOrders()}
function renderOrders(){
  const q=($('search')?.value||'').toLowerCase();
  const dateFrom=$('orderDateFrom')?.value||'';
  const dateTo=$('orderDateTo')?.value||'';
  const activeMode=orderMode==='INSTANSI'?'INSTANSI':'REGULER';
  const list=orders.filter(o=>{
    const items=o.items||[];
    const identity=getOrderType(o);
    const orderDate=orderDateFilterValue(o);
    const matchesMode=identity.type===activeMode;
    const matchesStatus=statusFilter==='ALL'||items.some(i=>String(i.STATUS||'').toUpperCase()===statusFilter);
    const matchesSearch=(o.ORDER_ID+' '+identity.type+' '+identity.instansi+' '+o.NAMA+' '+o.PAKET+' '+items.map(i=>i.PAKET).join(' ')).toLowerCase().includes(q);
    const matchesDate=(!dateFrom||(orderDate&&orderDate>=dateFrom))&&(!dateTo||(orderDate&&orderDate<=dateTo));
    return matchesMode&&matchesStatus&&matchesSearch&&matchesDate;
  });
  $('orderCount').textContent=list.length+' order'+(statusFilter!=='ALL'?' • filter '+statusFilter:'')+((dateFrom||dateTo)?' • tanggal '+(dateFrom||'awal')+' s/d '+(dateTo||'sekarang'):'')+' • '+activeMode;
  $('orderRows').innerHTML=list.map(o=>{
    const identity=getOrderType(o);
    const unpaid=o.STATUS_PEMBAYARAN==='BELUM LUNAS';
    const isPaid=String(o.STATUS_PEMBAYARAN||'').trim().toUpperCase()==='LUNAS';
    const allDone=(o.items||[]).length>0&&(o.items||[]).every(i=>i.STATUS==='SELESAI');
    const itemHtml=(o.items||[]).map(i=>`
      <div class="order-item">
        <div class="order-item-head">
          <div class="order-item-name">${esc(packageDisplayName(i.PAKET))}</div>
          <button onclick="deleteItem('${esc(i.ITEM_ID)}')" title="Hapus item ${esc(i.ITEM_ID)}" class="btn text-red-600 bg-red-50 rounded-md px-1.5 py-0.5 text-[9px]"><i class="fa-solid fa-trash"></i></button>
        </div>
        <div class="order-item-meta"><span>${esc(i.BERAT)} ${getOrderUnit(o,i.PAKET)}</span><span>•</span><span>${rupiah(i.TAGIHAN)}</span></div>
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
    return `<tr class="border-t border-slate-100 align-top ${isPaid?'bg-emerald-50':''}">
      <td class="px-3 py-2.5 whitespace-nowrap">
        <div class="flex items-center gap-2">
          <span class="font-black">#${esc(o.ORDER_ID)}</span>
          ${identity.type==='INSTANSI'?'<span class="inline-flex items-center rounded-full bg-amber-50 text-amber-700 border border-amber-100 px-2 py-0.5 text-[8px] font-black tracking-wide">INSTANSI • '+esc(identity.instansi)+'</span>':'<span class="inline-flex items-center rounded-full bg-slate-100 text-slate-500 border border-slate-200 px-2 py-0.5 text-[8px] font-black tracking-wide">REGULER</span>'}
        </div>
      </td>
      <td class="px-3 py-2.5 whitespace-nowrap text-xs text-slate-600">${o.START?esc(receiptFormatDate(receiptParseDate(o.START))):'-'}</td>
      <td class="px-3 py-2.5 min-w-[130px]"><b class="text-xs">${esc(o.NAMA)}</b><div class="text-[9px] text-slate-400">${esc(o.NO_WA)}</div>${unpaid?'<span class="pill unpaid inline-block mt-1">BELUM LUNAS</span>':''}</td>
      <td class="px-3 py-2.5 min-w-[270px]"><div class="order-package-list">${itemHtml}</div></td>
      <td class="px-3 py-2.5 whitespace-nowrap"><div class="order-total"><span class="order-total-label">Total</span><span class="order-total-value">${rupiah(getOrderTotalAmount(o))}</span></div></td>
      <td class="px-3 py-2.5 min-w-[185px]"><div class="order-actions">
        <div class="order-action-top">
          ${unpaid&&!allDone?'<button onclick="openPay(\''+esc(o.ORDER_ID)+'\')" class="btn text-[10px] font-black bg-red-50 text-red-700 rounded-lg px-2.5 py-1.5"><i class="fa-solid fa-check mr-1"></i>LUNAS</button>':''}
          <button onclick="printOrder('${esc(o.ORDER_ID)}')" title="Print" class="btn text-slate-600 bg-slate-100 rounded-lg px-2.5 py-1.5"><i class="fa-solid fa-print"></i></button>
          <button onclick="waOrder('${esc(o.ORDER_ID)}')" title="WhatsApp" class="btn text-emerald-700 bg-emerald-50 rounded-lg px-2.5 py-1.5"><i class="fa-brands fa-whatsapp"></i></button>
          <button onclick="deleteOrder('${esc(o.ORDER_ID)}')" title="Hapus order permanen" class="btn text-red-700 bg-red-50 rounded-lg px-2.5 py-1.5"><i class="fa-solid fa-trash"></i></button>
        </div>
        ${!allDone&&itemActions?'<div class="order-action-status">'+itemActions+'</div>':''}
      </div></td>
    </tr>`;
  }).join('')||`<tr><td colspan="6" class="p-10 text-center text-slate-400">Belum ada order ${activeMode.toLowerCase()}.</td></tr>`;
}

function toggleStatusFilter(filter,force=false){if(!force&&statusFilter===filter&&filter!=='ALL')statusFilter='ALL';else statusFilter=filter;document.querySelectorAll('.summary-filter').forEach(b=>b.classList.toggle('active',b.dataset.filter===statusFilter));renderOrders()}

function renderSummary(){
  const activeMode=orderMode==='INSTANSI'?'INSTANSI':'REGULER';
  const modeOrders=orders.filter(o=>getOrderType(o).type===activeMode);
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

const deletingOrderIds=new Set();

async function deleteOrder(id){
  const order=(orders||[]).find(o=>String(o.ORDER_ID)===String(id));
  if(!order)return toast('Order tidak ditemukan. Refresh dashboard lalu coba lagi.',false);
  if(deletingOrderIds.has(String(id)))return;
  const itemCount=Array.isArray(order.items)?order.items.length:0;
  const approved=confirm(
    'HAPUS ORDER PERMANEN?\n\n'+
    'Order: #'+id+'\n'+
    'Pelanggan: '+(order.NAMA||'-')+'\n'+
    'Jumlah item: '+itemCount+'\n\n'+
    'Semua baris order ini akan dihapus dari backend dan tidak bisa dipulihkan dari dashboard. Lanjutkan?'
  );
  if(!approved)return;
  deletingOrderIds.add(String(id));
  renderOrders();
  try{
    await api('delete_order',{ORDER_ID:id});
    await loadDashboard(true);
    await loadDeadline();
    toast('Permintaan hapus order #'+id+' dikirim. Periksa daftar order untuk memastikan data sudah hilang.');
  }catch(e){
    toast('Gagal menghapus order #'+id+': '+e.message,false);
  }finally{
    deletingOrderIds.delete(String(id));
    renderOrders();
  }
}

const deletingItemIds=new Set();
async function deleteItem(itemId){
  const id=String(itemId||'');
  const found=findItem(id);
  if(!found)return toast('Item tidak ditemukan. Refresh dashboard lalu coba lagi.',false);
  if(deletingItemIds.has(id))return;
  const {o,i}=found;
  const itemCount=Array.isArray(o.items)?o.items.length:0;
  // Item terakhir = sama dengan menghapus order (pakai konfirmasi hapus order)
  if(itemCount<=1)return deleteOrder(o.ORDER_ID);
  const approved=confirm(
    'HAPUS ITEM PERMANEN?\n\n'+
    'Order: #'+o.ORDER_ID+'\n'+
    'Pelanggan: '+(o.NAMA||'-')+'\n'+
    'Item: '+id+' — '+packageDisplayName(i.PAKET)+'\n'+
    'Jumlah: '+i.BERAT+' '+getOrderUnit(o,i.PAKET)+'\n'+
    'Tagihan: '+rupiah(i.TAGIHAN)+'\n\n'+
    'Item ini akan dihapus dari backend dan tidak bisa dipulihkan dari dashboard. Total order akan berubah. Lanjutkan?'
  );
  if(!approved)return;
  deletingItemIds.add(id);
  try{
    await api('delete_item',{ITEM_ID:id});
    await loadDashboard(true);
    await loadDeadline();
    toast('Item '+id+' berhasil dihapus');
  }catch(e){
    toast('Gagal menghapus item '+id+': '+e.message,false);
  }finally{
    deletingItemIds.delete(id);
  }
}

function findItem(id){for(const o of orders){const i=(o.items||[]).find(x=>x.ITEM_ID===id);if(i)return{o,i}}return null}

function orderMoneyValue(value){
  return receiptParseMoney(value);
}
function getOrderTotalAmount(order){
  const items=Array.isArray(order?.items)?order.items:[];
  const hasItemAmounts=items.some(item=>item?.TAGIHAN!==undefined&&item?.TAGIHAN!==null&&String(item.TAGIHAN).trim()!=='');
  return hasItemAmounts?items.reduce((sum,item)=>sum+orderMoneyValue(item.TAGIHAN),0):orderMoneyValue(order?.TOTAL_TAGIHAN);
}
function isInstitutionOrder(order){
  return getOrderType(order).type==='INSTANSI' ||
    String(order?.JENIS_ORDER||'').toUpperCase()==='INSTANSI' ||
    Boolean(String(order?.NAMA_INSTANSI||'').trim());
}
function getOrderUnit(order,packageName){
  if(isInstitutionOrder(order))return 'pcs';
  if(packageName===undefined||packageName===null||String(packageName)==='')return 'kg';
  return PACKAGE_CATALOG[String(packageName).trim().toUpperCase()]?.unit||'unit';
}
function parseOrderQuantity(value){
  const raw=String(value??'').trim().replace(/,/g,'.').replace(/[^\d.-]/g,'');
  const n=Number(raw);
  return Number.isFinite(n)?n:0;
}

async function setStatus(item,status){if(!confirm('Ubah item menjadi '+status+'?'))return;try{await api('update_status',{ITEM_ID:item,STATUS:status});await loadDashboard(true);if(status==='SIAP')loadDeadline();toast('Status berhasil diperbarui')}catch(e){toast(e.message,false)}}

async function markReady(item){if(!confirm('Tandai item sebagai SIAP?'))return;try{await api('ready_item',{ITEM_ID:item,STATUS:'SIAP'});await loadDashboard(true);await loadDeadline();toast('Item ditandai SIAP')}catch(e){toast(e.message,false)}}

function ensureEditCustomInput(){
  let wrapper=$('edit-custom-package-wrap');
  if(!wrapper){
    wrapper=document.createElement('label');
    wrapper.id='edit-custom-package-wrap';
    wrapper.className='block md:col-span-2';
    wrapper.style.display='none';
    wrapper.innerHTML='<span class="label">NAMA PAKET CUSTOM</span><input id="edit-custom-package-name" class="input" placeholder="Isi nama paket sendiri">';
    $('edit-paket').closest('label').insertAdjacentElement('afterend',wrapper);
  }
  return {wrapper,input:$('edit-custom-package-name')};
}

function editItem(id){
  const f=findItem(id);
  if(!f)return toast('Item tidak ditemukan. Refresh dashboard lalu coba lagi.',false);
  const o=f.o,i=f.i;
  if(String(i.STATUS||'').toUpperCase()==='SELESAI')return toast('Item SELESAI tidak dapat diedit.',false);

  const identity=getOrderType(o);
  const instansi=identity.instansi||String(o.NAMA_INSTANSI||'').toUpperCase();
  const inst=isInstitutionOrder(o);
  const current=String(i.PAKET||'').trim();
  const currentKey=current.toUpperCase();
  const known=inst
    ?Object.prototype.hasOwnProperty.call(INSTITUTION_CATALOG[instansi]||{},currentKey)
    :Object.prototype.hasOwnProperty.call(PACKAGE_CATALOG,currentKey);
  const custom=Boolean(current)&&!known;
  const catalog=inst?Object.keys(INSTITUTION_CATALOG[instansi]||{}):[...PACKAGES];

  $('edit-item').value=id;
  $('edit-id').textContent='#'+o.ORDER_ID+' • '+id;
  $('edit-nama').value=o.NAMA||'';
  $('edit-wa').value=o.NO_WA||'';
  const select=$('edit-paket');
  select.innerHTML=(inst
    ?catalog.map(p=>'<option value="'+esc(p)+'" '+(p===currentKey?'selected':'')+'>'+esc(institutionPackageLabel(instansi,p,INSTITUTION_CATALOG[instansi][p]))+'</option>').join('')
    :catalog.map(p=>'<option value="'+esc(p)+'" '+(p===currentKey?'selected':'')+'>'+esc(packageOptionLabel(p))+'</option>').join('')
  )+'<option value="'+PACKAGE_CUSTOM_OPTION+'" '+(custom?'selected':'')+'>CUSTOM — Isi nama paket sendiri</option>';
  select.value=custom?PACKAGE_CUSTOM_OPTION:currentKey;
  select.dataset.mode=inst?'INSTANSI':'REGULER';
  select.dataset.instansi=instansi;
  $('edit-paket-label').textContent=inst?'ITEM':'PAKET';

  const customInput=ensureEditCustomInput();
  customInput.input.value=custom?current:'';
  customInput.wrapper.style.display=custom?'':'none';

  $('edit-berat-label').textContent=inst?'JUMLAH (PCS)':(custom?'JUMLAH (UNIT)':(PACKAGE_CATALOG[currentKey]?.unit==='kg'?'BERAT (KG)':'JUMLAH ('+(PACKAGE_CATALOG[currentKey]?.unit||'unit').toUpperCase()+')'));
  const qty=$('edit-berat');
  const currentUnit=inst?'pcs':(custom?'unit':(PACKAGE_CATALOG[currentKey]?.unit||'unit'));
  qty.dataset.int=(!inst&&currentUnit==='kg')?'':'1';
  qty.inputMode=(!inst&&currentUnit==='kg')?'decimal':'numeric';
  qty.value=inst?String(Math.round(parseOrderQuantity(i.BERAT))):String(i.BERAT??'');
  $('edit-tagihan').value=String(orderMoneyValue(i.TAGIHAN));
  $('edit-help').textContent='Harga awal mengikuti pricelist (rentang memakai tarif minimum) dan tetap bisa diedit. Mengubah paket atau jumlah akan menghitung ulang harga otomatis.';

  select.onchange=()=>editRecalc(true);
  qty.oninput=()=>editRecalc(true);
  customInput.input.oninput=()=>{};
  editRecalc(false);
  $('editModal').classList.add('show');
  document.body.classList.add('overflow-hidden');
}

function editRecalc(forceAuto=false){
  const qtyField=$('edit-berat');
  const select=$('edit-paket');
  const input=$('edit-tagihan');
  const inst=select.dataset.mode==='INSTANSI';
  const instansi=select.dataset.instansi||'';
  const custom=select.value===PACKAGE_CUSTOM_OPTION;
  const customField=$('edit-custom-package-name');
  if($('edit-custom-package-wrap'))$('edit-custom-package-wrap').style.display=custom?'':'none';
  const paket=custom?String(customField?.value||'').trim():select.value;
  const unit=inst?'pcs':(custom?'unit':(PACKAGE_CATALOG[paket]?.unit||'unit'));

  qtyField.dataset.int=(!inst&&unit==='kg')?'':'1';
  qtyField.inputMode=(!inst&&unit==='kg')?'decimal':'numeric';
  $('edit-berat-label').textContent=inst?'JUMLAH (PCS)':(unit==='kg'?'BERAT (KG)':'JUMLAH ('+unit.toUpperCase()+')');
  if(qtyField.dataset.int==='1'&&qtyField.value!==''){
    const normalized=String(Math.max(0,Math.round(parseOrderQuantity(qtyField.value))));
    if(qtyField.value!==normalized)qtyField.value=normalized;
  }

  input.readOnly=false;
  input.classList.add('num-input');
  if(forceAuto){
    if(custom)input.value='0';
    else if(inst)input.value=String(institutionItemAmount(instansi,paket,qtyField.value));
    else input.value=String(regularPackageAmount(paket,qtyField.value));
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

  const selectedPackage=$('edit-paket').value;
  const paket=selectedPackage===PACKAGE_CUSTOM_OPTION
    ?String($('edit-custom-package-name')?.value||'').trim()
    :selectedPackage;
  if(!paket)return toast('Isi nama paket custom terlebih dahulu.',false);

  const inst=isInstitutionOrder(o);
  const unit=inst?'pcs':(PACKAGE_CATALOG[paket]?.unit||'unit');
  const rawQty=parseOrderQuantity($('edit-berat').value);
  const qty=unit==='kg'?rawQty:Math.round(rawQty);
  if(!(qty>0))return toast((unit==='kg'?'Berat (KG)':'Jumlah ('+unit.toUpperCase()+')')+' harus lebih dari 0.',false);
  const identityForPackage=getOrderType(o);
  const instansiForPackage=identityForPackage.instansi||String(o.NAMA_INSTANSI||$('edit-paket').dataset.instansi||'').toUpperCase();
  const packageSize=institutionPackageSize(instansiForPackage,paket);
  const minimumQuantity=institutionMinimumQuantity(instansiForPackage,paket);
  if(inst&&instansiForPackage==='SECABA'&&paket.trim().toUpperCase()==='EXPRESS 1'&&qty<minimumQuantity)return toast(paket+' minimal '+minimumQuantity+' PCS.',false);
  if(inst&&institutionFixedPackage(instansiForPackage,paket)&&qty%packageSize!==0)return toast(paket+' harus berjumlah kelipatan '+packageSize+' PCS per paket.',false);
  const bill=orderMoneyValue($('edit-tagihan').value);
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
