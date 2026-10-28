// Fortuna Laundry — expense module

function expenseDateLabel(v){if(!v)return '-';const d=new Date(String(v).length<=10?String(v)+'T00:00:00':String(v));return Number.isNaN(d.getTime())?String(v):d.toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric'});}

let expenses=[];

// ---- Urutan tanggal (dipakai tampilan, Cetak/PDF, dan ekspor Excel/CSV) ----
// DESC = terbaru dulu (default), ASC = terlama dulu. Tanggal tidak valid selalu di paling bawah.
function expenseSortDir(){return $('expenseSort')?.value==='ASC'?'ASC':'DESC'}
function expenseSortLabel(){return expenseSortDir()==='ASC'?'Terlama → Terbaru':'Terbaru → Terlama'}
function expenseTime(x){const v=String(x.TANGGAL||'').trim();return v?Date.parse(v.length<=10?v+'T00:00:00':v):NaN}
function getFilteredExpenses(){
  const q=String($('expenseSearch')?.value||'').trim().toLowerCase();
  const method=$('expenseMethodFilter')?.value||'ALL';
  const dir=expenseSortDir()==='ASC'?1:-1;
  const list=(expenses||[]).filter(x=>{
    const hay=String(x.KETERANGAN||'')+' '+String(x.EXPENSE_ID||'');
    return(!q||hay.toLowerCase().includes(q))&&(method==='ALL'||String(x.METODE_TRANSAKSI||'')===method);
  });
  return list.map((x,i)=>({x,i,t:expenseTime(x)})).sort((a,b)=>{
    const an=Number.isNaN(a.t),bn=Number.isNaN(b.t);
    if(an||bn)return an&&bn?a.i-b.i:(an?1:-1);
    if(a.t!==b.t)return(a.t-b.t)*dir;
    const idc=String(a.x.EXPENSE_ID||'').localeCompare(String(b.x.EXPENSE_ID||''),undefined,{numeric:true})*dir;
    return idc||(a.i-b.i)*dir;
  }).map(o=>o.x);
}

function renderExpense(){const filtered=getFilteredExpenses();$('expenseListCount').textContent=filtered.length+' expense ditampilkan';$('expenseList').innerHTML=filtered.length?filtered.map(x=>`<div class="expense-row px-4 py-3.5"><div class="flex items-start justify-between gap-4"><div class="min-w-0"><div class="flex items-center gap-2 flex-wrap"><span class="text-[10px] text-slate-400">${esc(x.EXPENSE_ID||'')}</span></div><div class="font-bold text-sm mt-1.5 break-words">${esc(x.KETERANGAN||'-')}</div><div class="text-[11px] text-slate-500 mt-1">${expenseDateLabel(x.TANGGAL)}</div></div><div class="text-right shrink-0"><div class="font-black text-sm">${rupiah(x.NOMINAL)}</div><div class="pill mt-1 inline-block bg-slate-50 text-slate-500 border border-slate-200">${esc(x.METODE_TRANSAKSI||'-')}</div>${x.EXPENSE_ID?`<button onclick="deleteExpense('${esc(x.EXPENSE_ID)}')" title="Hapus expense ${esc(x.EXPENSE_ID)}" class="btn text-red-600 bg-red-50 rounded-md px-1.5 py-0.5 text-[9px] ml-1"><i class="fa-solid fa-trash"></i></button>`:''}</div><div class="pill mt-1 inline-block bg-slate-50 text-slate-500 border border-slate-200">${esc(String(x.KATEGORI||'LAINNYA').toUpperCase())}</div></div></div>`).join(''):`<div class="p-10 text-center text-slate-400 text-sm">Tidak ada expense yang cocok dengan filter.</div>`;}


function updateExpenseSummary(){const now=new Date();const today=now.toISOString().slice(0,10);const ym=now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0');const amount=x=>Number(String(x.NOMINAL||'').replace(/[^0-9.-]/g,''))||0;const day=expenses.filter(x=>String(x.TANGGAL||'').slice(0,10)===today).reduce((s,x)=>s+amount(x),0);const month=expenses.filter(x=>String(x.TANGGAL||'').slice(0,7)===ym).reduce((s,x)=>s+amount(x),0);$('expenseTotal').textContent=rupiah(day);$('expenseMonthTotal').textContent=rupiah(month);if($('expenseTodayLabel'))$('expenseTodayLabel').textContent=now.toLocaleDateString('id-ID',{weekday:'long',day:'2-digit',month:'long',year:'numeric'});$('expenseMonthLabel').textContent=now.toLocaleDateString('id-ID',{month:'long',year:'numeric'});}

async function loadExpense(){const btn=$('expenseRefreshBtn'),icon=$('expenseRefreshIcon');if(btn)btn.disabled=true;if(icon)icon.className='fa-solid fa-spinner fa-spin mr-1';try{const j=await api('expense_read');const d=j.data||{};expenses=Array.isArray(d.expenses)?d.expenses:[];updateExpenseSummary();renderExpense();toast('Expense berhasil diperbarui');}catch(e){toast('Expense gagal dimuat: '+e.message,false)}finally{if(btn)btn.disabled=false;if(icon)icon.className='fa-solid fa-rotate-right mr-1';}}

async function createExpense(e){e.preventDefault();const btn=$('expenseSaveBtn'),icon=$('expenseSaveIcon'),txt=$('expenseSaveText');if(btn?.disabled)return;btn.disabled=true;if(icon)icon.className='fa-solid fa-spinner fa-spin mr-1';if(txt)txt.textContent='Menyimpan...';try{await api('expense_create',{TANGGAL:$('e-tanggal').value,KATEGORI:$('e-kategori').value,KETERANGAN:$('e-keterangan').value,NOMINAL:$('e-nominal').value,METODE_TRANSAKSI:$('e-metode').value});e.target.reset();$('e-tanggal').value=new Date().toISOString().slice(0,10);await loadExpense();toast('Expense berhasil disimpan');}catch(err){toast('Expense gagal disimpan: '+err.message,false)}finally{btn.disabled=false;if(icon)icon.className='fa-solid fa-floppy-disk mr-1';if(txt)txt.textContent='Simpan Expense';}}

const deletingExpenseIds=new Set();
async function deleteExpense(expenseId){
  const id=String(expenseId||'');
  if(!id)return toast('ID expense tidak ditemukan.',false);
  if(deletingExpenseIds.has(id))return;
  const x=expenses.find(e=>String(e.EXPENSE_ID||'')===id);
  if(!x)return toast('Expense tidak ditemukan. Muat ulang daftar lalu coba lagi.',false);
  const approved=confirm(
    'HAPUS EXPENSE PERMANEN?\n\n'+
    'ID: '+id+'\n'+
    'Tanggal: '+expenseDateLabel(x.TANGGAL)+'\n'+
    'Kategori: '+String(x.KATEGORI||'LAINNYA').toUpperCase()+'\n'+
    'Keterangan: '+(x.KETERANGAN||'-')+'\n'+
    'Nominal: '+rupiah(x.NOMINAL)+'\n'+
    'Metode: '+(x.METODE_TRANSAKSI||'-')+'\n\n'+
    'Data ini akan dihapus dari backend dan tidak bisa dipulihkan dari dashboard. Total pengeluaran akan berubah. Lanjutkan?'
  );
  if(!approved)return;
  deletingExpenseIds.add(id);
  try{
    await api('delete_expense',{EXPENSE_ID:id});
    await loadExpense();
    toast('Expense '+id+' berhasil dihapus');
  }catch(err){
    toast('Expense gagal dihapus: '+err.message,false);
  }finally{
    deletingExpenseIds.delete(id);
  }
}
