// Web Bluetooth / ESC-POS: reuse authorized device first, ask pairing only if needed.
let printerCharacteristic=null;
let printerConnecting=false;

// Fortuna receipt target:
// - Thermal roll: 58 mm
// - Fixed printable width: 384 dots
// - Font A: 12 x 24 dots => 32 characters/line
// The Bluetooth connection flow below is intentionally kept unchanged.
const PRINTER_WIDTH=384;
const RECEIPT_COLUMNS=30;
const LOGO_MAX_WIDTH=200;

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
    if(printer?.gatt){try{bindPrinterDisconnect(printer);printerCharacteristic=await findWritableCharacteristic(printer);if(printerCharacteristic){setPrinterUI(true,'Terhubung');toast('Printer terhubung');return true}}catch(_){printerCharacteristic=null}}
    if(navigator.bluetooth.getDevices){
      try{
        const devices=await navigator.bluetooth.getDevices();
        const ordered=[...devices.filter(d=>d.name&&(/RPP02N|RPP|Printer|Thermal|POS|MTP/i.test(d.name))),...devices.filter(d=>!d.name||!(/RPP02N|RPP|Printer|Thermal|POS|MTP/i.test(d.name)))];
        for(const device of ordered){
          try{printer=device;bindPrinterDisconnect(printer);printerCharacteristic=await findWritableCharacteristic(printer);if(printerCharacteristic){setPrinterUI(true,'Terhubung');toast('Printer terhubung');return true}}catch(_){printerCharacteristic=null}
        }
      }catch(_){}
    }
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


function escposCmd(...values){return String.fromCharCode(...values)}

function parseReceiptAmount(value){
  if(typeof value==='number'&&Number.isFinite(value))return value;
  const raw=String(value??'').trim();
  if(!raw)return 0;
  return Number(raw.replace(/[^0-9-]/g,''))||0;
}

function printerRupiah(value){
  return 'Rp '+Math.round(parseReceiptAmount(value)).toLocaleString('id-ID');
}

function printerDate(value){
  if(!value)return new Date();
  const raw=String(value).trim();
  const iso=raw.includes('T')?raw:raw.replace(' ','T');
  return /(?:Z|[+-]\d{2}:?\d{2})$/.test(iso)?new Date(iso):new Date(iso+'Z');
}

function wrapCanvasText(ctx,text,maxWidth){
  const words=String(text??'').trim().split(/\s+/).filter(Boolean);
  const lines=[];let line='';
  for(const word of words){
    const candidate=line?line+' '+word:word;
    if(!line||ctx.measureText(candidate).width<=maxWidth)line=candidate;
    else{lines.push(line);line=word}
  }
  if(line)lines.push(line);
  return lines;
}

function drawText(ctx,text,x,y,maxWidth,font,lineHeight,align){
  ctx.font=font;ctx.textAlign=align||'left';ctx.textBaseline='top';
  const lines=Array.isArray(text)?text:wrapCanvasText(ctx,text,maxWidth);
  lines.forEach(line=>ctx.fillText(line,x,y));
  return y+lines.length*lineHeight;
}

function canvasToEscPos(canvas){
  const ctx=canvas.getContext('2d',{willReadFrequently:true});
  const width=canvas.width,height=canvas.height,rowBytes=Math.ceil(width/8);
  const header=new Uint8Array([0x1d,0x76,0x30,0x00,rowBytes&255,(rowBytes>>8)&255,height&255,(height>>8)&255]);
  const pixels=ctx.getImageData(0,0,width,height).data;
  const bitmap=new Uint8Array(header.length+rowBytes*height+1);
  bitmap.set(header);
  for(let y=0;y<height;y++){
    for(let x=0;x<width;x++){
      const i=(y*width+x)*4;
      const gray=pixels[i]*.299+pixels[i+1]*.587+pixels[i+2]*.114;
      if(gray<180)bitmap[header.length+y*rowBytes+(x>>3)]|=0x80>>(x&7);
    }
  }
  bitmap[bitmap.length-1]=0x0a;
  return bitmap;
}

async function receiptToRaster(o){
  const W=384,M=24,CW=W-M*2;
  const notes=[
    'Baju putih dicuci terpisah minimal 3 kg.',
    'Kami tidak menerima komplain lebih dari 2x24jam setelah customer menerima Laundry.',
    'Baju yang mudah luntur TAPI tidak memberitahu kami sebelumnya, bukan tanggung jawab kami.',
    'Di sarankan baju luntur untuk cuci satuan.',
    'Jika ingin pakaian Bapak/Ibu dikerjakan lebih optimal disarankan untuk pengerjaan satuan.',
    'Laundry yang lebih dari 10 hari tidak diambil bukan menjadi tanggung jawab kami.',
    'Laundry anda GRATIS apabila tidak mendapatkan nota.'
  ];
  const items=Array.isArray(o.items)?o.items:[];
  const c=document.createElement('canvas');
  c.width=W;c.height=1800;
  const ctx=c.getContext('2d',{willReadFrequently:true});
  ctx.fillStyle='#fff';ctx.fillRect(0,0,W,c.height);ctx.fillStyle='#000';

  const logo=new Image();logo.src=FORTUNA_LOGO_PNG;
  try{await new Promise((res,rej)=>{logo.onload=res;logo.onerror=rej})}catch(_){}

  let y=18;
  if(logo.naturalWidth){
    const lw=Math.min(190,logo.naturalWidth),lh=Math.round(logo.naturalHeight*(lw/logo.naturalWidth));
    ctx.drawImage(logo,(W-lw)/2,y,lw,lh);y+=lh+14;
  }

  y=drawText(ctx,'FORTUNA LAUNDRY',W/2,y,CW,'bold 20px Arial',25,'center');
  y=drawText(ctx,'Jalan Raya Inpres no 4',W/2,y,CW,'16px Arial',21,'center');
  y=drawText(ctx,'Jakarta Timur',W/2,y,CW,'16px Arial',21,'center');
  y=drawText(ctx,'085693280500',W/2,y,CW,'16px Arial',21,'center');
  y+=12;

  const dt=printerDate(o.START||null);
  const date=isNaN(dt.getTime())?new Date().toLocaleString('id-ID',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}):dt.toLocaleString('id-ID',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});
  const orderNo='#'+String(o.ORDER_ID||'PREVIEW');
  ctx.font='16px Arial';
  if(ctx.measureText(date).width+ctx.measureText(orderNo).width+36<=CW){
    ctx.textAlign='left';ctx.textBaseline='top';ctx.fillText(date,M,y);
    ctx.textAlign='right';ctx.fillText(orderNo,W-M,y);y+=22;
  }else{
    y=drawText(ctx,date,M,y,CW,'16px Arial',21,'left');
    y=drawText(ctx,orderNo,M,y,CW,'bold 16px Arial',21,'left');
  }

  y=drawText(ctx,String(o.NAMA||'-').toUpperCase(),M,y,CW,'bold 18px Arial',24,'left');y+=5;
  ctx.fillRect(M,y,CW,1);y+=12;

  items.forEach((x,i)=>{
    y=drawText(ctx,(i+1)+'. '+String(x.PAKET||'-'),M,y,CW,'bold 18px Arial',23,'left');
    const weight=String(x.BERAT||'0')+' Kg';
    y=drawText(ctx,weight,M,y,CW,'16px Arial',21,'left');
    y=drawText(ctx,printerRupiah(x.TAGIHAN),W-M,y-21,CW,'16px Arial',21,'right');
    y+=8;
  });

  ctx.fillRect(M,y,CW,1);y+=12;
  const total=items.reduce((s,x)=>s+parseReceiptAmount(x.TAGIHAN),0);
  y=drawText(ctx,'TOTAL',M,y,CW,'bold 18px Arial',24,'left');
  y=drawText(ctx,printerRupiah(total),W-M,y-24,CW,'bold 18px Arial',24,'right');y+=8;

  const status=String(o.STATUS_PEMBAYARAN||'BELUM LUNAS').toUpperCase();
  const method=String(o.METODE_TRANSAKSI||'BELUM LUNAS').toUpperCase();
  y=drawText(ctx,status,W-M,y,CW,'bold 16px Arial',21,'right');
  if(method!=='BELUM LUNAS')y=drawText(ctx,'Metode: '+method,W-M,y,CW,'16px Arial',21,'right');

  y+=12;
  y=drawText(ctx,'-- PEMBAYARAN HARAP MENGGUNAKAN QRIS --',W/2,y,CW,'15px Arial',21,'center');y+=9;
  y=drawText(ctx,'PERHATIAN',W/2,y,CW,'bold 18px Arial',23,'center');y+=6;

  notes.forEach(n=>{y=drawText(ctx,'- '+n,W/2,y,CW,'18px Arial',23,'center');y+=10});

  y+=5;
  y=drawText(ctx,'Kritik dan saran',W/2,y,CW,'16px Arial',21,'center');
  y=drawText(ctx,'085693280500',W/2,y,CW,'16px Arial',21,'center');y+=15;
  y=drawText(ctx,'#Terimakasih Kasih#',W/2,y,CW,'bold 16px Arial',21,'center');y+=30;

  const h=Math.min(c.height,Math.ceil(y));
  if(h!==c.height){
    const crop=document.createElement('canvas');crop.width=W;crop.height=h;
    crop.getContext('2d').drawImage(c,0,0);
    return canvasToEscPos(crop);
  }
  return canvasToEscPos(c);
}

async function printReceipt(o){
  let ready=await ensurePrinter();
  if(!ready){ready=await connectPrinter();if(!ready)throw new Error('Thermal printer belum terhubung. Hubungkan printer lalu coba cetak lagi.')}

  const bytes=[];
  const pushBytes=(...values)=>bytes.push(...values);
  pushBytes(0x1b,0x40);
  pushBytes(0x1b,0x61,0x00);
  pushBytes(0x1b,0x32);

  const raster=await receiptToRaster(o);
  bytes.push(...raster);
  pushBytes(0x0a,0x0a,0x0a,0x1d,0x56,0x00);

  const payload=new Uint8Array(bytes);
  const chunk=100;
  try{
    for(let i=0;i<payload.length;i+=chunk){
      if(!printer?.gatt?.connected||!printerCharacteristic)throw new Error('Koneksi thermal printer terputus.');
      const part=payload.slice(i,i+chunk);
      if(printerCharacteristic.writeWithoutResponse!==false&&printerCharacteristic.writeValueWithoutResponse)await printerCharacteristic.writeValueWithoutResponse(part);
      else await printerCharacteristic.writeValue(part);
      await new Promise(r=>setTimeout(r,20));
    }
    return true;
  }catch(err){
    printer=null;printerCharacteristic=null;onPrinterDisconnected();
    throw new Error('Cetak gagal karena koneksi printer terputus. Hubungkan kembali thermal printer lalu cetak ulang.');
  }
}
