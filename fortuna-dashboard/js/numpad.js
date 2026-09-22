// Fortuna Laundry — numpad module

function setupNumpad(){const pad=[1,2,3,4,5,6,7,8,9,'.',0,'⌫'];$('numpad').innerHTML=pad.map(x=>`<button type="button" onclick="numKey('${x}')">${x}</button>`).join('');document.removeEventListener('focusin',handleNumFocus);document.addEventListener('focusin',handleNumFocus)}

function handleNumFocus(e){if(e.target?.classList?.contains('num-input'))openNumpad(e.target)}

function openNumpad(el){numTarget=el;$('numDisplay').textContent=el.value||'0';$('numpadModal').classList.add('show');setTimeout(()=>el.blur(),0)}function numKey(k){if(!numTarget)return;let v=numTarget.value||'';if(k==='⌫')v=v.slice(0,-1);else if(k==='.'&&!v.includes('.'))v+='.';else if(k!=='.')v+=k;numTarget.value=v;$('numDisplay').textContent=v||'0';numTarget.dispatchEvent(new Event('input',{bubbles:true}))}
if($('e-tanggal'))$('e-tanggal').value=new Date().toISOString().slice(0,10);addPackage();setupNumpad();restorePrinter();loadDashboard(true);loadDeadline();showTab('ops');
