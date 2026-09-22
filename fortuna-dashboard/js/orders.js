// Fortuna Laundry — orders module

function normalize(o){return o}

function addPackage(data={}){const row=document.createElement('div');row.className='package-row';row.innerHTML=`<div class="flex gap-2"><select class="input package flex-1">${PACKAGES.map(p=>`<option ${p===(data.PAKET||'FLEKSIBEL')?'selected':''}>${p}</option>`).join('')}</select><button type="button" onclick="this.closest('.package-row').remove();calcTotal()" class="w-10 rounded-xl bg-red-50 text-red-600"><i class="fa-solid fa-trash"></i></button></div><div class="grid grid-cols-2 gap-2 mt-2"><input class="input weight num-input" inputmode="decimal" value="${esc(data.BERAT||'')}" placeholder="Berat (kg)"><input class="input amount num-input" inputmode="decimal" value="${esc(data.TAGIHAN||'')}" placeholder="Tagihan"></div>`;$('packageRows').appendChild(row);row.querySelectorAll('input').forEach(x=>x.addEventListener('input',calcTotal));}

function calcTotal(){let t=0;document.querySelectorAll('#packageRows .amount').forEach(x=>t+=Number(String(x.value).replace(/[^0-9.-]/g,''))||0);$('orderTotal').textContent=rupiah(t)}

function draftOrder(e){e.preventDefault();const rows=[...document.querySelectorAll('#packageRows .package-row')];if(!rows.length){toast('Tambahkan minimal satu paket',false);return}draft={NAMA:$('f-nama').value.trim(),NO_WA:$('f-wa').value.trim(),METODE_TRANSAKSI:$('f-payment').value,items:rows.map(r=>({PAKET:r.querySelector('.package').value,BERAT:r.querySelector('.weight').value,TAGIHAN:r.querySelector('.amount').value}))};try{previewMode='create';previewOrder={...draft,ORDER_ID:'PREVIEW'};$('receiptPreview').innerHTML=receiptHTML(previewOrder);setPreviewButtons('create');$('previewTitle').textContent='Preview Struk';$('previewSubtitle').textContent='Periksa sebelum menyimpan';$('previewModal').classList.add('show');document.body.classList.add('overflow-hidden')}catch(err){toast('Preview gagal: '+err.message,false)}}

function renderOrders(){
  const q=($('search')?.value||'').toLowerCase();
  const list=orders.filter(o=>{
    const items=o.items||[];
    const matchesStatus=statusFilter==='ALL'||items.some(i=>String(i.STATUS||'').toUpperCase()===statusFilter);
    const matchesSearch=(o.ORDER_ID+' '+o.NAMA+' '+o.PAKET+' '+items.map(i=>i.PAKET).join(' ')).toLowerCase().includes(q);
    return matchesStatus&&matchesSearch;
  });
  $('orderCount').textContent=list.length+' order'+(statusFilter!=='ALL'?' • filter '+statusFilter:'');
  $('orderRows').innerHTML=list.map(o=>{
    const unpaid=o.STATUS_PEMBAYARAN==='BELUM LUNAS';
    const allDone=(o.items||[]).length>0&&(o.items||[]).every(i=>i.STATUS==='SELESAI');
    const itemHtml=(o.items||[]).map(i=>`
      <div class="order-item">
        <div class="order-item-head">
          <div class="order-item-name">${esc(i.PAKET)}</div>
          <span class="pill s-${esc(i.STATUS)}">${esc(i.STATUS)}</span>
        </div>
        <div class="order-item-meta"><span>${esc(i.BERAT)} kg</span><span>•</span><span>${rupiah(i.TAGIHAN)}</span></div>
      </div>`).join('');
    const itemActions=(o.items||[]).filter(i=>i.STATUS!=='SELESAI').map(i=>`
      <div class="order-action-item">
        <span class="text-[8px] font-black text-slate-400 self-center mr-1">${esc(i.ITEM_ID)}</span>
        <button onclick="editItem('${esc(i.ITEM_ID)}')" title="Edit ${esc(i.ITEM_ID)}" class="btn text-slate-500 bg-slate-100 rounded-lg px-2 py-1 text-[10px]"><i class="fa-solid fa-pen"></i></button>
        ${i.STATUS==='DITERIMA'?`<button onclick="setStatus('${esc(i.ITEM_ID)}','DIPROSES')" class="btn text-[9px] bg-orange-50 text-orange-700 rounded-lg px-2 py-1">PROSES</button>`:''}
        ${i.STATUS==='DIPROSES'?`<button onclick="setStatus('${esc(i.ITEM_ID)}','QC')" class="btn text-[9px] bg-blue-50 text-blue-700 rounded-lg px-2 py-1">QC</button>`:''}
        ${i.STATUS==='QC'||i.STATUS==='DIPROSES'?`<button onclick="setStatus('${esc(i.ITEM_ID)}','SIAP')" class="btn text-[9px] bg-emerald-50 text-emerald-700 rounded-lg px-2 py-1">SIAP</button>`:''}
        ${i.STATUS==='SIAP'?`<button onclick="setStatus('${esc(i.ITEM_ID)}','SELESAI')" class="btn text-[9px] bg-slate-900 text-white rounded-lg px-2 py-1">SELESAI</button>`:''}
      </div>`).join('');
    return `<tr class="border-t border-slate-100 align-top">
      <td class="px-3 py-2.5 font-black whitespace-nowrap">#${esc(o.ORDER_ID)}<div class="text-[9px] text-slate-400 mt-0.5">${o.START?new Date(o.START.replace(' ','T')).toLocaleString('id-ID',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}):''}</div></td>
      <td class="px-3 py-2.5 min-w-[130px]"><b class="text-xs">${esc(o.NAMA)}</b><div class="text-[9px] text-slate-400">${esc(o.NO_WA)}</div>${unpaid?'<span class="pill unpaid inline-block mt-1">BELUM LUNAS</span>':''}</td>
      <td class="px-3 py-2.5 min-w-[270px]"><div class="order-package-list">${itemHtml}</div></td>
      <td class="px-3 py-2.5 whitespace-nowrap"><div class="order-total"><span class="order-total-label">Total</span><span class="order-total-value">${rupiah(o.TOTAL_TAGIHAN)}</span></div></td>
      <td class="px-3 py-2.5 min-w-[185px]"><div class="order-actions">
        <div class="order-action-top">
          ${unpaid&&!allDone?`<button onclick="openPay('${esc(o.ORDER_ID)}')" class="btn text-[10px] font-black bg-red-50 text-red-700 rounded-lg px-2.5 py-1.5"><i class="fa-solid fa-check mr-1"></i>LUNAS</button>`:''}
          <button onclick="printOrder('${esc(o.ORDER_ID)}')" title="Print" class="btn text-slate-600 bg-slate-100 rounded-lg px-2.5 py-1.5"><i class="fa-solid fa-print"></i></button>
          <button onclick="waOrder('${esc(o.ORDER_ID)}')" title="WhatsApp" class="btn text-emerald-700 bg-emerald-50 rounded-lg px-2.5 py-1.5"><i class="fa-brands fa-whatsapp"></i></button>
        </div>
        ${!allDone&&itemActions?`<div class="order-action-status">${itemActions}</div>`:''}
      </div></td>
    </tr>`;
  }).join('')||`<tr><td colspan="5" class="p-10 text-center text-slate-400">Belum ada order.</td></tr>`;
}

function toggleStatusFilter(filter,force=false){if(!force&&statusFilter===filter&&filter!=='ALL')statusFilter='ALL';else statusFilter=filter;document.querySelectorAll('.summary-filter').forEach(b=>b.classList.toggle('active',b.dataset.filter===statusFilter));renderOrders()}

function renderSummary(){for(const k of ['total','diterima','diproses','qc','siap','selesai'])$('sum-'+k).textContent=summary[k]||0}
let summary={};

async function loadDashboard(silent=false){try{const j=await api('read');orders=j.data?.orders||[];summary=j.data?.summary||{};renderSummary();renderOrders();if(!silent)toast('Data berhasil diperbarui')}catch(e){toast('Gagal memuat dashboard: '+e.message,false)}}

function findItem(id){for(const o of orders){const i=(o.items||[]).find(x=>x.ITEM_ID===id);if(i)return{o,i}}return null}

async function setStatus(item,status){if(!confirm('Ubah item menjadi '+status+'?'))return;try{await api('update_status',{ITEM_ID:item,STATUS:status});await loadDashboard(true);if(status==='SIAP')loadDeadline();toast('Status berhasil diperbarui')}catch(e){toast(e.message,false)}}

async function markReady(item){if(!confirm('Tandai item sebagai SIAP?'))return;try{await api('ready_item',{ITEM_ID:item,STATUS:'SIAP'});await loadDashboard(true);await loadDeadline();toast('Item ditandai SIAP')}catch(e){toast(e.message,false)}}

function editItem(id){const f=findItem(id);if(!f||f.o.STATUS==='SELESAI')return;const o=f.o,i=f.i;$('edit-item').value=id;$('edit-id').textContent='#'+o.ORDER_ID+' • '+id;$('edit-nama').value=o.NAMA;$('edit-wa').value=o.NO_WA;$('edit-paket').innerHTML=PACKAGES.map(p=>`<option ${p===i.PAKET?'selected':''}>${p}</option>`).join('');$('edit-berat').value=i.BERAT||'';$('edit-tagihan').value=i.TAGIHAN||'';$('editModal').classList.add('show')}

async function saveEdit(e){e.preventDefault();try{await api('order_edit',{ITEM_ID:$('edit-item').value,NAMA:$('edit-nama').value,NO_WA:$('edit-wa').value,PAKET:$('edit-paket').value,BERAT:$('edit-berat').value,TAGIHAN:$('edit-tagihan').value});closeModal('editModal');await loadDashboard(true);toast('Item diperbarui')}catch(e){toast(e.message,false)}}

function openPay(id){payOrder=id;$('payModal').classList.add('show')}

async function pay(method){try{await api('payment_update',{ORDER_ID:payOrder,METODE_TRANSAKSI:method});closeModal('payModal');await loadDashboard(true);toast('Pembayaran #'+payOrder+' menjadi LUNAS')}catch(e){toast(e.message,false)}}
