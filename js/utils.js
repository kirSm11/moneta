(function(){
  const U = {};
  U.id = (p='id') => `${p}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`;
  U.escape = (s='') => String(s).replace(/[&<>'"]/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':'&quot;'}[c]));
  U.money = (n=0) => new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2}).format(Number(n)||0)+' ₽';
  U.dateISO = (d=new Date()) => {
    const z=n=>String(n).padStart(2,'0');
    return `${d.getFullYear()}-${z(d.getMonth()+1)}-${z(d.getDate())}`;
  };
  U.timeHM = (d=new Date()) => `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  U.startOfWeek = (d=new Date()) => { const x=new Date(d); const day=(x.getDay()+6)%7; x.setDate(x.getDate()-day); x.setHours(0,0,0,0); return x; };
  U.startOfMonth = (d=new Date()) => new Date(d.getFullYear(),d.getMonth(),1);
  U.startOfYear = (d=new Date()) => new Date(d.getFullYear(),0,1);
  U.sameDay = (a,b) => new Date(a).toDateString()===new Date(b).toDateString();
  U.periodStart = (period, d=new Date()) => ({day:new Date(d.getFullYear(),d.getMonth(),d.getDate()), week:U.startOfWeek(d), month:U.startOfMonth(d), year:U.startOfYear(d), all:new Date(0)})[period];
  U.sleep = ms => new Promise(r=>setTimeout(r,ms));
  U.hexFromBuffer = buf => Array.from(new Uint8Array(buf)).map(x=>x.toString(16).padStart(2,'0')).join('');
  U.toBase64Url = bytes => btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  U.fromBase64Url = str => Uint8Array.from(atob(str.replace(/-/g,'+').replace(/_/g,'/')+'==='.slice((str.length+3)%4)), c=>c.charCodeAt(0));

  // WebCrypto is unavailable in some local-file WebViews on iOS. The PIN must
  // still work there, so use SHA-256 when available and a deterministic local
  // fallback otherwise. This is local app locking, not server-side security.
  U.hashPin = async (pin, salt) => {
    const wc = window.crypto;
    if (wc && wc.subtle && window.TextEncoder) {
      try {
        const data = new TextEncoder().encode(`${salt}:${pin}`);
        return U.hexFromBuffer(await wc.subtle.digest('SHA-256', data));
      } catch (_) { /* fall through */ }
    }
    const text = `${salt}:${pin}`;
    let h1 = 0x811c9dc5, h2 = 0x9e3779b9;
    for (let i=0;i<text.length;i++) {
      const c=text.charCodeAt(i);
      h1 ^= c; h1 = Math.imul(h1, 0x01000193);
      h2 ^= c + i; h2 = Math.imul(h2, 0x85ebca6b);
    }
    return `fallback-${(h1>>>0).toString(16).padStart(8,'0')}${(h2>>>0).toString(16).padStart(8,'0')}`;
  };
  U.download = (filename, text, type='application/json') => {
    const blob=new Blob([text],{type});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url; a.download=filename; a.rel='noopener';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),15000);
  };
  U.shareFile = async (filename, text, type='application/json') => {
    const blob=new Blob([text],{type});
    if(navigator.share){
      const candidates=[];
      try{candidates.push(new File([blob],filename,{type,lastModified:Date.now()}));}catch(_){/* older WebViews */}
      // Some iOS versions are stricter about shareable MIME types. Keep the .json
      // filename but also try text/plain so «Сохранить в Файлы» still works.
      try{candidates.push(new File([text],filename,{type:'text/plain',lastModified:Date.now()}));}catch(_){/* older WebViews */}
      for(const file of candidates){
        let canShare=true;
        try{if(navigator.canShare)canShare=navigator.canShare({files:[file]});}catch(_){canShare=false;}
        if(!canShare)continue;
        try{
          await navigator.share({title:'Резервная копия Кошелька',files:[file]});
          return 'share';
        }catch(e){
          if(e?.name==='AbortError')throw e;
          // Try the next MIME variant, then fall back to browser download/preview.
        }
      }
    }
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url; a.download=filename; a.rel='noopener'; a.target='_blank';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),30000);
    return 'download';
  };
  window.FinUtils = U;
})();
