// Fortuna Laundry — whatsapp module

function openWA(o){waTarget=o;$('waOrderInfo').textContent='Order #'+o.ORDER_ID+' • '+(o.NAMA||'-');const link=buildStatusLink(o);$('waStatusLink').textContent=link||'Link status belum dikonfigurasi';$('waModal').classList.add('show');document.body.classList.add('overflow-hidden')}

function waOrder(id){const o=orders.find(x=>x.ORDER_ID===id);if(!o)return;waTarget=o;$('waOrderInfo').textContent='Order #'+o.ORDER_ID+' • '+(o.NAMA||'-');const link=buildStatusLink(o);$('waStatusLink').textContent=link||'Link status belum dikonfigurasi';$('waModal').classList.add('show');document.body.classList.add('overflow-hidden')}

function buildStatusLink(o){const base=String(STATUS_CHECK_BASE_URL||'').trim();if(!base)return '';const code=String(o&&o.ORDER_ID||'').trim();if(!code)return base;return base+(base.includes('?')?'&':'?')+'code='+encodeURIComponent(code)}

function normalizeWaNumber(v){let n=String(v||'').replace(/\D/g,'');if(n.startsWith('0'))n='62'+n.slice(1);return n}

function buildOrderWhatsAppMessage(o){
  const model=buildReceiptModel(o||{});
  const items=Array.isArray(o&&o.items)?o.items:[];
  const itemText=items.map((item,i)=>'- '+(item.PAKET||'-')+' — '+(item.BERAT||0)+' '+((model.items[i]||{}).unit||'kg')).join('\n');
  const link=buildStatusLink(o);
  return ['Halo '+(o&&o.NAMA||'Customer')+',','','Terima kasih sudah menggunakan Fortuna Laundry.','','Pesanan #'+(o&&o.ORDER_ID||'')+' sudah kami terima.',itemText,'','Total: '+rupiah(model.total),'','Cek status cucian:',link||'Link status akan tersedia di customer dashboard.','','Terima kasih.','Fortuna Laundry'].join('\n');
}

function sendWAOption(type){const o=waTarget;if(!o)return;const n=normalizeWaNumber(o.NO_WA);if(!n){toast('Nomor WhatsApp kosong',false);return}const link=buildStatusLink(o);if((type==='ready'||type==='status')&&!link){toast('Link status belum dikonfigurasi di frontend',false);return}let msg='';if(type==='ready'){msg='Halo '+(o.NAMA||'Pelanggan Fortuna')+',\n\nKabar baik! Cucian untuk order #'+o.ORDER_ID+' sudah selesai dan siap diambil.\n\nUntuk melihat detail dan status pesanan, silakan buka:\n'+link+'\n\nTerima kasih telah mempercayakan cucian Anda kepada Fortuna Laundry.'}else if(type==='status'){msg=buildOrderWhatsAppMessage(o)}closeModal('waModal');if(type==='chat')window.open('https://wa.me/'+n,'_blank');else window.open('https://wa.me/'+n+'?text='+encodeURIComponent(msg),'_blank')}
