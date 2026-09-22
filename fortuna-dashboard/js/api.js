// Fortuna Laundry — API layer
const api=async(action,data={})=>{const r=await fetch(WEBHOOK_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,data})});const j=await r.json();if(!r.ok||j.status==='error')throw new Error(j.message||'Request gagal');return j};
