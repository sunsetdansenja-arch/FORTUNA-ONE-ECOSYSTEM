// Fortuna Laundry — whatsapp module

function openWA(o){waTarget=o;$('waOrderInfo').textContent='Order #'+o.ORDER_ID+' • '+(o.NAMA||'-');const link=buildStatusLink(o);$('waStatusLink').textContent=link||'Link status belum dikonfigurasi';$('waModal').classList.add('show');document.body.classList.add('overflow-hidden')}

function waOrder(id){const o=orders.find(x=>x.ORDER_ID===id);if(!o)return;waTarget=o;$('waOrderInfo').textContent='Order #'+o.ORDER_ID+' • '+(o.NAMA||'-');const link=buildStatusLink(o);$('waStatusLink').textContent=link||'Link status belum dikonfigurasi';$('waModal').classList.add('show');document.body.classList.add('overflow-hidden')}

function buildStatusLink(o){if(!STATUS_CHECK_BASE_URL)return '';const sep=STATUS_CHECK_BASE_URL.includes('?')?'&':'?';return STATUS_CHECK_BASE_URL+sep+'order='+encodeURIComponent(o.ORDER_ID)}

function normalizeWaNumber(v){let n=String(v||'').replace(/\D/g,'');if(n.startsWith('0'))n='62'+n.slice(1);return n}

function sendWAOption(type){const o=waTarget;if(!o)return;const n=normalizeWaNumber(o.NO_WA);if(!n){toast('Nomor WhatsApp kosong',false);return}const link=buildStatusLink(o);if((type==='ready'||type==='status')&&!link){toast('Link status belum dikonfigurasi di frontend',false);return}let msg='';if(type==='ready'){msg=`Halo ${o.NAMA},\n\nLaundry dengan nomor order #${o.ORDER_ID} sudah selesai dan siap diambil.\n\nCek status cucian: ${link}\n\nTerima kasih — Fortuna Laundry.`}else if(type==='status'){msg=`Halo ${o.NAMA},\n\nCek status cucian untuk order #${o.ORDER_ID}:\n${link}\n\nTerima kasih — Fortuna Laundry.`}closeModal('waModal');if(type==='chat')window.open('https://wa.me/'+n,'_blank');else window.open('https://wa.me/'+n+'?text='+encodeURIComponent(msg),'_blank')}
