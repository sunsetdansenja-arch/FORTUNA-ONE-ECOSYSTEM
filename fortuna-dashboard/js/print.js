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

function openPrintDocument(title, subtitle, bodyHtml){
  const w=window.open('','_blank','width=1100,height=800');
  if(!w){ toast('Popup diblokir browser. Izinkan popup untuk Fortuna.',false); return; }

  w.document.open();
  w.document.write(`<!doctype html><html lang="id"><head><meta charset="utf-8">
<title>${printEscape(title)}</title>
<style>
@page{size:A4;margin:14mm}
*{box-sizing:border-box}
body{font-family:Arial,Helvetica,sans-serif;color:#17201c;margin:0;font-size:11px}
h1{font-size:20px;margin:0 0 4px;font-weight:800}
.meta{color:#64748b;font-size:10px;margin-bottom:16px}
table{width:100%;border-collapse:collapse}
th{background:#f1f5f3;text-align:left;font-size:9px;text-transform:uppercase;letter-spacing:.04em;color:#475569}
th,td{border:1px solid #dfe5e1;padding:7px 8px;vertical-align:top}
td.amount,th.amount{text-align:right;white-space:nowrap}
.total{margin-top:12px;display:flex;justify-content:flex-end;font-size:12px;font-weight:800}
.footer{margin-top:18px;color:#94a3b8;font-size:9px}
@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
</style></head><body>
<h1>${printEscape(title)}</h1><div class="meta">${printEscape(subtitle)}</div>
${bodyHtml}
<div class="footer">Dicetak dari Fortuna Laundry Dashboard • ${new Date().toLocaleString('id-ID')}</div>
</body></html>`);
  w.document.close();
  w.focus();
  setTimeout(()=>{w.print();},250);
}

function printOrders(){
  const q=String($('search')?.value||'').trim().toLowerCase();
  const list=(orders||[]).filter(o=>{
    const items=o.items||[];
    const matchesStatus=statusFilter==='ALL'||items.some(i=>String(i.STATUS||'').toUpperCase()===statusFilter);
    const matchesSearch=(String(o.ORDER_ID||'')+' '+String(o.NAMA||'')+' '+String(o.PAKET||'')+' '+items.map(i=>i.PAKET).join(' ')).toLowerCase().includes(q);
    return matchesStatus&&matchesSearch;
  });

  const filterLabel=statusFilter==='ALL'?'Semua status':statusFilter;
  const rows=list.map(o=>{
    const items=(o.items||[]).map(i=>`${printEscape(i.PAKET)} (${printEscape(i.BERAT)} kg) — ${printEscape(i.STATUS)}`).join('<br>');
    return `<tr>
      <td>#${printEscape(o.ORDER_ID)}</td>
      <td><b>${printEscape(o.NAMA)}</b><br>${printEscape(o.NO_WA)}</td>
      <td>${items||'-'}</td>
      <td class="amount">${printMoney(o.TOTAL_TAGIHAN)}</td>
    </tr>`;
  }).join('')||'<tr><td colspan="4" style="text-align:center">Tidak ada order yang cocok.</td></tr>';

  openPrintDocument(
    'Daftar Order — Fortuna Laundry',
    `${list.length} order • Filter: ${filterLabel}${q?' • Pencarian: '+q:''}`,
    `<table><thead><tr><th>Order</th><th>Pelanggan</th><th>Paket / Status</th><th class="amount">Total</th></tr></thead><tbody>${rows}</tbody></table>
    <div class="total">Total nominal: ${printMoney(list.reduce((s,o)=>s+(Number(String(o.TOTAL_TAGIHAN||'').replace(/[^0-9.-]/g,''))||0),0))}</div>`
  );
}

function printExpenses(){
  const q=String($('expenseSearch')?.value||'').trim().toLowerCase();
  const method=$('expenseMethodFilter')?.value||'ALL';
  const list=(expenses||[]).filter(x=>{
    const hay=String(x.KETERANGAN||'')+' '+String(x.EXPENSE_ID||'');
    return (!q||hay.toLowerCase().includes(q))&&(method==='ALL'||String(x.METODE_TRANSAKSI||'')===method);
  });

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
    `${list.length} transaksi • Metode: ${method==='ALL'?'Semua':method}${q?' • Pencarian: '+q:''}`,
    `<table><thead><tr><th>Tanggal</th><th>ID</th><th>Keterangan</th><th>Kategori</th><th>Metode</th><th class="amount">Nominal</th></tr></thead><tbody>${rows}</tbody></table>
    <div class="total">Total nominal: ${printMoney(total)}</div>`
  );
}
