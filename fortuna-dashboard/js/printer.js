// Web Bluetooth / ESC-POS: reuse authorized device first, ask pairing only if needed.
const PRINTER_OPTIONAL_SERVICES=[
  '000018f0-0000-1000-8000-00805f9b34fb',
  '0000ff00-0000-1000-8000-00805f9b34fb',
  '0000ffe0-0000-1000-8000-00805f9b34fb',
  '0000ffe5-0000-1000-8000-00805f9b34fb',
  '0000e025-0000-1000-8000-00805f9b34fb',
  '00001101-0000-1000-8000-00805f9b34fb',
  '49535343-fe7d-4ae5-8fa9-9fafd205e455'
];

function setPrinterUI(connected,text){
  const btn=$('printerBtn'),icon=$('printerIcon'),label=$('printerText');
  if(!btn)return;
  label.textContent=text||(connected?'Terhubung':'Hubungkan ke printer');
  icon.className=connected?'fa-solid fa-print mr-1 text-emerald-600':'fa-solid fa-print mr-1 text-red-600';
  btn.classList.toggle('bg-emerald-50',connected);
  btn.classList.toggle('text-[#0F5A47]',connected);
}

async function findWritableCharacteristic(device){
  if(!device?.gatt)return null;
  const server=device.gatt.connected?device.gatt.server:await device.gatt.connect();
  const services=await server.getPrimaryServices();
  for(const service of services){
    const chars=await service.getCharacteristics();
    for(const c of chars)if(c.properties.writeWithoutResponse||c.properties.write)return c;
  }
  return null;
}

function onPrinterDisconnected(){
  printerCharacteristic=null;
  setPrinterUI(false,'Hubungkan ke printer');
  toast('Thermal printer terputus. Hubungkan kembali sebelum mencetak.',false);
}

function bindPrinterDisconnect(device){
  if(!device)return;
  device.removeEventListener('gattserverdisconnected',onPrinterDisconnected);
  device.addEventListener('gattserverdisconnected',onPrinterDisconnected);
}

async function restorePrinter(){
  if(!navigator.bluetooth?.getDevices)return false;
  try{
    const devices=await navigator.bluetooth.getDevices();
    if(!devices.length)return false;
    const ordered=[...devices.filter(d=>d.name&&(/RPP02N|RPP|Printer|Thermal|POS|MTP/i.test(d.name))),...devices.filter(d=>!d.name||!(/RPP02N|RPP|Printer|Thermal|POS|MTP/i.test(d.name)))];
    for(const device of ordered){
      try{
        printer=device;bindPrinterDisconnect(printer);
        printerCharacteristic=await findWritableCharacteristic(printer);
        if(printerCharacteristic){setPrinterUI(true,'Terhubung');return true;}
      }catch(_){printerCharacteristic=null;}
    }
  }catch(err){console.debug('Printer belum dapat dipulihkan:',err)}
  printerCharacteristic=null;return false;
}

async function choosePrinter(){
  return await navigator.bluetooth.requestDevice({acceptAllDevices:true,optionalServices:PRINTER_OPTIONAL_SERVICES});
}

async function connectPrinter(){
  if(printerConnecting)return !!printerCharacteristic;
  if(!navigator.bluetooth){toast('Browser tidak mendukung Web Bluetooth. Gunakan Chrome/Edge desktop.',false);return false}
  const btn=$('printerBtn'),icon=$('printerIcon'),txt=$('printerText');
  printerConnecting=true;if(btn)btn.disabled=true;if(icon)icon.className='fa-solid fa-spinner fa-spin mr-1';if(txt)txt.textContent='Mencari printer...';
  try{
    // A. Coba device yang sedang tersimpan/terhubung.
    if(printer?.gatt){try{bindPrinterDisconnect(printer);printerCharacteristic=await findWritableCharacteristic(printer);if(printerCharacteristic){setPrinterUI(true,'Terhubung');toast('Printer terhubung');return true}}catch(_){printerCharacteristic=null}}
    // B. Coba semua device yang sudah diberi permission browser.
    if(navigator.bluetooth.getDevices){
      try{
        const devices=await navigator.bluetooth.getDevices();
        const ordered=[...devices.filter(d=>d.name&&(/RPP02N|RPP|Printer|Thermal|POS|MTP/i.test(d.name))),...devices.filter(d=>!d.name||!(/RPP02N|RPP|Printer|Thermal|POS|MTP/i.test(d.name)))];
        for(const device of ordered){
          try{printer=device;bindPrinterDisconnect(printer);printerCharacteristic=await findWritableCharacteristic(printer);if(printerCharacteristic){setPrinterUI(true,'Terhubung');toast('Printer terhubung');return true}}catch(_){printerCharacteristic=null}
        }
      }catch(_){/* lanjut chooser */}
    }
    // C. Tidak ada device yang bisa dipakai → browser menampilkan daftar Bluetooth yang tersedia.
    printer=await choosePrinter();bindPrinterDisconnect(printer);
    printerCharacteristic=await findWritableCharacteristic(printer);
    if(!printerCharacteristic)throw new Error('Printer ditemukan, tetapi characteristic Bluetooth untuk mengirim data tidak ditemukan');
    setPrinterUI(true,'Terhubung');toast('Printer '+(printer.name||'Bluetooth')+' terhubung');return true;
  }catch(e){
    printerCharacteristic=null;setPrinterUI(false,'Hubungkan ke printer');
    toast(e?.name==='NotFoundError'?'Pemilihan printer dibatalkan.':(e?.message||'Gagal menghubungkan printer.'),false);return false;
  }finally{printerConnecting=false;if(btn)btn.disabled=false}
}

async function ensurePrinter(){
  if(printerCharacteristic&&printer?.gatt?.connected)return true;
  if(printer){try{bindPrinterDisconnect(printer);printerCharacteristic=await findWritableCharacteristic(printer);if(printerCharacteristic){setPrinterUI(true,'Terhubung');return true}}catch(_){printerCharacteristic=null}}
  return false;
}

async function logoToEscPos(){const img=new Image();img.src=FORTUNA_LOGO_PNG;await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=reject});const maxWidth=320;const ratio=Math.min(1,maxWidth/img.naturalWidth);const w=Math.max(8,Math.round(img.naturalWidth*ratio));const h=Math.max(8,Math.round(img.naturalHeight*ratio));const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.fillStyle='#fff';ctx.fillRect(0,0,w,h);ctx.drawImage(img,0,0,w,h);const data=ctx.getImageData(0,0,w,h).data;const rowBytes=Math.ceil(w/8);const bitmap=new Uint8Array(8+rowBytes*h);bitmap[0]=0x1d;bitmap[1]=0x76;bitmap[2]=0x30;bitmap[3]=0x00;bitmap[4]=rowBytes&0xff;bitmap[5]=(rowBytes>>8)&0xff;bitmap[6]=h&0xff;bitmap[7]=(h>>8)&0xff;for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=(y*w+x)*4;const gray=data[i]*.299+data[i+1]*.587+data[i+2]*.114;if(gray<180)bitmap[8+y*rowBytes+(x>>3)]|=0x80>>(x&7)}const out=new Uint8Array(5+bitmap.length+3);out.set([0x1b,0x40,0x1b,0x61,0x01],0);out.set(bitmap,5);out.set([0x1b,0x61,0x00,0x1b,0x45,0x00],5+bitmap.length);return out}

function receiptTextLine(left,right,width=32){left=String(left??'');right=String(right??'');const gap=Math.max(1,width-left.length-right.length);return left+' '.repeat(gap)+right+'\n'}

function wrapReceipt(text,width=32){const words=String(text??'').split(/\s+/);const out=[];let line='';for(const word of words){if((line?line.length+1:0)+word.length<=width)line+=(line?' ':'')+word;else{if(line)out.push(line);line=word.slice(0,width)}}if(line)out.push(line);return out}

async function printReceipt(o){
  // SETIAP aksi cetak wajib memastikan printer benar-benar tersambung.
  // Jika koneksi hilang/tidak ada, minta operator menghubungkan thermal printer lagi.
  let ready=await ensurePrinter();
  if(!ready){
    ready=await connectPrinter();
    if(!ready) throw new Error('Thermal printer belum terhubung. Hubungkan printer lalu coba cetak lagi.');
  }
  const enc=new TextEncoder();
  const bytes=[];
  const push=s=>bytes.push(...enc.encode(s));
  const nl='\n';
  try{ bytes.push(...await logoToEscPos()); }
  catch(e){ push('\x1B\x40\x1B\x61\x01'); }

  const dt=new Date(o.START ? String(o.START).replace(' ','T') : Date.now());
  const date=isNaN(dt.getTime()) ? new Date().toLocaleString('id-ID') : dt.toLocaleString('id-ID',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});
  const items=Array.isArray(o.items)?o.items:[];
  const total=items.reduce((s,x)=>s+(Number(x.TAGIHAN)||0),0);

  push('FORTUNA LAUNDRY'+nl);
  push('Jalan Raya Inpres no 4'+nl);
  push('Jakarta Timur'+nl);
  push('085693280500'+nl+nl);
  push(receiptTextLine(date,'#'+o.ORDER_ID));
  push('\x1B\x45\x01'+String(o.NAMA||'-').toUpperCase()+'\x1B\x45\x00'+nl);
  push('--------------------------------'+nl);

  items.forEach((x,i)=>{
    const lines=wrapReceipt((i+1)+'. '+String(x.PAKET||'-').toUpperCase(),32);
    push('\x1B\x45\x01'+lines[0]+'\x1B\x45\x00'+nl);
    for(let j=1;j<lines.length;j++)push('  '+lines[j]+nl);
    push(receiptTextLine(String(x.BERAT||0)+'Kg',rupiah(x.TAGIHAN)));
  });

  push('--------------------------------'+nl);
  push(receiptTextLine('TOTAL',rupiah(total)));
  const paymentStatus=String(o.STATUS_PEMBAYARAN||'BELUM LUNAS').toUpperCase();
  const paymentMethod=String(o.METODE_TRANSAKSI||'BELUM LUNAS').toUpperCase();
  push('\x1B\x61\x01\x1B\x45\x01'+(paymentStatus==='LUNAS'?'LUNAS':'BELUM DIBAYAR')+'\x1B\x45\x00'+nl);
  push('Metode: '+paymentMethod+nl);
  push('\x1B\x61\x00');
  push('\n-- PEMBAYARAN HARAP MENGGUNAKAN QRIS --\n\n');
  push('\x1B\x45\x01PERHATIAN\x1B\x45\x00\n');
  const notes=[
    'Baju putih dicuci terpisah minimal 3 kg.',
    'Kami tidak menerima komplain lebih dari 2x24jam setelah customer menerima Laundry.',
    'Baju yang mudah luntur TAPI tidak memberitahu kami sebelumnya, bukan tanggung jawab kami.',
    'Di sarankan baju luntur untuk cuci satuan.',
    'Jika ingin pakaian Bapak/Ibu dikerjakan lebih optimal disarankan untuk pengerjaan satuan.',
    'Laundry yang lebih dari 10 hari tidak diambil bukan menjadi tanggung jawab kami.',
    'Laundry anda GRATIS apabila tidak mendapatkan nota.'
  ];
  notes.forEach((n,idx)=>{wrapReceipt(n,30).forEach((line,j)=>push((j===0?'- ':'  ')+line+'\n'));if(idx===2)push('\n')});
  push('\nKritik dan saran\n0856930280500\n\n#Terimakasih Kasih#\n\n\n\n');
  push('\x1D\x56\x00');

  const payload=new Uint8Array(bytes.length);payload.set(bytes);
  const chunk=180;
  try{
    for(let i=0;i<payload.length;i+=chunk){
      if(!printer?.gatt?.connected||!printerCharacteristic) throw new Error('Koneksi thermal printer terputus.');
      const part=payload.slice(i,i+chunk);
      if(printerCharacteristic.writeValueWithoutResponse) await printerCharacteristic.writeValueWithoutResponse(part);
      else await printerCharacteristic.writeValue(part);
      await new Promise(r=>setTimeout(r,20));
    }
    return true;
  }catch(err){
    printer=null;printerCharacteristic=null;onPrinterDisconnected();
    throw new Error('Cetak gagal karena koneksi printer terputus. Hubungkan kembali thermal printer lalu cetak ulang.');
  }
}
