// Web Bluetooth / ESC-POS: reuse authorized device first, ask pairing only if needed.
let printerCharacteristic=null;
let printerConnecting=false;
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

async function logoToEscPos(){
  const img=new Image();
  img.src=FORTUNA_LOGO_PNG;
  await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=reject});

  // Use the printer's common GS v 0 raster mode.
  // Build a full 58mm/384-dot canvas so the logo is centered in pixels,
  // without ESC a commands (some printers print the alignment parameter).
  const printerWidth=384;
  const maxLogoWidth=220;
  const ratio=Math.min(1,maxLogoWidth/img.naturalWidth);
  const logoW=Math.max(8,Math.floor(img.naturalWidth*ratio/8)*8);
  const logoH=Math.max(8,Math.round(img.naturalHeight*(logoW/img.naturalWidth)));

  const canvas=document.createElement('canvas');
  canvas.width=printerWidth;
  canvas.height=logoH;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});
  ctx.fillStyle='#fff';
  ctx.fillRect(0,0,printerWidth,logoH);
  const left=Math.floor((printerWidth-logoW)/2);
  ctx.drawImage(img,left,0,logoW,logoH);

  const data=ctx.getImageData(0,0,printerWidth,logoH).data;
  const rowBytes=printerWidth>>3;
  const bitmap=new Uint8Array(8+rowBytes*logoH);

  // GS v 0 — raster bit image.
  bitmap[0]=0x1d;
  bitmap[1]=0x76;
  bitmap[2]=0x30;
  bitmap[3]=0x00;
  bitmap[4]=rowBytes&0xff;
  bitmap[5]=(rowBytes>>8)&0xff;
  bitmap[6]=logoH&0xff;
  bitmap[7]=(logoH>>8)&0xff;

  for(let y=0;y<logoH;y++){
    for(let x=0;x<printerWidth;x++){
      const i=(y*printerWidth+x)*4;
      const alpha=data[i+3];
      const gray=data[i]*.299+data[i+1]*.587+data[i+2]*.114;
      if(alpha>20 && gray<180){
        bitmap[8+y*rowBytes+(x>>3)]|=0x80>>(x&7);
      }
    }
  }

  const out=new Uint8Array(bitmap.length+1);
  out.set(bitmap,0);
  out[out.length-1]=0x0a;
  return out;
}


function escposCmd(...values){
  return String.fromCharCode(...values);
}

function receiptTextLine(left,right,width=32){
  left=String(left??'');
  right=String(right??'');
  if(left.length+right.length+1<=width){
    const gap=Math.max(1,width-left.length-right.length);
    return left+' '.repeat(gap)+right+'\n';
  }

  // Never let a long value collide with the opposite column.
  if(right.length>=width){
    return wrapReceipt(right,width).map(line=>line+'\n').join('');
  }

  const leftWidth=Math.max(1,width-right.length-1);
  const leftLines=wrapReceipt(left,leftWidth);
  const first=leftLines.shift()||'';
  const gap=Math.max(1,width-first.length-right.length);
  return first+' '.repeat(gap)+right+'\n'+
    leftLines.map(line=>line+'\n').join('');
}

function centerReceipt(text,width=32){
  const s=String(text??'');
  if(!s)return '\n';
  if(s.length<=width){
    const left=Math.max(0,Math.floor((width-s.length)/2));
    return ' '.repeat(left)+s+'\n';
  }
  return wrapReceipt(s,width).map(line=>centerReceipt(line,width)).join('');
}

function wrapReceipt(text,width=32){
  const source=String(text??'').trim();
  if(!source)return [];
  const tokens=source.split(/\s+/);
  const out=[];
  let line='';

  for(const token of tokens){
    let word=token;
    while(word.length>width){
      if(line){out.push(line);line='';}
      out.push(word.slice(0,width));
      word=word.slice(width);
    }
    if(!word)continue;

    const candidate=line?(line+' '+word):word;
    if(candidate.length<=width){
      line=candidate;
    }else{
      if(line)out.push(line);
      line=word;
    }
  }

  if(line)out.push(line);
  return out;
}

function pushWrappedCentered(push,text,width=32){
  wrapReceipt(text,width).forEach(line=>push(centerReceipt(line,width)));
}

function pushBoldCentered(push,text){
  push(escposCmd(0x1b,0x45,0x01));
  push(centerReceipt(text));
  push(escposCmd(0x1b,0x45,0x00));
}

function pushCentered(push,text){
  push(escposCmd(0x1b,0x61,0x01));
  push(text);
  push(escposCmd(0x1b,0x61,0x00));
}

async function printReceipt(o){
  let ready=await ensurePrinter();
  if(!ready){
    ready=await connectPrinter();
    if(!ready) throw new Error('Thermal printer belum terhubung. Hubungkan printer lalu coba cetak lagi.');
  }

  const enc=new TextEncoder();
  const bytes=[];
  const push=s=>bytes.push(...enc.encode(String(s)));
  const pushBytes=(...values)=>bytes.push(...values);

  // Reset printer state, select standard Font A, 58mm paper spacing,
  // and start with normal left alignment.
  pushBytes(0x1b,0x40);       // ESC @
  pushBytes(0x1b,0x4d,0x00);  // ESC M 0 — Font A
  pushBytes(0x1b,0x32);       // ESC 2 — standard line spacing
  pushBytes(0x1b,0x61,0x00);  // ESC a 0 — left
  pushBytes(0x1b,0x45,0x00);  // ESC E 0 — normal

  try{
    bytes.push(...await logoToEscPos());
  }catch(e){
    // If the bitmap fails, continue with the text receipt.
  }

  // Always restore text state after the bitmap.
  pushBytes(0x1b,0x61,0x01);
  pushBytes(0x1b,0x45,0x00);

  const dt=new Date(o.START ? String(o.START).replace(' ','T') : Date.now());
  const date=isNaN(dt.getTime())
    ? new Date().toLocaleString('id-ID')
    : dt.toLocaleString('id-ID',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});

  const items=Array.isArray(o.items)?o.items:[];
  const total=items.reduce((s,x)=>s+parseReceiptAmount(x.TAGIHAN),0);

  // Header — centered and bold only where the preview is bold.
  pushBoldCentered(push,'FORTUNA LAUNDRY');
  pushCentered(push,'Jalan Raya Inpres no 4\n');
  pushCentered(push,'Jakarta Timur\n');
  pushCentered(push,'085693280500\n');
  push('\n');

  // Date/order row. If it cannot fit, the row helper safely moves
  // the left value to the next line instead of overlapping.
  pushBytes(0x1b,0x61,0x00);
  push(receiptTextLine(date,'#'+String(o.ORDER_ID||'PREVIEW')));
  push(String(o.NAMA||'-').toUpperCase()+'\n');
  push('--------------------------------\n');

  items.forEach((x,i)=>{
    push((i+1)+'. ');
    pushWrappedCentered(push,String(x.PAKET||'-'),29);
    push(receiptTextLine(String(x.BERAT||'0')+'Kg',rupiah(parseReceiptAmount(x.TAGIHAN))));
  });

  push('--------------------------------\n');

  pushBytes(0x1b,0x45,0x01);
  push(receiptTextLine('Total',rupiah(total)));
  pushBytes(0x1b,0x45,0x00);

  const paymentStatus=String(o.STATUS_PEMBAYARAN||'BELUM LUNAS').toUpperCase();
  const paymentMethod=String(o.METODE_TRANSAKSI||'BELUM LUNAS').toUpperCase();

  pushBytes(0x1b,0x61,0x02);
  push(paymentStatus+'\n');
  if(paymentMethod!=='BELUM LUNAS')push('Metode: '+paymentMethod+'\n');

  pushWrappedCentered(push,'-- PEMBAYARAN HARAP MENGGUNAKAN QRIS --');

  pushBytes(0x1b,0x45,0x01);
  push(centerReceipt('PERHATIAN'));
  pushBytes(0x1b,0x45,0x00);

  const notes=[
    'Baju putih dicuci terpisah minimal 3 kg.',
    'Kami tidak menerima komplain lebih dari 2x24jam setelah customer menerima Laundry.',
    'Baju yang mudah luntur TAPI tidak memberitahu kami sebelumnya, bukan tanggung jawab kami.',
    'Di sarankan baju luntur untuk cuci satuan.',
    'Jika ingin pakaian Bapak/Ibu dikerjakan lebih optimal disarankan untuk pengerjaan satuan.',
    'Laundry yang lebih dari 10 hari tidak diambil bukan menjadi tanggung jawab kami.',
    'Laundry anda GRATIS apabila tidak mendapatkan nota.'
  ];

  notes.forEach((n,idx)=>{
    pushWrappedCentered(push,'- '+n);
    if(idx<notes.length-1)push('\n');
  });

  push('\n');
  pushCentered(push,'Kritik dan saran\n');
  pushCentered(push,'085693280500\n');
  push('\n');
  pushCentered(push,'#Terimakasih Kasih#\n');
  push('\n\n');

  // Return to normal state before cutting.
  pushBytes(0x1b,0x45,0x00);
  pushBytes(0x1b,0x61,0x00);
  pushBytes(0x1d,0x56,0x00);

  const payload=new Uint8Array(bytes.length);
  payload.set(bytes);

  // 100-byte chunks are deliberately conservative for common BLE thermal
  // printers and avoid assuming a specific negotiated ATT payload size.
  const chunk=100;

  try{
    for(let i=0;i<payload.length;i+=chunk){
      if(!printer?.gatt?.connected||!printerCharacteristic)throw new Error('Koneksi thermal printer terputus.');
      const part=payload.slice(i,i+chunk);
      if(printerCharacteristic.writeWithoutResponse!==false && printerCharacteristic.writeValueWithoutResponse){
        await printerCharacteristic.writeValueWithoutResponse(part);
      }else{
        await printerCharacteristic.writeValue(part);
      }
      await new Promise(r=>setTimeout(r,20));
    }
    return true;
  }catch(err){
    printer=null;
    printerCharacteristic=null;
    onPrinterDisconnected();
    throw new Error('Cetak gagal karena koneksi printer terputus. Hubungkan kembali thermal printer lalu cetak ulang.');
  }
}
