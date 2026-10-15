// Fortuna Laundry - Web Bluetooth / ESC-POS printer (v3)
// Bergantung pada: config.js ($, toast, printer (let printer=null), FORTUNA_LOGO_PNG)
//                  receipt-model.js (buildReceiptModel, buildReceiptLines, RECEIPT_COLUMNS)
//
// Perubahan v3 dibanding v2:
//  1. Isi struk TIDAK lagi dihitung di sini. Semua datang dari receipt-model.js,
//     jadi cetak = preview (satuan, nama paket, total, tanggal, teks).
//  2. Kirim ESC M 0 (pilih Font A) agar 32 kolom benar-benar 32 kolom.
//  3. Teks dipecah ke segmen kecil + jeda (flow control ringan) agar printer murah tidak kewalahan.
//  4. Logo gagal dimuat -> dilaporkan ke pemanggil (logoSkipped), bukan hilang diam-diam.
//  5. Error saat menyusun struk tidak lagi memutus koneksi printer.
//  6. Tidak ada toast ganda "printer terputus" saat kita sendiri yang memutus koneksi.
//  7. Bagian koneksi BLE (connect/restore/ensure/write) TIDAK diubah.

let printerCharacteristic=null;
let printerConnecting=false;
let printerPrinting=false;
let printerSelfDisconnect=false;

// ---- Pengaturan yang boleh di-tuning ---------------------------------------
const PRINTER_WIDTH=384;            // 58 mm = 384 dot
const PRINT_LOGO=true;              // set false untuk cetak teks saja (tes)
const LOGO_WIDTH=160;               // kelipatan 8, maks 384
const LOGO_BAND_ROWS=24;            // tinggi tiap pita raster
const LOGO_THRESHOLD=170;           // makin besar = makin hitam
const PRINTER_CHUNK_SIZE=20;        // naikkan bertahap (64, 100) kalau sudah stabil
const PRINTER_CHUNK_DELAY_MS=20;    // jeda antar chunk (write without response)
const PRINTER_ACK_DELAY_MS=6;       // jeda antar chunk (write with response)
const LOGO_BAND_DELAY_MS=120;       // jeda antar pita logo (beri waktu head thermal)
const PRINTER_LINES_PER_SEGMENT=8;  // jumlah baris teks per segmen sebelum jeda
const PRINTER_SEGMENT_DELAY_MS=60;  // jeda antar segmen teks
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
  if(printerSelfDisconnect)return;   // kita sendiri yang memutus (setelah gagal cetak); pesan error sudah ada
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

/* -------------------------- Logo: raster per pita -------------------------- */

// Hasil:
//   []      -> logo dimatikan / tidak dikonfigurasi (bukan error)
//   null    -> logo seharusnya dicetak tapi GAGAL (timeout / decode error)
//   [bands] -> array Uint8Array, tiap elemen = 1 perintah GS v 0 untuk maks LOGO_BAND_ROWS baris
function logoToBands(){
  return new Promise(resolve=>{
    try{
      if(!PRINT_LOGO||typeof FORTUNA_LOGO_PNG==='undefined'||!FORTUNA_LOGO_PNG)return resolve([]);
      const img=new Image();
      const timer=setTimeout(()=>resolve(null),3000);
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
        }catch(e){console.warn('[printer] logo gagal diproses:',e);resolve(null)}
      };
      img.onerror=()=>{clearTimeout(timer);resolve(null)};
      img.src=FORTUNA_LOGO_PNG;
    }catch(_){resolve(null)}
  });
}

/* ------------------------------ Susun ESC/POS ------------------------------ */

// Mengembalikan {segments:[{data:Uint8Array, delay:ms}], logoSkipped:boolean}
// Isi struk = buildReceiptLines(buildReceiptModel(o)) -> sama persis dengan preview "Sesuai printer".
async function buildFortunaEscPos(o){
  const model=buildReceiptModel(o);
  const lines=buildReceiptLines(model);
  const segs=[];
  let bytes=[];
  let align=1,bold=0,linesInSeg=0;
  let logoSkipped=false;

  const flush=delay=>{
    if(bytes.length){segs.push({data:Uint8Array.from(bytes),delay:delay||0});bytes=[]}
    linesInSeg=0;
  };

  // reset printer, spasi baris default, Font A, rata tengah, bold off
  segs.push({data:Uint8Array.of(0x1b,0x40, 0x1b,0x32, 0x1b,0x4d,0x00, 0x1b,0x61,0x01, 0x1b,0x45,0x00),delay:80});

  for(const line of lines){
    if(line.logo){
      const bands=await logoToBands();
      if(bands===null)logoSkipped=true;
      else if(bands.length){
        flush(0);
        bands.forEach(b=>segs.push({data:b,delay:LOGO_BAND_DELAY_MS}));
      }
      continue;
    }
    const a=line.align==='center'?1:0;
    const b=line.bold?1:0;
    if(a!==align){bytes.push(0x1b,0x61,a);align=a}
    if(b!==bold){bytes.push(0x1b,0x45,b);bold=b}
    const t=String(line.text||'').slice(0,RECEIPT_COLUMNS);
    for(let i=0;i<t.length;i++){
      const c=t.charCodeAt(i);
      bytes.push(c>=0x20&&c<=0x7e?c:0x3f);   // pengaman: hanya ASCII yang boleh lewat
    }
    bytes.push(0x0a);
    if(++linesInSeg>=PRINTER_LINES_PER_SEGMENT)flush(PRINTER_SEGMENT_DELAY_MS);
  }

  // kembalikan state printer; feed kertas sudah ada di baris penutup (printer 58 mm tanpa cutter)
  bytes.push(0x1b,0x45,0x00,0x1b,0x61,0x00);
  flush(PRINTER_END_DELAY_MS);
  return {segments:segs,logoSkipped};
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

// Mengembalikan {ok:true, logoSkipped:boolean}; melempar Error kalau gagal.
async function printReceipt(o){
  if(printerPrinting)throw new Error('Printer sedang mencetak, tunggu sebentar.');
  printerPrinting=true;
  try{
    let ready=await ensurePrinter();
    if(!ready){
      ready=await connectPrinter();
      if(!ready)throw new Error('Thermal printer belum terhubung. Hubungkan printer lalu coba cetak lagi.');
    }

    // 1) susun struk (kalau gagal di sini, koneksi printer dibiarkan)
    let built;
    try{
      built=await buildFortunaEscPos(o);
    }catch(err){
      console.error('[printer] susun struk gagal:',err);
      throw new Error('Gagal menyusun struk ('+(err?.message||err)+').');
    }

    // 2) kirim ke printer
    try{
      if(!printer?.gatt?.connected||!printerCharacteristic)throw new Error('Koneksi thermal printer terputus.');
      await writePrinterPayload(built.segments);
      return {ok:true,logoSkipped:built.logoSkipped};
    }catch(err){
      console.error('[printer] cetak gagal:',err);
      // tutup koneksi lama dengan bersih; objek `printer` dipertahankan agar bisa sambung ulang
      printerSelfDisconnect=true;
      try{if(printer?.gatt?.connected)printer.gatt.disconnect()}catch(_){}
      setTimeout(()=>{printerSelfDisconnect=false},1500);
      printerCharacteristic=null;
      setPrinterUI(false,'Hubungkan ke printer');
      throw new Error('Cetak gagal ('+(err?.message||err)+'). Struk mungkin tercetak sebagian. Matikan-nyalakan printer, hubungkan ulang, lalu cetak ulang.');
    }
  }finally{printerPrinting=false}
}
