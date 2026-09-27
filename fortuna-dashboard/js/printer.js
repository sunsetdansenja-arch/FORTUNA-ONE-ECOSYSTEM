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

/*
 * Fortuna printer renderer:
 * Native ESC/POS text like WARUNG-ACIL.
 * Only the logo is rasterized; all receipt text stays native text.
 */
const RECEIPT_COLUMNS=32;

function escposText(value){
  return String(value??'')
    .replace(/\r/g,'')
    .replace(/[^\x09\x0A\x20-\x7E]/g,'?');
}

function receiptWrap(text,max=RECEIPT_COLUMNS){
  const clean=escposText(text).trim();
  if(!clean)return [''];
  const words=clean.split(/\s+/);
  const lines=[];let line='';
  for(const word of words){
    if(word.length>max){
      if(line){lines.push(line);line=''}
      for(let i=0;i<word.length;i+=max)lines.push(word.slice(i,i+max));
      continue;
    }
    const candidate=line?line+' '+word:word;
    if(candidate.length<=max)line=candidate;
    else{lines.push(line);line=word}
  }
  if(line)lines.push(line);
  return lines;
}

function receiptCentered(text,bold=false){
  return escposCmd(0x1b,0x61,0x01)
    +(bold?escposCmd(0x1b,0x45,0x01):'')
    +receiptWrap(text).map(x=>x+'\n').join('')
    +(bold?escposCmd(0x1b,0x45,0x00):'');
}

function receiptLeft(text,bold=false){
  return escposCmd(0x1b,0x61,0x00)
    +(bold?escposCmd(0x1b,0x45,0x01):'')
    +receiptWrap(text).map(x=>x+'\n').join('')
    +(bold?escposCmd(0x1b,0x45,0x00):'');
}

function receiptLeftRight(left,right){
  const l=escposText(left);
  const r=escposText(right);
  const spaces=Math.max(1,RECEIPT_COLUMNS-l.length-r.length);
  return l+' '.repeat(spaces)+r+'\n';
}

function receiptSeparator(char='-'){
  return receiptCentered(char.repeat(RECEIPT_COLUMNS));
}

function logoToEscPos(){
  return new Promise(resolve=>{
    try{
      if(typeof FORTUNA_LOGO_PNG==='undefined'||!FORTUNA_LOGO_PNG)return resolve(new Uint8Array());
      const img=new Image();
      img.onload=()=>{
        try{
          const maxW=160;
          const w=Math.min(maxW,img.naturalWidth||maxW);
          const h=Math.max(1,Math.round((img.naturalHeight||1)*(w/(img.naturalWidth||w))));
          const canvas=document.createElement('canvas');
          canvas.width=w;canvas.height=h;
          const ctx=canvas.getContext('2d',{willReadFrequently:true});
          ctx.fillStyle='#fff';ctx.fillRect(0,0,w,h);
          ctx.drawImage(img,0,0,w,h);
          const pixels=ctx.getImageData(0,0,w,h).data;
          const rowBytes=Math.ceil(w/8);
          const header=new Uint8Array([0x1b,0x61,0x01,0x1d,0x76,0x30,0x00,rowBytes&255,(rowBytes>>8)&255,h&255,(h>>8)&255]);
          const out=new Uint8Array(header.length+rowBytes*h);
          out.set(header);
          for(let y=0;y<h;y++){
            for(let x=0;x<w;x++){
              const i=(y*w+x)*4;
              const alpha=pixels[i+3];
              const gray=pixels[i]*0.299+pixels[i+1]*0.587+pixels[i+2]*0.114;
              if(alpha>20&&gray<180)out[header.length+y*rowBytes+(x>>3)]|=0x80>>(x&7);
            }
          }
          resolve(out);
        }catch(_){resolve(new Uint8Array())}
      };
      img.onerror=()=>resolve(new Uint8Array());
      img.src=FORTUNA_LOGO_PNG;
    }catch(_){resolve(new Uint8Array())}
  });
}

async function buildFortunaEscPos(o){
  const bytes=[];
  const encoder=new TextEncoder();
  const pushText=s=>bytes.push(...encoder.encode(s));
  const pushCmd=(...v)=>bytes.push(...v);

  pushCmd(0x1b,0x40);
  pushCmd(0x1b,0x32);

  const logo=await logoToEscPos();
  if(logo.length){
    bytes.push(...logo);
    pushCmd(0x0a);
  }

  pushText(receiptCentered('FORTUNA LAUNDRY',true));
  pushText(receiptCentered('Jalan Raya Inpres no 4'));
  pushText(receiptCentered('Jakarta Timur'));
  pushText(receiptCentered('085693280500'));
  pushCmd(0x0a);

  const dt=printerDate(o.START||null);
  const date=isNaN(dt.getTime())
    ?new Date().toLocaleString('id-ID',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})
    :dt.toLocaleString('id-ID',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});
  const orderNo='#'+String(o.ORDER_ID||'PREVIEW');

  pushCmd(0x1b,0x61,0x00);
  pushText(receiptLeftRight(date,orderNo));

  pushText(receiptLeft(String(o.NAMA||'-').toUpperCase(),true));
  pushText(receiptSeparator());

  const items=Array.isArray(o.items)?o.items:[];
  items.forEach((x,i)=>{
    pushText(receiptLeft((i+1)+'. '+String(x.PAKET||'-'),true));
    pushText(receiptLeftRight(String(x.BERAT||'0')+' Kg',printerRupiah(x.TAGIHAN)));
  });

  pushText(receiptSeparator());
  const total=items.reduce((s,x)=>s+parseReceiptAmount(x.TAGIHAN),0);
  pushCmd(0x1b,0x45,0x01);
  pushText(receiptLeftRight('TOTAL',printerRupiah(total)));
  pushCmd(0x1b,0x45,0x00);

  pushCmd(0x0a);
  const status=String(o.STATUS_PEMBAYARAN||'BELUM LUNAS').toUpperCase();
  const method=String(o.METODE_TRANSAKSI||'BELUM LUNAS').toUpperCase();
  pushText(receiptCentered(status,true));
  if(method!=='BELUM LUNAS')pushText(receiptCentered('Metode: '+method));
  pushCmd(0x0a);

  pushText(receiptCentered('-- PEMBAYARAN HARAP MENGGUNAKAN QRIS --'));
  pushCmd(0x0a);
  pushText(receiptCentered('PERHATIAN',true));
  pushCmd(0x0a);

  const notes=[
    'Baju putih dicuci terpisah minimal 3 kg.',
    'Kami tidak menerima komplain lebih dari 2x24jam setelah customer menerima Laundry.',
    'Baju yang mudah luntur TAPI tidak memberitahu kami sebelumnya, bukan tanggung jawab kami.',
    'Di sarankan baju luntur untuk cuci satuan.',
    'Jika ingin pakaian Bapak/Ibu dikerjakan lebih optimal disarankan untuk pengerjaan satuan.',
    'Laundry yang lebih dari 10 hari tidak diambil bukan menjadi tanggung jawab kami.',
    'Laundry anda GRATIS apabila tidak mendapatkan nota.'
  ];

  for(const note of notes){
    pushCmd(0x1b,0x61,0x01);
    for(const line of receiptWrap('- '+note))pushText(line+'\n');
    pushCmd(0x0a);
  }

  pushText(receiptCentered('Kritik dan saran'));
  pushText(receiptCentered('085693280500'));
  pushCmd(0x0a);
  pushText(receiptCentered('#Terimakasih Kasih#',true));
  pushCmd(0x0a,0x0a,0x0a);
  pushCmd(0x1d,0x56,0x00);

  return new Uint8Array(bytes);
}

async function writePrinterPayload(payload){
  if(!printerCharacteristic)throw new Error('Characteristic printer tidak tersedia.');

  try{
    await printerCharacteristic.writeValue(payload);
    return;
  }catch(firstError){
    const chunk=128;
    for(let i=0;i<payload.length;i+=chunk){
      await printerCharacteristic.writeValue(payload.slice(i,i+chunk));
    }
  }
}

async function printReceipt(o){
  let ready=await ensurePrinter();
  if(!ready){
    ready=await connectPrinter();
    if(!ready)throw new Error('Thermal printer belum terhubung. Hubungkan printer lalu coba cetak lagi.');
  }

  try{
    const payload=await buildFortunaEscPos(o);
    if(!printer?.gatt?.connected||!printerCharacteristic)throw new Error('Koneksi thermal printer terputus.');
    await writePrinterPayload(payload);
    return true;
  }catch(err){
    printer=null;printerCharacteristic=null;onPrinterDisconnected();
    throw new Error('Cetak gagal karena koneksi printer terputus. Hubungkan kembali thermal printer lalu cetak ulang.');
  }
}

