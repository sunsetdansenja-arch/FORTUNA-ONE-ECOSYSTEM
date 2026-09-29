// Fortuna Laundry - Web Bluetooth / ESC-POS printer (v2, fix "cuma logo yang keluar")
// Bergantung pada config.js: $, toast, printer (let printer=null), FORTUNA_LOGO_PNG
//
// Perubahan utama dibanding versi lama:
//  1. Logo dikirim per pita 24 baris (bukan 1 blok 3,7 KB) + jeda antar pita,
//     supaya buffer printer tidak meluap saat sedang mencetak gambar.
//  2. Chunk BLE 20 byte (aman untuk MTU default), memakai write-with-response
//     bila tersedia (ada ACK), dan retry kalau "GATT operation already in progress".
//  3. Bug device.gatt.server (tidak ada) diperbaiki -> device.gatt.
//  4. Error asli ditampilkan + di-console.error, koneksi lama ditutup bersih
//     sebelum sambung ulang (tidak lagi membuang objek printer begitu saja).
//  5. Device baru disimpan ke `printer` hanya kalau characteristic-nya valid.

let printerCharacteristic=null;
let printerConnecting=false;
let printerPrinting=false;

// ---- Pengaturan yang boleh di-tuning ---------------------------------------
const PRINTER_WIDTH=384;            // 58 mm = 384 dot
const RECEIPT_COLUMNS=32;           // Font A 12x24 => 32 karakter
const PRINT_LOGO=true;              // set false untuk cetak teks saja (tes)
const LOGO_WIDTH=160;               // kelipatan 8, maks 384
const LOGO_BAND_ROWS=24;            // tinggi tiap pita raster
const LOGO_THRESHOLD=170;           // makin besar = makin hitam
const PRINTER_CHUNK_SIZE=20;        // naikkan bertahap (64, 100) kalau sudah stabil
const PRINTER_CHUNK_DELAY_MS=20;    // jeda antar chunk (write without response)
const PRINTER_ACK_DELAY_MS=6;       // jeda antar chunk (write with response)
const LOGO_BAND_DELAY_MS=120;       // jeda antar pita logo (beri waktu head thermal)
const PRINTER_END_DELAY_MS=400;     // tunggu buffer terakhir habis
// ----------------------------------------------------------------------------

const PRINTER_OPTIONAL_SERVICES=[
  '000018f0-0000-1000-8000-00805f9b34fb',
  '0000ff00-0000-1000-8000-00805f9b34fb',
  '0000ffe0-0000-1000-8000-00805f9b34fb',
  '0000ffe5-0000-1000-8000-00805f9b34fb',
  '0000e025-0000-1000-8000-00805f9b34fb',
  '00001101-0000-1000-8000-00805f9b34fb',
  '49535343-fe7d-4ae5-8fa9-9fafd205e455'
];
const PRINTER_IGNORED_SERVICES=[
  '00001800-0000-1000-8000-00805f9b34fb',
  '00001801-0000-1000-8000-00805f9b34fb'
];
const PRINTER_NAME_RE=/RPP02N|RPP|Printer|Thermal|POS|MTP|Smartcom/i;

const sleep=ms=>new Promise(r=>setTimeout(r,ms));

function setPrinterUI(connected,text){
  const btn=$('printerBtn'),icon=$('printerIcon'),label=$('printerText');
  if(!btn)return;
  label.textContent=text||(connected?'Terhubung':'Hubungkan ke printer');
  icon.className=connected?'fa-solid fa-print mr-1 text-emerald-600':'fa-solid fa-print mr-1 text-red-600';
  btn.classList.toggle('bg-emerald-50',connected);
  btn.classList.toggle('text-[#0F5A47]',connected);
}

function orderPrinterDevices(devices){
  const isP=d=>d.name&&PRINTER_NAME_RE.test(d.name);
  return [...devices.filter(isP),...devices.filter(d=>!isP(d))];
}

async function findWritableCharacteristic(device){
  if(!device?.gatt)return null;
  // FIX: BluetoothRemoteGATTServer tidak punya properti .server
  const server=device.gatt.connected?device.gatt:await device.gatt.connect();
  const all=await server.getPrimaryServices();
  const services=all.filter(s=>!PRINTER_IGNORED_SERVICES.includes(s.uuid));
  const rank=s=>{const i=PRINTER_OPTIONAL_SERVICES.indexOf(s.uuid);return i<0?99:i};
  services.sort((a,b)=>rank(a)-rank(b));
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

// Coba device yang pernah diizinkan. `printer` hanya di-set kalau berhasil.
async function tryAuthorizedDevices(){
  if(!navigator.bluetooth?.getDevices)return false;
  const devices=await navigator.bluetooth.getDevices();
  for(const device of orderPrinterDevices(devices)){
    try{
      bindPrinterDisconnect(device);
      const c=await findWritableCharacteristic(device);
      if(c){printer=device;printerCharacteristic=c;return true}
    }catch(e){console.debug('[printer] device dilewati:',device.name,e)}
  }
  return false;
}

async function restorePrinter(){
  try{
    if(await tryAuthorizedDevices()){setPrinterUI(true,'Terhubung');return true}
  }catch(err){console.debug('Printer belum dapat dipulihkan:',err)}
  printerCharacteristic=null;return false;
}

async function choosePrinter(){
  return await navigator.bluetooth.requestDevice({acceptAllDevices:true,optionalServices:PRINTER_OPTIONAL_SERVICES});
}

async function connectPrinter(){
  if(printerConnecting)return !!printerCharacteristic;
  if(!navigator.bluetooth){toast('Browser tidak mendukung Web Bluetooth. Gunakan Chrome/Edge.',false);return false}
  const btn=$('printerBtn'),icon=$('printerIcon'),txt=$('printerText');
  printerConnecting=true;if(btn)btn.disabled=true;if(icon)icon.className='fa-solid fa-spinner fa-spin mr-1';if(txt)txt.textContent='Mencari printer...';
  try{
    // 1) pakai device yang sedang dipegang
    if(printer?.gatt){
      try{
        bindPrinterDisconnect(printer);
        const c=await findWritableCharacteristic(printer);
        if(c){printerCharacteristic=c;setPrinterUI(true,'Terhubung');toast('Printer terhubung');return true}
      }catch(e){console.debug('[printer] reuse gagal:',e)}
    }
    // 2) device yang pernah diizinkan
    try{
      if(await tryAuthorizedDevices()){setPrinterUI(true,'Terhubung');toast('Printer terhubung');return true}
    }catch(e){console.debug('[printer] getDevices gagal:',e)}
    // 3) minta pairing baru
    const dev=await choosePrinter();
    bindPrinterDisconnect(dev);
    const c=await findWritableCharacteristic(dev);
    if(!c)throw new Error('Printer ditemukan, tetapi characteristic Bluetooth untuk mengirim data tidak ditemukan');
    printer=dev;printerCharacteristic=c;
    setPrinterUI(true,'Terhubung');toast('Printer '+(printer.name||'Bluetooth')+' terhubung');return true;
  }catch(e){
    printerCharacteristic=null;setPrinterUI(false,'Hubungkan ke printer');
    console.error('[printer] connect gagal:',e);
    toast(e?.name==='NotFoundError'?'Pemilihan printer dibatalkan.':(e?.message||'Gagal menghubungkan printer.'),false);return false;
  }finally{printerConnecting=false;if(btn)btn.disabled=false}
}

async function ensurePrinter(){
  if(printerCharacteristic&&printer?.gatt?.connected)return true;
  if(printer?.gatt){
    try{
      bindPrinterDisconnect(printer);
      const c=await findWritableCharacteristic(printer);
      if(c){printerCharacteristic=c;setPrinterUI(true,'Terhubung');return true}
    }catch(e){console.debug('[printer] reconnect gagal:',e);printerCharacteristic=null}
  }
  return false;
}

/* ------------------------------ ESC/POS teks ------------------------------ */

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

// Kiri-kanan; kalau tidak muat, kolom kanan turun ke baris berikutnya (tidak melebihi 32 kolom)
function receiptLeftRight(left,right){
  const l=escposText(left);
  const r=escposText(right);
  if(l.length+r.length+1<=RECEIPT_COLUMNS)
    return l+' '.repeat(RECEIPT_COLUMNS-l.length-r.length)+r+'\n';
  return l.slice(0,RECEIPT_COLUMNS)+'\n'+' '.repeat(Math.max(0,RECEIPT_COLUMNS-r.length))+r+'\n';
}

function receiptSeparator(char='-'){
  return receiptCentered(char.repeat(RECEIPT_COLUMNS));
}

/* -------------------------- Logo: raster per pita -------------------------- */

// Hasil: array Uint8Array, tiap elemen = 1 perintah GS v 0 untuk maks LOGO_BAND_ROWS baris.
function logoToBands(){
  return new Promise(resolve=>{
    try{
      if(!PRINT_LOGO||typeof FORTUNA_LOGO_PNG==='undefined'||!FORTUNA_LOGO_PNG)return resolve([]);
      const img=new Image();
      const timer=setTimeout(()=>resolve([]),3000);
      img.onload=()=>{
        clearTimeout(timer);
        try{
          const natW=img.naturalWidth||LOGO_WIDTH,natH=img.naturalHeight||LOGO_WIDTH;
          const w=Math.max(8,Math.floor(Math.min(LOGO_WIDTH,PRINTER_WIDTH,natW)/8)*8);
          const h=Math.max(1,Math.round(natH*(w/natW)));
          const canvas=document.createElement('canvas');
          canvas.width=w;canvas.height=h;
          const ctx=canvas.getContext('2d',{willReadFrequently:true});
          ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
          ctx.fillStyle='#fff';ctx.fillRect(0,0,w,h);   // transparan -> putih
          ctx.drawImage(img,0,0,w,h);
          const px=ctx.getImageData(0,0,w,h).data;
          const rowBytes=w>>3;
          const bands=[];
          for(let y0=0;y0<h;y0+=LOGO_BAND_ROWS){
            const rows=Math.min(LOGO_BAND_ROWS,h-y0);
            const band=new Uint8Array(8+rowBytes*rows);
            band.set([0x1d,0x76,0x30,0x00,rowBytes&255,(rowBytes>>8)&255,rows&255,(rows>>8)&255]);
            for(let y=0;y<rows;y++){
              for(let x=0;x<w;x++){
                const i=((y0+y)*w+x)*4;
                const gray=px[i]*0.299+px[i+1]*0.587+px[i+2]*0.114;
                if(gray<LOGO_THRESHOLD)band[8+y*rowBytes+(x>>3)]|=0x80>>(x&7);
              }
            }
            bands.push(band);
          }
          resolve(bands);
        }catch(e){console.warn('[printer] logo gagal diproses:',e);resolve([])}
      };
      img.onerror=()=>{clearTimeout(timer);resolve([])};
      img.src=FORTUNA_LOGO_PNG;
    }catch(_){resolve([])}
  });
}

/* ------------------------------ Susun struk ------------------------------- */

// Mengembalikan daftar segmen {data:Uint8Array, delay:ms}
async function buildFortunaEscPos(o){
  const segs=[];
  const bytes=[];
  const encoder=new TextEncoder();
  const pushText=s=>bytes.push(...encoder.encode(s));
  const pushCmd=(...v)=>bytes.push(...v);

  // init + rata tengah untuk logo
  segs.push({data:Uint8Array.of(0x1b,0x40,0x1b,0x32,0x1b,0x61,0x01),delay:80});

  const bands=await logoToBands();
  bands.forEach(b=>segs.push({data:b,delay:LOGO_BAND_DELAY_MS}));
  if(bands.length)pushCmd(0x0a);

  pushText(receiptCentered('FORTUNA LAUNDRY',true));
  pushText(receiptCentered('Jalan Raya Inpres no 4'));
  pushText(receiptCentered('Jakarta Timur'));
  pushText(receiptCentered('085693280500'));
  pushCmd(0x0a);

  const dt=printerDate(o.START||null);
  const fmt={day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'};
  const date=isNaN(dt.getTime())?new Date().toLocaleString('id-ID',fmt):dt.toLocaleString('id-ID',fmt);
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
  // Feed kertas agar bisa disobek (printer 58 mm Smartcom tidak punya cutter, GS V dibuang)
  pushCmd(0x0a,0x0a,0x0a,0x0a);

  segs.push({data:new Uint8Array(bytes),delay:PRINTER_END_DELAY_MS});
  return segs;
}

/* --------------------------------- Kirim BLE ------------------------------- */

async function writePrinterChunk(chunk){
  const c=printerCharacteristic;
  if(!c)throw new Error('Characteristic printer tidak tersedia.');
  if(!chunk||!chunk.length)return;
  for(let attempt=0;;attempt++){
    try{
      if(c.properties.write&&typeof c.writeValueWithResponse==='function'){
        await c.writeValueWithResponse(chunk);
        if(PRINTER_ACK_DELAY_MS)await sleep(PRINTER_ACK_DELAY_MS);
      }else if(c.properties.writeWithoutResponse&&typeof c.writeValueWithoutResponse==='function'){
        await c.writeValueWithoutResponse(chunk);
        await sleep(PRINTER_CHUNK_DELAY_MS);
      }else{
        await c.writeValue(chunk);
        await sleep(PRINTER_CHUNK_DELAY_MS);
      }
      return;
    }catch(e){
      // "GATT operation already in progress" = data belum terkirim, aman diulang
      if(attempt<5&&/in progress/i.test(String(e?.message||e))){await sleep(100);continue}
      throw e;
    }
  }
}

async function writePrinterPayload(segments){
  if(!printerCharacteristic)throw new Error('Characteristic printer tidak tersedia.');
  for(const seg of segments){
    for(let i=0;i<seg.data.length;i+=PRINTER_CHUNK_SIZE){
      if(!printer?.gatt?.connected)throw new Error('Koneksi Bluetooth terputus saat mengirim data.');
      await writePrinterChunk(seg.data.slice(i,i+PRINTER_CHUNK_SIZE));
    }
    if(seg.delay)await sleep(seg.delay);
  }
}

async function printReceipt(o){
  if(printerPrinting)throw new Error('Printer sedang mencetak, tunggu sebentar.');
  printerPrinting=true;
  try{
    let ready=await ensurePrinter();
    if(!ready){
      ready=await connectPrinter();
      if(!ready)throw new Error('Thermal printer belum terhubung. Hubungkan printer lalu coba cetak lagi.');
    }
    try{
      const segments=await buildFortunaEscPos(o);
      if(!printer?.gatt?.connected||!printerCharacteristic)throw new Error('Koneksi thermal printer terputus.');
      await writePrinterPayload(segments);
      return true;
    }catch(err){
      console.error('[printer] cetak gagal:',err);
      // tutup koneksi lama dengan bersih; objek `printer` dipertahankan agar bisa sambung ulang
      try{if(printer?.gatt?.connected)printer.gatt.disconnect()}catch(_){}
      printerCharacteristic=null;
      setPrinterUI(false,'Hubungkan ke printer');
      throw new Error('Cetak gagal ('+(err?.message||err)+'). Matikan-nyalakan printer, lalu hubungkan ulang dan cetak lagi.');
    }
  }finally{printerPrinting=false}
}