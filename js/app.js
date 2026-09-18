(function(){
  const U=FinUtils,S=FinStore,UI=FinUI;
  const screen=id=>document.getElementById(id);
  const activate=id=>['splash','authScreen','mainScreen'].forEach(x=>screen(x).classList.toggle('active',x===id));
  const host=()=>document.getElementById('authContent');

  function authBackButton(){return `<button class="auth-back" id="authBack" type="button" aria-label="Назад">← <span>Назад</span></button>`}

  function renderAuthHome(){
    activate('authScreen');
    const profiles=S.db.profiles||[];
    const last=S.getProfile()||[...profiles].sort((a,b)=>new Date(b.lastUsedAt||b.createdAt||0)-new Date(a.lastUsedAt||a.createdAt||0))[0]||null;
    const others=profiles.filter(p=>!last||p.id!==last.id);
    const storage=S.storageStatus();
    host().innerHTML=`
      <div class="auth-card auth-home-card">
        <div class="auth-kicker">Профили</div>
        <h2>${profiles.length?'Кто входит?':'Добро пожаловать'}</h2>
        <p>${profiles.length?'Последний профиль уже здесь. Нажми на него, чтобы войти.':'Создай профиль или восстанови его из резервной копии JSON.'}</p>
        ${last?`<button class="profile-entry primary-profile" data-profile="${last.id}" type="button">
          <span class="profile-avatar">${U.escape((last.name||'П').trim().slice(0,1).toUpperCase())}</span>
          <span class="profile-entry-text"><b>${U.escape(last.name||'Профиль')}</b><small>Последний профиль</small></span>
          <span class="profile-arrow">›</span>
        </button>`:''}
        ${others.length?`<div class="other-profiles"><div class="tiny muted">Другие профили</div>${others.map(p=>`<button class="profile-entry compact" data-profile="${p.id}" type="button"><span class="profile-avatar">${U.escape((p.name||'П').trim().slice(0,1).toUpperCase())}</span><span class="profile-entry-text"><b>${U.escape(p.name||'Профиль')}</b></span><span class="profile-arrow">›</span></button>`).join('')}</div>`:''}
        <div class="stack auth-actions">
          <button class="btn primary full" id="newProfileBtn" type="button">＋ Создать новый профиль</button>
          <label class="btn ghost full restore-profile-btn">↥ Восстановить профиль из JSON<input id="restoreProfileInput" type="file" accept="application/json,.json" hidden></label>
        </div>
        <div id="restoreError" class="tiny auth-error" hidden></div>
        ${storage.risk?`<div class="storage-warning"><b>Сохранение ограничено</b><span>Этот способ запуска может очищать данные после закрытия. Используй Safari/HTTPS или установленную версию и держи резервную JSON-копию.</span></div>`:''}
      </div>`;
    host().querySelectorAll('[data-profile]').forEach(b=>b.onclick=()=>renderPin(b.dataset.profile));
    host().querySelector('#newProfileBtn').onclick=renderCreateProfile;
    host().querySelector('#restoreProfileInput').onchange=restoreProfileFromFile;
  }

  function renderPin(profileId){
    activate('authScreen');
    const p=S.db.profiles.find(x=>x.id===profileId);
    if(!p)return renderAuthHome();
    host().innerHTML=`
      ${authBackButton()}
      <div class="auth-card pin-card">
        <div class="profile-avatar large">${U.escape((p.name||'П').trim().slice(0,1).toUpperCase())}</div>
        <h2>${U.escape(p.name||'Профиль')}</h2>
        <p>Введи пятизначный PIN.</p>
        <div class="field"><label>PIN</label><input id="loginPin" class="pin-input" inputmode="numeric" pattern="[0-9]*" maxlength="5" type="password" autocomplete="current-password" placeholder="•••••"></div>
        <div class="stack">
          <button class="btn primary full" id="unlock" type="button">Войти</button>
          ${p.settings?.biometrics&&p.biometricCredentialId?'<button class="btn purple full" id="bioUnlock" type="button">Открыть лицом / биометрией</button>':''}
        </div>
      </div>`;
    host().querySelector('#authBack').onclick=renderAuthHome;
    const pin=host().querySelector('#loginPin');
    pin.addEventListener('input',e=>e.target.value=e.target.value.replace(/\D/g,'').slice(0,5));
    pin.addEventListener('keydown',e=>{if(e.key==='Enter')host().querySelector('#unlock').click()});
    host().querySelector('#unlock').onclick=async()=>{
      const btn=host().querySelector('#unlock');
      if(!/^\d{5}$/.test(pin.value))return UI.toast('PIN должен быть из 5 цифр');
      btn.disabled=true; btn.textContent='Проверяю…';
      try{
        if(await S.verifyPin(p,pin.value)){S.setActive(p.id);enterApp();}
        else {UI.toast('Неверный PIN');pin.value='';pin.focus();}
      }finally{btn.disabled=false;btn.textContent='Войти'}
    };
    const bio=host().querySelector('#bioUnlock');
    if(bio)bio.onclick=async()=>{try{if(await FinAuth.authenticateBiometric(p)){S.setActive(p.id);enterApp()}}catch(e){UI.toast('Не удалось: '+e.message)}};
    setTimeout(()=>pin.focus(),80);
  }

  function renderCreateProfile(){
    activate('authScreen');
    host().innerHTML=`
      ${authBackButton()}
      <div class="auth-card">
        <div class="auth-kicker">Новый профиль</div>
        <h2>Создать профиль</h2>
        <p>Данные будут храниться отдельно. PIN — ровно пять цифр.</p>
        <div class="field"><label>Имя профиля</label><input id="newName" maxlength="24" placeholder="Например, Личный"></div>
        <div class="field"><label>PIN</label><input id="newPin" class="pin-input" inputmode="numeric" pattern="[0-9]*" maxlength="5" type="password" autocomplete="new-password" placeholder="•••••"></div>
        <button class="btn primary full" id="createProfile" type="button">Создать профиль</button>
        <div id="createError" class="tiny auth-error" hidden></div>
      </div>`;
    host().querySelector('#authBack').onclick=renderAuthHome;
    const btn=host().querySelector('#createProfile'), pin=host().querySelector('#newPin');
    pin.addEventListener('input',e=>e.target.value=e.target.value.replace(/\D/g,'').slice(0,5));
    btn.onclick=async()=>{
      const value=pin.value;
      if(!/^\d{5}$/.test(value))return UI.toast('PIN должен быть из 5 цифр');
      const err=host().querySelector('#createError');btn.disabled=true;btn.textContent='Создаю…';err.hidden=true;
      try{
        S.requestPersistence().catch(()=>{});
        const p=await S.createProfile(host().querySelector('#newName').value.trim()||'Мой профиль',value);
        S.setActive(p.id); enterApp();
        if(!S.isPersistent())setTimeout(()=>UI.toast('Для постоянного хранения лучше открыть приложение через HTTPS.'),350);
      }catch(e){console.error(e);err.textContent='Не удалось создать профиль: '+(e?.message||'неизвестная ошибка');err.hidden=false;UI.toast('Ошибка создания профиля')}
      finally{btn.disabled=false;btn.textContent='Создать профиль'}
    };
  }

  function restoreProfileFromFile(e){
    const f=e.target.files?.[0];if(!f)return;
    const input=e.target, err=host().querySelector('#restoreError');
    if(err)err.hidden=true;
    const r=new FileReader();
    r.onload=()=>{
      try{
        const restored=S.restoreProfiles(r.result);
        if(!restored.length)throw new Error('В файле нет профиля');
        UI.toast(restored.length===1?'Профиль восстановлен':`Восстановлено профилей: ${restored.length}`);
        S.setActive(restored[0].id);
        renderAuthHome();
      }catch(ex){console.error(ex);if(err){err.textContent='Не удалось восстановить: '+(ex?.message||'неверный JSON');err.hidden=false}UI.toast('Не удалось восстановить профиль')}
      finally{input.value=''}
    };
    r.onerror=()=>{if(err){err.textContent='Не удалось прочитать файл';err.hidden=false}input.value=''};
    r.readAsText(f);
  }

  function enterApp(){activate('mainScreen');const d=new Date();document.getElementById('todayLabel').textContent=d.toLocaleDateString('ru-RU',{weekday:'long',day:'numeric',month:'long'});UI.renderPage('home')}
  function showAuth(){renderAuthHome()}
  document.querySelectorAll('.nav-item').forEach(b=>b.onclick=()=>UI.renderPage(b.dataset.page));
  document.getElementById('profileButton').onclick=()=>UI.renderPage('settings');
  window.FinApp={showAuth,enterApp};

  // iOS long-press: keep our own long-press menus instead of the browser copy/share callout.
  document.addEventListener('contextmenu',e=>{
    if(e.target.closest('input,textarea,[contenteditable="true"]'))return;
    e.preventDefault();
  },{capture:true});
  window.addEventListener('load',async()=>{
    await S.ready;
    S.requestPersistence().catch(()=>{});
    if('serviceWorker' in navigator && location.protocol!=='file:'){
      try{
        let reloaded=false;
        navigator.serviceWorker.addEventListener('controllerchange',()=>{if(!reloaded){reloaded=true;location.reload()}});
        const reg=await navigator.serviceWorker.register('./sw.js');reg.update().catch(()=>{});
      }catch{}
    }
    await U.sleep(850);renderAuthHome();
  });
})();
