// Fortuna Laundry — deadline module

function deadlineBucketClass(bucket){return bucket==='OVERDUE'?'deadline-overdue':bucket==='DEADLINE'?'deadline-critical':'deadline-priority'}

function deadlineBucketLabel(bucket){return bucket==='OVERDUE'?'TERLAMBAT':bucket==='DEADLINE'?'MENDEKATI DEADLINE':'PRIORITAS'}

function deadlineStatusClass(status){return 's-'+String(status||'').toUpperCase().replace(/[^A-Z0-9_-]/g,'')}

function deadlineSearchText(x){return [x.ORDER_ID,x.ITEM_ID,x.NAMA,x.PAKET,x.BERAT,x.STATUS,x.BUCKET].join(' ').toLowerCase()}

function deadlineNaturalText(readyAt){
  if(!readyAt)return 'Waktu READY belum ditentukan';
  const d=new Date(readyAt);
  if(Number.isNaN(d.getTime()))return 'Waktu READY belum ditentukan';
  const day=d.toLocaleDateString('id-ID',{weekday:'long'});
  const hour=d.getHours();
  const minute=String(d.getMinutes()).padStart(2,'0');
  let h=hour%12||12;
  const period=hour<11?'pagi':hour<15?'siang':hour<18?'sore':'malam';
  const time=`${h}:${minute}`;
  return `Harus sudah siap sebelum jam ${time} ${period} hari ${day}`;
}

function renderDeadline(){
  const q=String($('deadlineSearch')?.value||'').trim().toLowerCase();
  const list=deadlineItems.filter(x=>(deadlineFilter==='ALL'||x.BUCKET===deadlineFilter)&&(!q||deadlineSearchText(x).includes(q)));
  $('deadlineCount').textContent=list.length+' item'+(list.length===1?'':'s')+(deadlineFilter!=='ALL'?' • filter '+deadlineBucketLabel(deadlineFilter):'');
  $('deadlineList').innerHTML=list.length?list.map(x=>{
    const remain=Math.max(0,Math.min(100,Number(x.REMAINING_PERCENT)||0));
    const progress=Math.max(0,Math.min(100,100-remain));
    const bucket=x.BUCKET||'PRIORITY';
    const cls=deadlineBucketClass(bucket);
    const bar=bucket==='OVERDUE'?'bg-red-800':bucket==='DEADLINE'?'bg-red-500':'bg-amber-500';
    const target=x.READY_AT?new Date(x.READY_AT):null;
    const targetText=target&&!isNaN(target.getTime())?target.toLocaleString('id-ID',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}):'-';
    const readyBtn=x.STATUS==='SIAP'||x.STATUS==='SELESAI'?'':`<button onclick="markReady('${esc(x.ITEM_ID)}')" class="btn bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-lg px-2.5 py-1.5 text-[10px] font-black whitespace-nowrap"><i class="fa-solid fa-check mr-1"></i>SIAP</button>`;
    return `<div class="deadline-row ${cls}">
      <div class="deadline-main">
        <div class="deadline-id"><b>#${esc(x.ORDER_ID)}</b><span>${esc(x.ITEM_ID)}</span></div>
        <div class="deadline-customer"><b>${esc(x.NAMA||'-')}</b><span>${esc(x.PAKET||'-')}</span></div>
        <div class="deadline-meta"><span>${esc(x.BERAT||'0')} kg</span><span>•</span><span>READY ${targetText}</span><span>•</span><span class="pill ${deadlineStatusClass(x.STATUS)}">${esc(x.STATUS||'-')}</span></div>
        <div class="deadline-natural">${esc(deadlineNaturalText(x.READY_AT))}</div>
      </div>
      <div class="deadline-progress">
        <div class="flex justify-between items-center text-[10px] font-bold mb-1"><span>${deadlineBucketLabel(bucket)}</span><span>${remain}% tersisa</span></div>
        <div class="h-1.5 bg-slate-100 rounded-full overflow-hidden"><div class="h-full ${bar} rounded-full transition-all duration-300" style="width:${progress}%"></div></div>
      </div>
      <div class="deadline-action">${readyBtn}</div>
    </div>`;
  }).join(''):`<div class="p-10 text-center text-slate-400 text-sm">Tidak ada item yang cocok dengan filter.</div>`;
  document.querySelectorAll('[data-dl-filter]').forEach(b=>b.classList.toggle('active',b.dataset.dlFilter===deadlineFilter));
}

function toggleDeadlineFilter(filter,force=false){if(!force&&deadlineFilter===filter&&filter!=='ALL')deadlineFilter='ALL';else deadlineFilter=filter;renderDeadline()}

async function loadDeadline(){
  const btn=$('deadlineRefreshBtn'),icon=$('deadlineRefreshIcon');
  if(btn)btn.disabled=true;if(icon)icon.className='fa-solid fa-spinner fa-spin mr-1';
  try{
    const j=await api('deadline');const d=j.data||{};deadlineItems=Array.isArray(d.items)?d.items:[];
    const deadlineTotal=d.summary?.total??deadlineItems.length;$('dl-total').textContent=deadlineTotal;$('dl-priority').textContent=d.summary?.priority||0;$('dl-deadline').textContent=d.summary?.deadline||0;$('dl-overdue').textContent=d.summary?.overdue||0;if($('globalDeadlineCount'))$('globalDeadlineCount').textContent=deadlineTotal;
    renderDeadline();toast('Deadline berhasil diperbarui');
  }catch(e){toast('Deadline gagal dimuat: '+e.message,false)}
  finally{if(btn)btn.disabled=false;if(icon)icon.className='fa-solid fa-rotate-right mr-1'}
}
