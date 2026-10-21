// Fortuna Laundry — ui module

function showTab(tab){
  // Tab Finance dikunci PIN: setiap kali dibuka harus memasukkan PIN lagi.
  if(tab==='finance'&&!finUnlocked){openFinancePin();return;}
  if(tab!=='finance'&&finUnlocked)lockFinance();
  const cur=(tab==='deadline'||tab==='expense'||tab==='finance')?tab:'ops';
  const wasFinance=!$('tab-finance').classList.contains('hidden');
  document.querySelectorAll('.tab').forEach(x=>x.classList.add('hidden'));
  $('tab-'+cur).classList.remove('hidden');
  $('title').textContent={ops:'Operasional Dashboard',deadline:'Deadline Dashboard',expense:'Expense',finance:'Finance'}[cur];
  if(cur==='deadline')loadDeadline();
  else if(cur==='expense')loadExpense();
  else if(cur==='finance'){if(wasFinance)loadFinance();else finOpen();}
  else showOpsView(opsView||'new');
  document.querySelectorAll('.navbtn,.bnav-btn').forEach(x=>x.classList.remove('nav-active'));
  document.querySelectorAll('[data-tab="'+cur+'"]').forEach(x=>x.classList.add('nav-active'));
  $('globalDeadlineTray')?.classList.toggle('hidden',cur==='deadline');
  window.scrollTo({top:0});
  if(window.matchMedia('(max-width:899px)').matches)closeMobileDrawer();}

function showOpsView(view){opsView=view;document.querySelectorAll('#ops-new,#ops-list').forEach(x=>x.classList.add('hidden'));$('ops-'+view).classList.remove('hidden');$('opsNavNew').classList.toggle('active',view==='new');$('opsNavList').classList.toggle('active',view==='list');if(view==='list'){renderSummary();renderOrders();}}

function toggleNav(){if(window.matchMedia('(max-width:899px)').matches)toggleMobileDrawer();else toggleSidebar()}

function toggleSidebar(){document.querySelector('.layout')?.classList.toggle('sidebar-collapsed')}

function closeMobileDrawer(){$('mobileDrawer')?.classList.remove('show');$('drawerBackdrop')?.classList.remove('show');}

function toggleMobileDrawer(){if($('mobileDrawer')?.classList.contains('show'))closeMobileDrawer();else{$('mobileDrawer')?.classList.add('show');$('drawerBackdrop')?.classList.add('show');}}

function refreshActiveTab(){const btn=$('globalRefreshBtn'),icon=$('globalRefreshIcon');if(btn)btn.disabled=true;if(icon)icon.className='fa-solid fa-spinner fa-spin mr-1';const active=document.querySelector('.tab:not(.hidden)')?.id;const done=active==='tab-deadline'?loadDeadline():active==='tab-expense'?loadExpense():active==='tab-finance'?loadFinance():loadDashboard();Promise.resolve(done).finally(()=>{if(btn)btn.disabled=false;if(icon)icon.className='fa-solid fa-rotate-right mr-1'});}

function closeModal(id){$(id).classList.remove('show');if(id==='previewModal'||id==='numpadModal'||id==='payModal')document.body.classList.remove('overflow-hidden')}

// App initialization — run only after every module has loaded.
if($('e-tanggal'))$('e-tanggal').value=new Date().toISOString().slice(0,10);
addPackage();
setupNumpad();
restorePrinter();
loadDashboard(true);
loadDeadline();
showTab('ops');
