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
// Laporan harian keuangan (PDF/cetak) dari daftar expense yang sedang terfilter.
// Debit = pemasukan (per metode), Kredit = pengeluaran. Semua angka dihitung dari data; tidak ada input baru.
function expenseReportAmount(v){
  return typeof receiptParseMoney==='function'?receiptParseMoney(v):(Number(String(v??'').replace(/[^0-9.-]/g,''))||0);
}
function expenseReportDay(v){
  const raw=String(v??'').trim();
  if(/^\d{4}-\d{2}-\d{2}/.test(raw))return raw.slice(0,10);
  const d=new Date(raw);
  return isNaN(d.getTime())?'':d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}
function expenseReportDate(day){return day?day.slice(8,10)+'/'+day.slice(5,7)+'/'+day.slice(0,4):'-'}

function openExpenseReport(html,title){
  const w=window.open('','_blank','width=1000,height=800');
  if(!w){ toast('Popup diblokir browser. Izinkan popup untuk Fortuna.',false); return; }
  w.document.open();
  w.document.write(`<!doctype html><html lang="id"><head><meta charset="utf-8"><title>${printEscape(title)}</title>
<style>
@page{size:A4;margin:10mm}
*{box-sizing:border-box}
body{font-family:Arial,Helvetica,sans-serif;color:#000;margin:0;font-size:10px;line-height:1.2}
h1{font-size:14px;text-align:center;margin:0 0 10px;font-weight:800}
.top{display:flex;justify-content:space-between;gap:16px;margin-bottom:10px}
.info,.sum{border-collapse:collapse}
.info td{padding:1px 4px}
.sum td{padding:1px 6px}
.sum td.v{text-align:right;white-space:nowrap;min-width:90px}
.sum tr.t td{font-weight:800;border-top:1px solid #000}
table.rep{width:100%;border-collapse:collapse}
table.rep th,table.rep td{border:1px solid #000;padding:2px 4px;vertical-align:middle}
table.rep th{background:#f1f1f1;text-align:center;font-weight:700}
table.rep thead{display:table-header-group}
table.rep tr{page-break-inside:avoid}
td.c{text-align:center}td.a{text-align:right;white-space:nowrap}
.note{margin-top:10px;border:1px solid #000;padding:4px 6px}
.foot{margin-top:8px;color:#666;font-size:9px}
@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
</style></head><body>${html}</body></html>`);
  w.document.close();
  w.focus();
  setTimeout(()=>{w.print();},250);
}

function printExpenses(){
  const list=getFilteredExpenses();
  const R=n=>rupiah(n);
  const E=printEscape;
  const hasTransfer=list.some(x=>String(x.METODE_TRANSAKSI||'').toUpperCase()==='TRANSFER');
  const methods=hasTransfer?['CASH','QRIS','TRANSFER']:['CASH','QRIS'];
  const isDebit=x=>String(x.KATEGORI||'').toUpperCase()==='DEBIT';   // selain DEBIT dihitung KREDIT (pilihan form hanya DEBIT/KREDIT)

  const inByMethod={CASH:0,QRIS:0,TRANSFER:0};
  let inOther=0,out=0;
  list.forEach(x=>{
    const n=expenseReportAmount(x.NOMINAL);
    if(isDebit(x)){
      const m=String(x.METODE_TRANSAKSI||'').toUpperCase();
      if(m in inByMethod)inByMethod[m]+=n;else inOther+=n;
    }else out+=n;
  });
  const totalIn=inByMethod.CASH+inByMethod.QRIS+inByMethod.TRANSFER+inOther;
  const saldo=totalIn-out;

  // Tahun / bulan / tanggal dari data yang dicetak (satu hari -> "10"; beberapa hari -> "10 - 12")
  const days=[...new Set(list.map(x=>expenseReportDay(x.TANGGAL)).filter(Boolean))].sort();
  const MONTHS=['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
  const uniq=a=>[...new Set(a)];
  const years=uniq(days.map(d=>d.slice(0,4)));
  const months=uniq(days.map(d=>MONTHS[+d.slice(5,7)-1]));
  const dayNums=days.length>1?days[0].slice(8,10)+' - '+days[days.length-1].slice(8,10):(days[0]||'-').slice(8,10)||'-';
  const info=[['Tahun',years.join(' - ')||'-'],['Bulan',months.join(' - ')||'-'],['Tanggal',dayNums]];

  const sumRows=[['Total Cash',inByMethod.CASH],['Total Qris',inByMethod.QRIS]];
  if(hasTransfer)sumRows.push(['Total Transfer',inByMethod.TRANSFER]);
  if(inOther)sumRows.push(['Total Lainnya',inOther]);
  sumRows.push(['Total Pengeluaran',out]);

  const mCols=methods.length;
  const rows=list.map((x,i)=>{
    const n=expenseReportAmount(x.NOMINAL);
    const debit=isDebit(x);
    const m=String(x.METODE_TRANSAKSI||'').toUpperCase();
    const cells=methods.map(k=>`<td class="a">${m===k?R(n):''}</td>`).join('');
    return `<tr><td class="c">${i+1}</td><td class="c">${expenseReportDate(expenseReportDay(x.TANGGAL))}</td><td>${E(x.EXPENSE_ID||'-')}</td><td>${E(x.KETERANGAN||'-')}</td>
      <td class="c">${debit?'DEBIT':''}</td><td class="c">${debit?'':'KREDIT'}</td>${cells}</tr>`;
  }).join('')||`<tr><td colspan="${6+mCols}" class="c">Tidak ada expense yang cocok.</td></tr>`;

  const html=`<h1>Laporan Harian Keuangan Fortuna Laundry</h1>
  <div class="top">
    <table class="info">${info.map(r=>`<tr><td>${r[0]}</td><td>:</td><td>${E(r[1])}</td></tr>`).join('')}</table>
    <table class="sum">${sumRows.map(r=>`<tr><td>${r[0]}</td><td>:</td><td class="v">${R(r[1])}</td></tr>`).join('')}
      <tr class="t"><td>Total Saldo</td><td>:</td><td class="v">${R(saldo)}</td></tr></table>
  </div>
  <table class="rep"><thead>
    <tr><th rowspan="2">No</th><th rowspan="2">Tanggal</th><th rowspan="2">ID</th><th rowspan="2">Keterangan</th><th colspan="2">Kategori</th><th colspan="${mCols}">Metode/Nominal</th></tr>
    <tr><th>DEBIT</th><th>KREDIT</th>${methods.map(k=>`<th>${k==='QRIS'?'QRIS':k}</th>`).join('')}</tr>
  </thead><tbody>${rows}</tbody></table>
  <div class="foot">Dicetak dari Fortuna Laundry Dashboard • ${new Date().toLocaleString('id-ID')}</div>`;
  openExpenseReport(html,'Laporan Harian Keuangan — Fortuna Laundry');
}
