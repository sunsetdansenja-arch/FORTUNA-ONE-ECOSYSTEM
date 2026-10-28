// Fortuna Laundry — dashboard print / PDF module
// Uses the browser print dialog so users can print physically or choose "Save as PDF".

function printMoney(v){
  const n=Number(String(v ?? '').replace(/[^0-9.-]/g,''))||0;
  return rupiah(n);
}

function printEscape(v){
  const s=String(v ?? '');
  return typeof esc==='function' ? esc(s) : s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function openPrintDocument(title, subtitle, bodyHtml, note){
  const w=window.open('','_blank','width=1100,height=800');
  if(!w){ toast('Popup diblokir browser. Izinkan popup untuk Fortuna.',false); return; }

  w.document.open();
  w.document.write(`<!doctype html><html lang="id"><head><meta charset="utf-8">
<title>${printEscape(title)}</title>
<style>
:root{--fs:11px;--fs-lg:12px}
@page{size:A4;margin:8mm 10mm}
*{box-sizing:border-box}
body{font-family:Arial,Helvetica,sans-serif;color:#17201c;margin:0;font-size:var(--fs);line-height:1.15}
h1{font-size:var(--fs-lg);margin:0 0 2px;font-weight:800}
.meta{color:#64748b;font-size:var(--fs);margin-bottom:6px}
table{width:100%;border-collapse:collapse}
thead{display:table-header-group}
tr{page-break-inside:avoid}
th{background:#f1f5f3;text-align:left;font-size:var(--fs);text-transform:uppercase;letter-spacing:0;color:#475569}
th,td{border:1px solid #dfe5e1;padding:1.5px 4px;vertical-align:top;font-size:var(--fs)}
tr.paid td{background:#dcfce7 !important}
td.amount,th.amount{text-align:right;white-space:nowrap}
td.no,th.no{width:24px;text-align:center;white-space:nowrap}
td.tgl{white-space:nowrap}
.total{margin-top:6px;display:flex;justify-content:flex-end;font-size:var(--fs-lg);font-weight:800}
.note{margin-top:8px;border:1px solid #dfe5e1;border-radius:3px;padding:4px 6px;page-break-inside:avoid}
.note b{display:block;font-size:var(--fs);margin-bottom:2px}
.note div{white-space:pre-wrap;font-size:var(--fs)}
.footer{margin-top:8px;color:#94a3b8;font-size:var(--fs)}
@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
</style></head><body>
<h1>${printEscape(title)}</h1><div class="meta">${printEscape(subtitle)}</div>
${bodyHtml}
${note?`<div class="note"><b>Keterangan</b><div>${printEscape(note)}</div></div>`:''}
<div class="footer">Dicetak dari Fortuna Laundry Dashboard • ${new Date().toLocaleString('id-ID')}</div>
</body></html>`);
  w.document.close();
  w.focus();
  setTimeout(()=>{w.print();},250);
}

function collectPrintOrders(){
  const q=String($('search')?.value||'').trim().toLowerCase();
  const dateFrom=$('orderDateFrom')?.value||'';
  const dateTo=$('orderDateTo')?.value||'';
  const activeMode=typeof orderMode!=='undefined'&&orderMode==='INSTANSI'?'INSTANSI':'REGULER';
  const list=(orders||[]).filter(o=>{
    const items=o.items||[];
    const identity=typeof getOrderType==='function'?getOrderType(o):{type:'REGULER',instansi:''};
    const orderDate=typeof orderDateFilterValue==='function'?orderDateFilterValue(o):'';
    const matchesMode=identity.type===activeMode;
    const matchesStatus=statusFilter==='ALL'||items.some(i=>String(i.STATUS||'').toUpperCase()===statusFilter);
    const matchesSearch=(String(o.ORDER_ID||'')+' '+identity.type+' '+identity.instansi+' '+String(o.NAMA||'')+' '+String(o.PAKET||'')+' '+items.map(i=>i.PAKET).join(' ')).toLowerCase().includes(q);
    const matchesDate=(!dateFrom||(orderDate&&orderDate>=dateFrom))&&(!dateTo||(orderDate&&orderDate<=dateTo));
    return matchesMode&&matchesStatus&&matchesSearch&&matchesDate;
  });

  const filterLabel=statusFilter==='ALL'?'Semua status':statusFilter;
  const modeLabel=activeMode==='INSTANSI'?'Instansi':'Reguler';
  const instansiNames=[...new Set(list.map(o=>typeof getOrderType==='function'?getOrderType(o).instansi:'').filter(Boolean))];
  const scopeLabel=activeMode==='INSTANSI'&&instansiNames.length?instansiNames.join(', '):modeLabel;
  return {list,q,dateFrom,dateTo,filterLabel,scopeLabel};
}

// Langkah 1: tombol "Cetak / PDF" -> pop up isi keterangan
function printOrders(){
  const c=collectPrintOrders();
  const sum=$('printNoteSummary');
  if(sum)sum.textContent=c.list.length+' order • Mode: '+c.scopeLabel+' • Filter: '+c.filterLabel+(c.dateFrom||c.dateTo?' • Tanggal: '+(c.dateFrom||'awal')+' s/d '+(c.dateTo||'sekarang'):'')+(c.q?' • Pencarian: '+c.q:'');
  const ta=$('printNoteText');
  if(ta)ta.value='';
  $('printNoteModal').classList.add('show');
  setTimeout(()=>ta&&ta.focus(),60);
}

// Langkah 2: tombol "Lanjut Cetak" di pop up -> preview/cetak dengan keterangan di bagian bawah
function confirmPrintOrders(){
  const note=String($('printNoteText')?.value||'').trim();
  closeModal('printNoteModal');
  renderOrdersPrint(note);
}

function renderOrdersPrint(note){
  const {list,q,dateFrom,dateTo,filterLabel,scopeLabel}=collectPrintOrders();
  const rows=list.map((o,idx)=>{
    const items=(o.items||[]).map(i=>`${printEscape(typeof packageDisplayName==='function'?packageDisplayName(i.PAKET):i.PAKET)} (${printEscape(i.BERAT)} ${printEscape(typeof getOrderUnit==='function'?getOrderUnit(o,i.PAKET):'kg')})`).join('<br>');
    const method=String(o.METODE_TRANSAKSI||'').trim();
    const methodLabel=!method||method.toUpperCase()==='BELUM LUNAS'?'Belum ditentukan':method;
    const paymentStatus=String(o.STATUS_PEMBAYARAN||'').trim()||(method.toUpperCase()==='BELUM LUNAS'?'BELUM LUNAS':'-');
    const isPaid=paymentStatus.toUpperCase()==='LUNAS';
    return `<tr class="${isPaid?'paid':''}">
      <td class="no">${idx+1}</td>
      <td>#${printEscape(o.ORDER_ID)}</td>
      <td class="tgl">${printEscape(typeof orderDateFilterValue==='function'&&o.START?receiptFormatDate(receiptParseDate(o.START)):'-')}</td>
      <td><b>${printEscape(o.NAMA)}</b><br>${printEscape(o.NO_WA)}</td>
      <td>${items||'-'}</td>
      <td>${printEscape(methodLabel)}</td>
      <td>${printEscape(paymentStatus)}</td>
      <td class="amount">${printMoney(typeof getOrderTotalAmount==='function'?getOrderTotalAmount(o):o.TOTAL_TAGIHAN)}</td>
    </tr>`;
  }).join('')||'<tr><td colspan="8" style="text-align:center">Tidak ada order yang cocok.</td></tr>';

  openPrintDocument(
    'Daftar Order — Fortuna Laundry',
    `${list.length} order • Mode: ${scopeLabel} • Filter: ${filterLabel}${dateFrom||dateTo?' • Tanggal: '+(dateFrom||'awal')+' s/d '+(dateTo||'sekarang'):''}${q?' • Pencarian: '+q:''}`,
    `<table><thead><tr><th class="no">No</th><th>Order</th><th>Tanggal</th><th>Pelanggan</th><th>Paket</th><th>Metode Pembayaran</th><th>Status Pembayaran</th><th class="amount">Total</th></tr></thead><tbody>${rows}</tbody></table>
    <div class="total">Total nominal: ${printMoney(list.reduce((s,o)=>s+(typeof getOrderTotalAmount==='function'?getOrderTotalAmount(o):(Number(String(o.TOTAL_TAGIHAN||'').replace(/[^0-9.-]/g,''))||0)),0))}</div>`,
    note
  );
}
function printExpenses(){
  const q=String($('expenseSearch')?.value||'').trim().toLowerCase();
  const method=$('expenseMethodFilter')?.value||'ALL';
  const list=getFilteredExpenses();
  const dateRange=typeof expenseDateRangeLabel==='function'?expenseDateRangeLabel():'Semua tanggal';

  const rows=list.map(x=>`<tr>
    <td>${printEscape(expenseDateLabel(x.TANGGAL))}</td>
    <td>${printEscape(x.EXPENSE_ID||'-')}</td>
    <td>${printEscape(x.KETERANGAN||'-')}</td>
    <td>${printEscape(String(x.KATEGORI||'LAINNYA').toUpperCase())}</td>
    <td>${printEscape(x.METODE_TRANSAKSI||'-')}</td>
    <td class="amount">${printMoney(x.NOMINAL)}</td>
  </tr>`).join('')||'<tr><td colspan="6" style="text-align:center">Tidak ada expense yang cocok.</td></tr>';

  const total=list.reduce((s,x)=>s+(Number(String(x.NOMINAL||'').replace(/[^0-9.-]/g,''))||0),0);
  openPrintDocument(
    'Laporan Finance — Fortuna Laundry',
    `${list.length} transaksi • Metode: ${method==='ALL'?'Semua':method} • ${dateRange}${q?' • Pencarian: '+q:''} • Urut tanggal: ${expenseSortLabel()}`,
    `<table><thead><tr><th>Tanggal</th><th>ID</th><th>Keterangan</th><th>Kategori</th><th>Metode</th><th class="amount">Nominal</th></tr></thead><tbody>${rows}</tbody></table>
    <div class="total">Total nominal: ${printMoney(total)}</div>`
  );
}
