// Fortuna Laundry — ui module

function showTab(tab){document.querySelectorAll('.tab').forEach(x=>x.classList.add('hidden'));document.querySelectorAll('.navbtn').forEach(x=>x.classList.remove('nav-active'));if(tab==='deadline'){$('tab-deadline').classList.remove('hidden');$('title').textContent='Deadline Dashboard';document.querySelector('[data-tab=deadline]')?.classList.add('nav-active');loadDeadline();}else if(tab==='expense'){$('tab-expense').classList.remove('hidden');$('title').textContent='Expense';document.querySelector('[data-tab=expense]')?.classList.add('nav-active');loadExpense();}else{$('tab-ops').classList.remove('hidden');$('title').textContent='Operasional Dashboard';document.querySelector('[data-tab=ops]')?.classList.add('nav-active');showOpsView(opsView||'new');}if(window.matchMedia('(max-width:899px)').matches)closeMobileDrawer();}

function showOpsView(view){opsView=view;document.querySelectorAll('#ops-new,#ops-list').forEach(x=>x.classList.add('hidden'));$('ops-'+view).classList.remove('hidden');$('opsNavNew').classList.toggle('active',view==='new');$('opsNavList').classList.toggle('active',view==='list');if(view==='list'){renderSummary();renderOrders();}}

function toggleNav(){if(window.matchMedia('(max-width:899px)').matches)toggleMobileDrawer();else toggleSidebar()}

function toggleSidebar(){document.querySelector('.layout')?.classList.toggle('sidebar-collapsed')}

function closeMobileDrawer(){$('mobileDrawer')?.classList.remove('show');$('drawerBackdrop')?.classList.remove('show');}

function toggleMobileDrawer(){if($('mobileDrawer')?.classList.contains('show'))closeMobileDrawer();else{$('mobileDrawer')?.classList.add('show');$('drawerBackdrop')?.classList.add('show');}}

function refreshActiveTab(){const btn=$('globalRefreshBtn'),icon=$('globalRefreshIcon');if(btn)btn.disabled=true;if(icon)icon.className='fa-solid fa-spinner fa-spin mr-1';const active=document.querySelector('.tab:not(.hidden)')?.id;const done=active==='tab-deadline'?loadDeadline():active==='tab-expense'?loadExpense():loadDashboard();Promise.resolve(done).finally(()=>{if(btn)btn.disabled=false;if(icon)icon.className='fa-solid fa-rotate-right mr-1'});}

function closeModal(id){$(id).classList.remove('show');if(id==='previewModal'||id==='numpadModal'||id==='payModal')document.body.classList.remove('overflow-hidden')}

// App initialization — run only after every module has loaded.
if($('e-tanggal'))$('e-tanggal').value=new Date().toISOString().slice(0,10);
addPackage();
setupNumpad();
restorePrinter();
loadDashboard(true);
loadDeadline();
showTab('ops');
