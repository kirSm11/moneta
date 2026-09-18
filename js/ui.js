(function(){
  const U=FinUtils, S=FinStore, ST=FinStats;
  const state={page:'home',mode:'expense',selectedCardId:null,chartIndex:0,historyFiltersOpen:false,historyFilters:{year:'',month:'',day:'',cardId:'',categoryId:'',merchant:''},summaryAlt:{month:false,day:false,income:false}};
  const summaryTimers={month:null,day:null,income:null};
  const modalRoot=document.getElementById('modalRoot');
  const toast=(text)=>{const d=document.createElement('div');d.className='toast';d.textContent=text;document.getElementById('toastRoot').appendChild(d);setTimeout(()=>d.remove(),2400)};
  const closeModal=()=>modalRoot.innerHTML='';
  const modal=(html,{full=false,onOpen}={})=>{modalRoot.innerHTML=`<div class="modal-backdrop"><div class="modal ${full?'full':''}"><div class="modal-handle"></div>${html}</div></div>`;modalRoot.querySelector('.modal-backdrop').addEventListener('click',e=>{if(e.target.classList.contains('modal-backdrop'))closeModal()});onOpen?.(modalRoot.querySelector('.modal'));};
  const confirmAction=({title='Подтверждение',text='',confirmText='Удалить',onConfirm})=>{const layer=document.createElement('div');layer.className='confirm-layer';layer.innerHTML=`<div class="confirm-card"><h3>${U.escape(title)}</h3><p>${U.escape(text)}</p><div class="row"><button class="btn ghost" data-cancel style="flex:1">Отмена</button><button class="btn danger" data-confirm style="flex:1">${U.escape(confirmText)}</button></div></div>`;modalRoot.appendChild(layer);const close=()=>layer.remove();layer.addEventListener('click',e=>{if(e.target===layer)close()});layer.querySelector('[data-cancel]').onclick=close;layer.querySelector('[data-confirm]').onclick=()=>{close();onConfirm?.();};};
  const getP=()=>S.getProfile();
  const cardStyle=c=>{let bg=c.color||'#333'; const map={sber:'linear-gradient(135deg,#34bd55 0%,#35c95c 48%,#8ee39b 100%)',tinkoff:'linear-gradient(135deg,#1e1f23,#0b0c0f 50%,#373943 100%)',vtb:'linear-gradient(135deg,#145fbd,#0d57b7 55%,#0b4fa9 100%)',alfa:'linear-gradient(135deg,#e04a35,#df4833 52%,#ea6d5b 100%)',mustard:'linear-gradient(135deg,#f0c65a,#9c6c0a)',purple:'linear-gradient(135deg,#8f71ff,#3e2a8d)',black:'linear-gradient(135deg,#333,#0d0d0f)'};return `background:${c.texture?`linear-gradient(rgba(0,0,0,.16),rgba(0,0,0,.16)),url('${c.texture}') center/cover`:map[c.theme]||bg};color:${c.textColor||'#fff'}`};
  const cardLogo=(theme)=>({
    sber:`<div class="bank-logo sber" aria-hidden="true"><span class="sber-symbol"></span><b>СБЕР</b></div>`,
    tinkoff:`<div class="bank-logo tinkoff" aria-hidden="true"><svg viewBox="0 0 34 40" xmlns="http://www.w3.org/2000/svg"><path d="M6 3h22v20L17 37 6 23z" fill="#f5f5f5"/><path d="M12 12h10v3h-3v10h-4V15h-3z" fill="#111"/></svg></div>`,
    vtb:`<div class="bank-logo vtb" aria-hidden="true"><span class="vtb-bars"><i></i><i></i><i></i></span><b>ВТБ</b></div>`,
    alfa:`<div class="bank-logo alfa" aria-hidden="true"><svg viewBox="0 0 40 42" xmlns="http://www.w3.org/2000/svg"><path d="M8 28L16 6h8l8 22h-5l-1.6-4.8H14.6L13 28H8zm8-9h8l-4-11-4 11z" fill="#111"/><rect x="8" y="32" width="24" height="4" rx="2" fill="#111"/></svg></div>`
  }[theme]||'');
  const iconIds=['cart','coffee','burger','home','taxi','takeaway','cinema','gamepad','medicine','clothes','travel','pets','gift','phone','receipt','work','income','growth','trophy','education','repair','heart','shopping','card'];
  const legacyIconMap={'🛒':'cart','☕':'coffee','🍔':'burger','🏠':'home','🚕':'taxi','⛽':'taxi','🎬':'cinema','🎮':'gamepad','💊':'medicine','👕':'clothes','✈️':'travel','🐾':'pets','🎁':'gift','📱':'phone','🧾':'receipt','💼':'work','💰':'income','📈':'growth','🏋️':'trophy','🎓':'education','🔧':'repair','❤️':'heart','🛍️':'shopping','🚇':'taxi'};
  const iconKey=icon=>iconIds.includes(icon)?icon:(legacyIconMap[icon]||'cart');
  const categoryIcon=(icon,extra='')=>`<img class="category-icon-img ${extra}" src="assets/category-icons/${iconKey(icon)}.png" alt="" draggable="false">`;
  const normMerchant=v=>String(v||'').trim().toLocaleLowerCase('ru-RU');
  const merchantSuggestions=(profile,categoryId,query='')=>{
    const map=new Map();
    const saved=profile.merchantsByCategory?.[categoryId]||[];
    saved.forEach((name,i)=>{const key=normMerchant(name);if(key)map.set(key,{name,saved:true,count:0,last:0,order:i})});
    profile.transactions.filter(t=>t.categoryId===categoryId&&String(t.merchant||'').trim()).forEach(t=>{
      const name=String(t.merchant).trim(),key=normMerchant(name),time=Date.parse(t.datetime||t.createdAt||0)||0;
      const item=map.get(key)||{name,saved:false,count:0,last:0,order:999};
      item.count++;item.last=Math.max(item.last,time);map.set(key,item);
    });
    const q=normMerchant(query);
    return [...map.values()].filter(x=>!q||normMerchant(x.name).includes(q)).sort((a,b)=>{
      if(q){const ap=normMerchant(a.name).startsWith(q)?1:0,bp=normMerchant(b.name).startsWith(q)?1:0;if(ap!==bp)return bp-ap;}
      if(a.saved!==b.saved)return a.saved?-1:1;
      if(a.count!==b.count)return b.count-a.count;
      if(a.last!==b.last)return b.last-a.last;
      return a.name.localeCompare(b.name,'ru');
    });
  };
  const setTitle=t=>{const el=document.getElementById('pageTitle');el.textContent=t;document.getElementById('mainScreen')?.classList.toggle('home-page',!t);};
  const getActiveCardId=p=>{const saved=p?.settings?.activeCardId;return p?.cards?.some(c=>c.id===saved)?saved:(p?.cards?.[0]?.id||null)};
  const setActiveCard=id=>{const p=getP();if(!p?.cards?.some(c=>c.id===id))return false;state.selectedCardId=id;S.mutate(profile=>{profile.settings||={biometrics:false};profile.settings.activeCardId=id;});return true;};
  const orderedCards=p=>{const active=getActiveCardId(p);return [...p.cards].sort((a,b)=>(a.id===active?-1:0)-(b.id===active?-1:0));};

  function renderHome(){
    const p=getP(); if(!p)return; setTitle('');
    state.selectedCardId=getActiveCardId(p);
    const activeCard=p.cards.find(c=>c.id===state.selectedCardId)||null;
    const cats=p.categories.filter(c=>c.type===state.mode);
    document.getElementById('pageHost').innerHTML=`
      <div class="segmented"><button data-mode="expense" class="${state.mode==='expense'?'active':''}">Расход</button><button data-mode="income" class="${state.mode==='income'?'active':''}">Доход</button></div>
      <div class="section-title card-section-title"><h3>Карта</h3><button id="chooseCardBtn" class="card-switch-btn" type="button"><span>Карты</span><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M7.5 4.5 13 10l-5.5 5.5"/></svg></button></div>
      <div class="active-card-wrap">
        ${activeCard?`<div class="bank-card home-bank-card theme-${activeCard.theme||'custom'} selected" data-active-card="${activeCard.id}" style="${cardStyle(activeCard)}">${cardLogo(activeCard.theme)}<div class="bank-name">${U.escape(activeCard.bank||'Карта')}</div><div class="card-title">${U.escape(activeCard.name)}</div><div class="card-chip"></div></div>`:'<button class="empty-card-action" id="createFirstCard" type="button">＋ Создать карту</button>'}
      </div>
      <div class="section-title"><h3>${state.mode==='expense'?'Куда потратил':'Откуда доход'}</h3><button id="addCategoryBtn">+ категория</button></div>
      <div class="categories-grid">
        ${cats.map(c=>{const month=ST.total(p,{type:c.type,period:'month',categoryId:c.id});return `<div class="category-tile ${c.type}" data-cat="${c.id}"><div class="cat-icon">${categoryIcon(c.icon)}</div><div><div class="cat-name">${U.escape(c.name)}</div><div class="cat-sub">${U.money(month)} за месяц</div></div></div>`}).join('')}
        <div class="category-tile add-category" id="addCategoryTile"><div class="plus">＋</div><div class="cat-name">Добавить</div></div>
      </div>`;
    bindHome();
  }
  function bindHome(){
    const host=document.getElementById('pageHost');
    host.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>{state.mode=b.dataset.mode;renderHome()});
    host.querySelector('#chooseCardBtn')?.addEventListener('click',openCardPicker);
    host.querySelector('#createFirstCard')?.addEventListener('click',openCardCreator);
    const active=host.querySelector('[data-active-card]');
    if(active){
      let timer,long=false;
      const start=()=>{long=false;timer=setTimeout(()=>{long=true;openCardContext(active.dataset.activeCard)},550)};
      const cancel=()=>clearTimeout(timer);
      active.addEventListener('pointerdown',start);active.addEventListener('pointerup',cancel);active.addEventListener('pointerleave',cancel);active.addEventListener('pointercancel',cancel);
      active.addEventListener('click',()=>{if(long){long=false;return}openCardPicker()});
    }
    host.querySelectorAll('#addCategoryBtn,#addCategoryTile').forEach(b=>b.onclick=()=>openCategoryCreator(state.mode));
    host.querySelectorAll('[data-cat]').forEach(el=>{
      let timer, long=false;
      const start=()=>{long=false;timer=setTimeout(()=>{long=true;openCategoryContext(el.dataset.cat)},550)}; const cancel=()=>clearTimeout(timer);
      el.addEventListener('pointerdown',start);el.addEventListener('pointerup',cancel);el.addEventListener('pointerleave',cancel);el.addEventListener('pointercancel',cancel);
      el.addEventListener('click',()=>{if(long){long=false;return}openTransactionComposer(el.dataset.cat)});
    });
  }
  function openCardPicker(){
    const p=getP();if(!p)return;
    const activeId=getActiveCardId(p),cards=orderedCards(p);
    modal(`<div class="card-picker-head"><div><h3>Карты</h3><p class="modal-sub">Выбери карту для новых операций</p></div><button class="picker-add-card" id="pickerAddCard" type="button" aria-label="Добавить карту">＋</button></div><div class="card-picker-list">${cards.map(c=>`<button class="card-picker-item ${c.id===activeId?'active':''}" data-pick-card="${c.id}" type="button"><span class="card-picker-preview"><span class="bank-card picker-card theme-${c.theme||'custom'}" style="${cardStyle(c)}">${cardLogo(c.theme)}<span class="bank-name">${U.escape(c.bank||'Карта')}</span><span class="card-title">${U.escape(c.name)}</span><span class="card-chip"></span></span></span><span class="card-picker-meta"><b>${U.escape(c.name)}</b><small>${U.escape(c.bank||'Карта')}</small></span><span class="card-picker-check">${c.id===activeId?'✓':'›'}</span><span class="card-picker-more" data-card-more="${c.id}" role="button" aria-label="Меню карты">•••</span></button>`).join('')}</div>`,{full:true,onOpen:m=>{
      m.querySelector('#pickerAddCard').onclick=openCardCreator;
      m.querySelectorAll('[data-pick-card]').forEach(row=>{
        row.onclick=e=>{if(long){long=false;return}if(e.target.closest('[data-card-more]'))return;const id=row.dataset.pickCard;if(setActiveCard(id)){closeModal();renderHome();toast('Карта выбрана')}};
        let timer,long=false;
        const start=e=>{if(e.target.closest('[data-card-more]'))return;long=false;timer=setTimeout(()=>{long=true;openCardContext(row.dataset.pickCard)},550)};
        const cancel=()=>clearTimeout(timer);
        row.addEventListener('pointerdown',start);row.addEventListener('pointerup',cancel);row.addEventListener('pointerleave',cancel);row.addEventListener('pointercancel',cancel);
      });
      m.querySelectorAll('[data-card-more]').forEach(b=>b.onclick=e=>{e.stopPropagation();openCardContext(b.dataset.cardMore)});
    }});
  }
  function openCardContext(id){
    const p=getP(), c=p.cards.find(x=>x.id===id); if(!c)return;
    const canDelete=p.cards.length>1;
    modal(`<div class="row"><div style="flex:1"><h3 style="margin-bottom:4px">${U.escape(c.name||'Карта')}</h3><p class="modal-sub">${U.escape(c.bank||'Банк')}</p></div></div><div class="stack" style="margin-top:14px"><button class="btn ghost full" id="pickCard">Выбрать эту карту</button><button class="btn danger full" id="removeCard" ${canDelete?'':'disabled'}>${canDelete?'Удалить карту':'Нужна хотя бы одна карта'}</button></div>`,{onOpen:m=>{
      m.querySelector('#pickCard').onclick=()=>{setActiveCard(id);closeModal();renderHome();toast('Карта выбрана')};
      m.querySelector('#removeCard').onclick=()=>{if(!canDelete)return;confirmAction({title:'Удалить карту?',text:`«${c.name}» будет удалена. Операции с этой картой будут переназначены на оставшуюся карту.`,onConfirm:()=>{if(!S.deleteCard(id))return toast('Не удалось удалить карту');const next=getActiveCardId(getP());state.selectedCardId=next;closeModal();renderHome();toast('Карта удалена')}})};
    }});
  }
  function openCardCreator(){
    const presets=[['sber','Сбер','#fff'],['tinkoff','Тинькофф','#fff'],['vtb','ВТБ','#fff'],['alfa','Альфа','#fff'],['black','Чёрная','#fff'],['purple','Фиолетовая','#fff']];
    modal(`<h3>Новая карта</h3><p class="modal-sub">Выбери основу или собери свою.</p><div class="preset-grid">${presets.map((x,i)=>`<button class="preset ${i===0?'selected':''}" data-preset="${x[0]}" style="${cardStyle({theme:x[0],textColor:x[2]})}">${cardLogo(x[0])}<span class="preset-label">${x[1]}</span></button>`).join('')}</div><div class="field"><label>Название карты</label><input id="cardName" value="Моя карта"></div><div class="field"><label>Банк / подпись</label><input id="cardBank" value="Сбер"></div><div class="row"><div class="field" style="flex:1"><label>Свой цвет</label><input id="cardColor" type="color" value="#d8a72e"></div><div class="field" style="flex:2"><label>Своя текстура</label><input id="cardTexture" type="file" accept="image/*"></div></div><button class="btn primary full" id="saveCard">Создать карту</button>`,{onOpen:m=>{
      let theme='sber', texture=null; m.querySelectorAll('[data-preset]').forEach(b=>b.onclick=()=>{m.querySelectorAll('[data-preset]').forEach(x=>x.classList.remove('selected'));b.classList.add('selected');theme=b.dataset.preset; const labels={sber:'Сбер',tinkoff:'Тинькофф',vtb:'ВТБ',alfa:'Альфа-Банк',black:'Своя карта',purple:'Своя карта'};m.querySelector('#cardBank').value=labels[theme]||'Своя карта';});
      m.querySelector('#cardColor').oninput=e=>{theme='custom';m.querySelectorAll('[data-preset]').forEach(x=>x.classList.remove('selected'))};
      m.querySelector('#cardTexture').onchange=e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>texture=r.result;r.readAsDataURL(f)};
      m.querySelector('#saveCard').onclick=()=>{const c={id:U.id('card'),name:m.querySelector('#cardName').value.trim()||'Карта',bank:m.querySelector('#cardBank').value.trim()||'Своя карта',theme,color:m.querySelector('#cardColor').value,textColor:['sber','vtb','alfa','tinkoff','black','purple'].includes(theme)?'#fff':'#111',texture};S.mutate(p=>{p.cards.push(c);p.settings||={biometrics:false};p.settings.activeCardId=c.id;});state.selectedCardId=c.id;closeModal();renderHome();toast('Карта добавлена');};
    }});
  }
  const icons=iconIds;
  function openCategoryCreator(type='expense',existing=null){
    const c=existing||{name:'',icon:type==='expense'?'cart':'work',budget:0,type};
    const selectedIcon=iconKey(c.icon);
    modal(`<h3>${existing?'Категория':'Новая категория'}</h3><div class="segmented"><button data-type="expense" class="${c.type==='expense'?'active':''}">Расход</button><button data-type="income" class="${c.type==='income'?'active':''}">Доход</button></div><div class="field"><label>Название</label><input id="catName" value="${U.escape(c.name)}" placeholder="Например, продукты"></div><div class="field"><label>Иконка</label><div class="icon-grid">${icons.map(i=>`<button class="icon-choice ${i===selectedIcon?'selected':''}" data-icon="${i}">${categoryIcon(i,'picker-icon')}</button>`).join('')}</div></div><div class="field" id="budgetField" style="${c.type==='income'?'display:none':''}"><label>Бюджет на месяц</label><input id="catBudget" type="number" min="0" step="100" value="${c.budget||0}"></div><div class="stack"><button class="btn primary full" id="saveCat">${existing?'Сохранить':'Добавить категорию'}</button>${existing?'<button class="btn danger full" id="deleteCatHere">Удалить категорию</button>':''}</div>`,{onOpen:m=>{
      let chosenType=c.type, icon=selectedIcon; m.querySelectorAll('[data-type]').forEach(b=>b.onclick=()=>{chosenType=b.dataset.type;m.querySelectorAll('[data-type]').forEach(x=>x.classList.toggle('active',x===b));m.querySelector('#budgetField').style.display=chosenType==='income'?'none':''});
      m.querySelectorAll('[data-icon]').forEach(b=>b.onclick=()=>{icon=b.dataset.icon;m.querySelectorAll('[data-icon]').forEach(x=>x.classList.toggle('selected',x===b))});
      m.querySelector('#saveCat').onclick=()=>{const name=m.querySelector('#catName').value.trim();if(!name)return toast('Нужно название');const budget=chosenType==='expense'?Number(m.querySelector('#catBudget').value||0):0;S.mutate(p=>{if(existing){const t=p.categories.find(x=>x.id===existing.id);if(!t)return;Object.assign(t,{name,icon,type:chosenType,budget});p.transactions.filter(t=>t.categoryId===existing.id).forEach(t=>t.type=chosenType)}else p.categories.push({id:U.id('cat'),name,icon,type:chosenType,budget,createdAt:new Date().toISOString()})});closeModal();state.mode=chosenType;renderHome();toast(existing?'Категория обновлена':'Категория добавлена');};
      const del=m.querySelector('#deleteCatHere');if(del)del.onclick=()=>deleteCategoryById(existing.id);
    }});
  }
  function deleteCategoryById(id){
    const p=getP(),c=p?.categories.find(x=>x.id===id);if(!c)return;
    confirmAction({title:'Удалить категорию?',text:`«${c.name}» и все операции внутри неё будут удалены.`,onConfirm:()=>{if(!S.deleteCategory(id))return toast('Категория уже удалена');closeModal();renderHome();toast('Категория удалена');}});
  }
  function openCategoryContext(id){
    const p=getP(), c=p.categories.find(x=>x.id===id); if(!c)return;
    const sheet=document.createElement('div');sheet.innerHTML=`<div class="modal-backdrop" id="ctxBack"><aside class="context-sheet"><div class="cat-icon" style="margin-bottom:12px">${categoryIcon(c.icon)}</div><h3>${U.escape(c.name)}</h3><button class="context-item" id="viewCat">Посмотреть карточку</button><button class="context-item" id="editCat">Изменить</button><button class="context-item danger" id="deleteCat">Удалить категорию</button></aside></div>`;modalRoot.innerHTML='';modalRoot.appendChild(sheet);sheet.querySelector('#ctxBack').onclick=e=>{if(e.target.id==='ctxBack')closeModal()};sheet.querySelector('#viewCat').onclick=()=>openCategoryCard(c.id);sheet.querySelector('#editCat').onclick=()=>openCategoryCreator(c.type,c);sheet.querySelector('#deleteCat').onclick=()=>deleteCategoryById(c.id);
  }
  function openCategoryCard(id){
    const p=getP(),c=p.categories.find(x=>x.id===id);const vals=['day','week','month','year','all'].map(x=>ST.total(p,{type:c.type,period:x,categoryId:id}));const labels=['Сегодня','Неделя','Месяц','Год','За всё время'];
    modal(`<div class="row"><div class="cat-icon">${categoryIcon(c.icon)}</div><div><h3>${U.escape(c.name)}</h3><p class="modal-sub">${c.type==='expense'?'Расход':'Доход'}</p></div></div><div class="panel">${labels.map((l,i)=>`<div class="stat-line"><strong>${l}</strong><span></span><b>${U.money(vals[i])}</b></div>`).join('')}</div>${c.type==='expense'?`<div class="panel"><div class="row between"><span>Бюджет месяца</span><b>${U.money(c.budget)}</b></div><div class="row between" style="margin-top:10px"><span>Осталось</span><b class="${c.budget-vals[2]>=0?'status-good':'status-bad'}">${U.money(c.budget-vals[2])}</b></div></div>`:''}<button class="btn ghost full" id="editCategory">Изменить категорию</button>`,{onOpen:m=>m.querySelector('#editCategory').onclick=()=>openCategoryCreator(c.type,c)});
  }
  function openTransactionComposer(catId){
    const p=getP(),c=p.categories.find(x=>x.id===catId); if(!c)return; if(!p.cards.length)return toast('Сначала создай карту');
    state.selectedCardId=getActiveCardId(p);
    const datetime=new Date();
    const drafts=[];
    let adding=true;
    modal(`<div class="row"><div class="cat-icon">${categoryIcon(c.icon)}</div><div><h3>${c.type==='expense'?'Новый расход':'Новый доход'}</h3><p class="modal-sub">${U.escape(c.name)}</p></div></div><div class="field"><label>Карта</label><select id="txCard">${p.cards.map(x=>`<option value="${x.id}" ${x.id===state.selectedCardId?'selected':''}>${U.escape(x.name)} · ${U.escape(x.bank)}</option>`).join('')}</select></div><div class="field"><label>Суммы</label><div class="amount-strip" id="amountStrip"></div><div class="tiny muted amount-help">Нажми +, чтобы добавить ещё сумму. Нажми на сумму, чтобы указать место и комментарий.</div></div><div class="datetime-grid"><div class="field"><label>Дата</label><input id="txDate" type="date" value="${U.dateISO(datetime)}"></div><div class="field"><label>Время</label><input id="txTime" type="time" value="${U.timeHM(datetime)}"></div></div><button class="btn primary full" id="saveTransactions">Сохранить операции</button>`,{full:true,onOpen:m=>{
      const strip=m.querySelector('#amountStrip');
      const renderDrafts=()=>{
        const committed=drafts.map((d,i)=>`<button class="amount-token" type="button" data-draft="${i}"><strong>${U.escape(String(d.amount))}</strong><small>${U.escape(d.merchant||'добавить место')}</small></button>${i<drafts.length-1?'<span class="amount-separator">+</span>':''}`).join('');
        const editor=adding?`${drafts.length?'<span class="amount-separator">+</span>':''}<div class="quick-amount-box"><input id="quickAmount" class="quick-amount" type="number" inputmode="decimal" min="0" step="1" placeholder="0"><span>₽</span></div><button class="amount-add" id="commitAmount" type="button" aria-label="Добавить сумму">＋</button>`:`<button class="amount-add amount-add-collapsed" id="startAmount" type="button" aria-label="Добавить ещё сумму">＋</button>`;
        strip.innerHTML=committed+editor;
        strip.querySelectorAll('[data-draft]').forEach(b=>b.onclick=()=>openDraftEditor(Number(b.dataset.draft)));
        const start=strip.querySelector('#startAmount');if(start)start.onclick=()=>{adding=true;renderDrafts();setTimeout(()=>strip.querySelector('#quickAmount')?.focus(),20)};
        const commit=strip.querySelector('#commitAmount');if(commit)commit.onclick=addQuick;
        const quick=strip.querySelector('#quickAmount');if(quick)quick.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();addQuick();}});
      };
      const addQuick=()=>{
        const quick=strip.querySelector('#quickAmount');
        const amount=Number(quick?.value);
        if(!(amount>0)){quick?.focus();return false;}
        drafts.push({amount,merchant:'',note:'',remember:false});
        adding=false;renderDrafts();return true;
      };
      const openDraftEditor=(index)=>{
        const d=drafts[index];if(!d)return;
        const layer=document.createElement('div');layer.className='submodal-layer';
        layer.innerHTML=`<div class="submodal"><div class="modal-handle"></div><h3>Детали ${U.escape(String(d.amount))} ₽</h3><div class="field"><label>Сумма</label><input id="draftAmount" type="number" inputmode="decimal" min="0" value="${d.amount}"></div><div class="field merchant-field"><label>${c.type==='expense'?'Где потратил':'Источник'}</label><input id="draftMerchant" value="${U.escape(d.merchant)}" placeholder="Например, Пятёрочка" autocomplete="off"><div class="merchant-quick-scroll" id="merchantQuick"></div><div class="merchant-match-list" id="merchantMatches"></div></div><div class="field"><label>Комментарий</label><textarea id="draftNote" rows="3" placeholder="Необязательно">${U.escape(d.note)}</textarea></div><label class="row tiny muted"><input id="draftRemember" type="checkbox" ${d.remember?'checked':''}> Запомнить это место в «${U.escape(c.name)}»</label><div class="row" style="margin-top:14px"><button class="btn danger" id="removeDraft">Убрать</button><button class="btn primary" style="flex:1" id="saveDraft">Готово</button></div></div>`;
        m.appendChild(layer);const close=()=>layer.remove();
        layer.addEventListener('click',e=>{if(e.target===layer)close()});
        const merchantInput=layer.querySelector('#draftMerchant'),quickHost=layer.querySelector('#merchantQuick'),matchHost=layer.querySelector('#merchantMatches');
        const chooseMerchant=name=>{merchantInput.value=name;matchHost.innerHTML='';matchHost.hidden=true;merchantInput.focus();};
        const renderMerchantHints=()=>{
          const q=merchantInput.value.trim();
          const all=merchantSuggestions(p,c.id,q);
          const quick=merchantSuggestions(p,c.id,'').slice(0,12);
          quickHost.innerHTML=quick.map(x=>`<button class="chip merchant-suggestion ${x.saved?'saved':''}" type="button" data-merchant-name="${U.escape(x.name)}">${U.escape(x.name)}</button>`).join('');
          quickHost.style.display=q?'none':'flex';
          if(q&&all.length){matchHost.hidden=false;matchHost.innerHTML=all.slice(0,6).map(x=>`<button class="merchant-match" type="button" data-merchant-name="${U.escape(x.name)}"><span>${U.escape(x.name)}</span><small>${x.saved?'сохранено':'из истории'}</small></button>`).join('');}
          else {matchHost.hidden=true;matchHost.innerHTML='';}
          layer.querySelectorAll('[data-merchant-name]').forEach(ch=>ch.onclick=()=>chooseMerchant(ch.dataset.merchantName));
        };
        merchantInput.addEventListener('input',renderMerchantHints);merchantInput.addEventListener('focus',renderMerchantHints);renderMerchantHints();
        layer.querySelector('#removeDraft').onclick=()=>{drafts.splice(index,1);close();adding=drafts.length===0;renderDrafts();};
        layer.querySelector('#saveDraft').onclick=()=>{const amount=Number(layer.querySelector('#draftAmount').value);if(!(amount>0))return toast('Сумма должна быть больше нуля');d.amount=amount;d.merchant=layer.querySelector('#draftMerchant').value.trim();d.note=layer.querySelector('#draftNote').value.trim();d.remember=layer.querySelector('#draftRemember').checked;close();renderDrafts();};
      };
      m.querySelector('#saveTransactions').onclick=()=>{
        const quick=strip.querySelector('#quickAmount');if(quick&&Number(quick.value)>0)addQuick();
        if(!drafts.length)return toast('Впиши хотя бы одну сумму');
        const date=m.querySelector('#txDate').value,time=m.querySelector('#txTime').value;const dt=new Date(`${date}T${time||'12:00'}`);const cardId=m.querySelector('#txCard').value;
        S.mutate(profile=>{drafts.forEach((x,i)=>profile.transactions.push({id:U.id('tx'),type:c.type,categoryId:c.id,cardId,amount:Number(x.amount),merchant:x.merchant,note:x.note,datetime:new Date(dt.getTime()+i*1000).toISOString(),createdAt:new Date().toISOString()}));profile.merchantsByCategory ||= {};const saved=profile.merchantsByCategory[c.id] ||= [];drafts.filter(x=>x.remember&&x.merchant).forEach(x=>{const key=normMerchant(x.merchant);if(!saved.some(name=>normMerchant(name)===key))saved.unshift(x.merchant)});});
        closeModal();toast(`Сохранено: ${drafts.length}`);renderHome();
      };
      renderDrafts();setTimeout(()=>strip.querySelector('#quickAmount')?.focus(),120);
    }});
  }
  function budgetClass(remaining,budget){if(!budget)return 'muted';const ratio=remaining/budget;if(remaining<0)return 'status-bad';if(ratio<.18)return 'status-warn';return 'status-good'}
  function renderStats(){
    const p=getP();setTitle('Статистика');
    const cats=ST.categorySummary(p,'expense','month');
    const expMonth=ST.total(p,{type:'expense',period:'month'}),expDay=ST.total(p,{type:'expense',period:'day'}),incMonth=ST.total(p,{type:'income',period:'month'}),budget=ST.totalBudget(p),weekExp=ST.total(p,{type:'expense',period:'week'}),merchants=ST.merchantSummary(p,'month');
    const summaryData={
      month:{baseLabel:'Расходы за месяц',baseValue:expMonth,altLabel:'Осталось от бюджета',altValue:budget-expMonth},
      day:{baseLabel:'Сегодня',baseValue:expDay,altLabel:'С понедельника',altValue:weekExp},
      income:{baseLabel:'Доход за месяц',baseValue:incMonth,altLabel:'Доход минус расходы',altValue:incMonth-expMonth}
    };
    const summaryCard=(kind)=>{const x=summaryData[kind],alt=state.summaryAlt[kind];return `<button class="summary-card ${alt?'alt':''}" data-summary="${kind}"><div class="label">${alt?x.altLabel:x.baseLabel}</div><div class="value">${U.money(alt?x.altValue:x.baseValue)}</div></button>`};
    document.getElementById('pageHost').innerHTML=`<div class="summary-row">${summaryCard('month')}${summaryCard('day')}${summaryCard('income')}</div><div class="section-title"><h3>Бюджеты</h3><span class="tiny muted">этот месяц</span></div><div class="panel">${cats.length?cats.map(x=>`<div class="stat-line"><div><strong class="stat-category-name">${categoryIcon(x.category.icon,'inline-stat-icon')}<span>${U.escape(x.category.name)}</span></strong><br><small>${U.money(x.spent)} потрачено</small></div><span></span><b class="${budgetClass(x.remaining,x.category.budget)}">${x.category.budget?U.money(x.remaining):'без лимита'}</b></div>`).join(''):'<div class="empty">Нет категорий расходов</div>'}</div><div class="section-title"><h3>Куда уходят деньги</h3><span class="tiny muted">свайпни график</span></div><div class="panel" id="chartCard">${chartHtml(p,cats,merchants)}</div>`;
    const host=document.getElementById('pageHost');
    host.querySelectorAll('[data-summary]').forEach(b=>b.onclick=()=>{
      const kind=b.dataset.summary;
      if(summaryTimers[kind]){clearTimeout(summaryTimers[kind]);summaryTimers[kind]=null;}
      state.summaryAlt[kind]=!state.summaryAlt[kind];
      const x=summaryData[kind],alt=state.summaryAlt[kind];
      b.classList.toggle('alt',alt);
      b.querySelector('.label').textContent=alt?x.altLabel:x.baseLabel;
      b.querySelector('.value').textContent=U.money(alt?x.altValue:x.baseValue);
      if(alt){
        summaryTimers[kind]=setTimeout(()=>{
          summaryTimers[kind]=null;state.summaryAlt[kind]=false;
          if(state.page!=='stats')return;
          const current=document.querySelector(`[data-summary="${kind}"]`);
          if(!current)return;
          current.classList.remove('alt');
          current.querySelector('.label').textContent=x.baseLabel;
          current.querySelector('.value').textContent=U.money(x.baseValue);
        },5000);
      }
    });
    let sx=0;const cc=host.querySelector('#chartCard');cc.addEventListener('touchstart',e=>sx=e.touches[0].clientX,{passive:true});cc.addEventListener('touchend',e=>{const dx=e.changedTouches[0].clientX-sx;if(Math.abs(dx)>40){state.chartIndex=state.chartIndex?0:1;renderStats()}},{passive:true});
  }
  function chartHtml(p,cats,merchants){
    if(state.chartIndex===1){const max=Math.max(1,...merchants.map(x=>x.value));return `<h4 style="margin-top:0">Места покупок</h4><div class="merchant-bars">${merchants.slice(0,8).map(x=>`<div class="merchant-bar"><div class="bar-head"><span>${U.escape(x.name)}</span><b>${U.money(x.value)}</b></div><div class="bar"><i style="width:${Math.max(5,x.value/max*100)}%"></i></div></div>`).join('')||'<div class="empty">Пока нет данных</div>'}</div>`}
    const vals=cats.filter(x=>x.spent>0), total=vals.reduce((s,x)=>s+x.spent,0)||1;const palette=['#d8a72e','#7d5cff','#5e8cff','#6dd59a','#f06f74','#c988dc'];let cur=0;const stops=vals.map((x,i)=>{const a=cur,b=cur+x.spent/total*100;cur=b;return `${palette[i%palette.length]} ${a}% ${b}%`}).join(',')||'#2a2a31 0 100%';return `<div class="chart-wrap"><div class="donut" style="background:conic-gradient(${stops})"></div><div class="legend">${vals.slice(0,7).map((x,i)=>`<div class="legend-item"><i style="background:${palette[i%palette.length]}"></i><span>${U.escape(x.category.name)}</span><b>${Math.round(x.spent/total*100)}%</b></div>`).join('')||'<span class="muted tiny">Добавь расходы — появится диаграмма.</span>'}</div></div>`;
  }
  function renderHistory(){
    const p=getP();setTitle('История');
    const all=[...p.transactions].sort((a,b)=>new Date(b.datetime)-new Date(a.datetime));
    const filters=state.historyFilters;
    const years=[...new Set(all.map(t=>String(new Date(t.datetime).getFullYear())))].sort((a,b)=>b.localeCompare(a,'ru'));
    const months=[...new Set(all.map(t=>U.dateISO(new Date(t.datetime)).slice(0,7)))].sort().reverse();
    const days=[...new Set(all.map(t=>U.dateISO(new Date(t.datetime))))].sort().reverse();
    const merchants=[...new Set(all.map(t=>(t.merchant||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ru'));
    const cards=p.cards,categories=p.categories;
    const activeFilterCount=Object.values(filters).filter(Boolean).length;
    const filtered=all.filter(t=>{
      const d=new Date(t.datetime), iso=U.dateISO(d), ym=iso.slice(0,7), year=String(d.getFullYear());
      if(filters.year && year!==filters.year)return false;
      if(filters.month && ym!==filters.month)return false;
      if(filters.day && iso!==filters.day)return false;
      if(filters.cardId && t.cardId!==filters.cardId)return false;
      if(filters.categoryId && t.categoryId!==filters.categoryId)return false;
      if(filters.merchant && (t.merchant||'').trim()!==filters.merchant)return false;
      return true;
    });
    const groups={};filtered.forEach(t=>{const d=new Date(t.datetime);const key=d.toLocaleDateString('ru-RU',{day:'2-digit',month:'long',year:'numeric'});(groups[key]??=[]).push(t)});
    const host=document.getElementById('pageHost');
    const filterPanel=state.historyFiltersOpen?`<div class="panel history-filter-panel"><div class="row between history-filter-actions"><b>Фильтры истории</b><div class="row"><button class="mini-action" id="clearHistoryFilters" ${activeFilterCount?'':'disabled'}>Сбросить</button><button class="mini-action primary" id="closeHistoryFilters">Готово</button></div></div><div class="history-filter-grid"><div class="field"><label>Год</label><select data-filter="year"><option value="">Все</option>${years.map(v=>`<option value="${v}" ${filters.year===v?'selected':''}>${v}</option>`).join('')}</select></div><div class="field"><label>Месяц</label><select data-filter="month"><option value="">Все</option>${months.map(v=>`<option value="${v}" ${filters.month===v?'selected':''}>${new Date(v+'-01').toLocaleDateString('ru-RU',{month:'long',year:'numeric'})}</option>`).join('')}</select></div><div class="field"><label>День</label><select data-filter="day"><option value="">Все</option>${days.map(v=>`<option value="${v}" ${filters.day===v?'selected':''}>${new Date(v+'T12:00').toLocaleDateString('ru-RU',{day:'2-digit',month:'long',year:'numeric'})}</option>`).join('')}</select></div><div class="field"><label>Карта</label><select data-filter="cardId"><option value="">Все</option>${cards.map(v=>`<option value="${v.id}" ${filters.cardId===v.id?'selected':''}>${U.escape(v.name)}</option>`).join('')}</select></div><div class="field"><label>Категория</label><select data-filter="categoryId"><option value="">Все</option>${categories.map(v=>`<option value="${v.id}" ${filters.categoryId===v.id?'selected':''}>${U.escape(v.name)}</option>`).join('')}</select></div><div class="field"><label>Место</label><select data-filter="merchant"><option value="">Все</option>${merchants.map(v=>`<option value="${U.escape(v)}" ${filters.merchant===v?'selected':''}>${U.escape(v)}</option>`).join('')}</select></div></div></div>`:'';
    host.innerHTML=`<div class="history-toolbar"><button class="history-filter-toggle ${activeFilterCount?'active':''}" id="toggleHistoryFilters">⚙ Фильтры${activeFilterCount?` · ${activeFilterCount}`:''}</button>${activeFilterCount&&!state.historyFiltersOpen?'<button class="history-reset-inline" id="clearHistoryFiltersInline">Сбросить</button>':''}</div>${filterPanel}${filtered.length?Object.entries(groups).map(([date,items])=>`<div class="history-group"><h4>${date}</h4>${items.map(t=>{const c=p.categories.find(x=>x.id===t.categoryId)||{name:'Удалённая категория',icon:'•'};const card=p.cards.find(x=>x.id===t.cardId);const subtitle=[t.merchant||'Без места',card?.name||'',new Date(t.datetime).toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'}),t.note?'заметка':''].filter(Boolean).join(' · ');return `<button class="tx-row" data-tx="${t.id}"><span class="tx-icon">${categoryIcon(c.icon,'history-icon')}</span><span class="tx-main"><b>${U.escape(c.name)}</b><span>${U.escape(subtitle)}</span></span><span class="tx-amount ${t.type==='income'?'income':''}">${t.type==='income'?'+':'−'}${U.money(t.amount)}</span></button>`}).join('')}</div>`).join(''):'<div class="empty">Под эти фильтры ничего не найдено.</div>'}`;
    host.querySelector('#toggleHistoryFilters').onclick=()=>{state.historyFiltersOpen=!state.historyFiltersOpen;renderHistory()};
    host.querySelectorAll('[data-filter]').forEach(el=>el.onchange=()=>{filters[el.dataset.filter]=el.value;renderHistory()});
    const reset=()=>{state.historyFilters={year:'',month:'',day:'',cardId:'',categoryId:'',merchant:''};renderHistory()};
    const clear=host.querySelector('#clearHistoryFilters');if(clear)clear.onclick=reset;
    const inline=host.querySelector('#clearHistoryFiltersInline');if(inline)inline.onclick=reset;
    const close=host.querySelector('#closeHistoryFilters');if(close)close.onclick=()=>{state.historyFiltersOpen=false;renderHistory()};
    host.querySelectorAll('[data-tx]').forEach(b=>b.onclick=()=>openTransactionEditor(b.dataset.tx));
  }
  function openTransactionEditor(id){
    const p=getP(),t=p.transactions.find(x=>x.id===id);if(!t)return;const c=p.categories.find(x=>x.id===t.categoryId);const d=new Date(t.datetime);
    modal(`<h3>${c?.icon||'•'} ${U.escape(c?.name||'Операция')}</h3><div class="field"><label>Сумма</label><input id="editAmount" type="number" inputmode="decimal" value="${t.amount}"></div><div class="field"><label>Место / источник</label><input id="editMerchant" value="${U.escape(t.merchant||'')}"></div><div class="field"><label>Карта</label><select id="editCard">${p.cards.map(x=>`<option value="${x.id}" ${x.id===t.cardId?'selected':''}>${U.escape(x.name)}</option>`).join('')}</select></div><div class="datetime-grid"><div class="field"><label>Дата</label><input id="editDate" type="date" value="${U.dateISO(d)}"></div><div class="field"><label>Время</label><input id="editTime" type="time" value="${U.timeHM(d)}"></div></div><div class="field"><label>Заметка</label><textarea id="editNote" rows="5">${U.escape(t.note||'')}</textarea></div>${t.note?'<button class="btn ghost full" id="openNote">Открыть как документ</button>':''}<div class="row action-row" style="margin-top:10px"><button class="btn danger" id="deleteTx">Удалить</button><button class="btn primary" style="flex:1" id="saveTx">Сохранить</button></div>`,{onOpen:m=>{m.querySelector('#saveTx').onclick=()=>{const amount=Number(m.querySelector('#editAmount').value||0);if(!(amount>0))return toast('Сумма должна быть больше нуля');const dt=new Date(`${m.querySelector('#editDate').value}T${m.querySelector('#editTime').value||'12:00'}`);S.mutate(profile=>{const target=profile.transactions.find(x=>x.id===id);if(target)Object.assign(target,{amount,merchant:m.querySelector('#editMerchant').value.trim(),cardId:m.querySelector('#editCard').value,note:m.querySelector('#editNote').value,datetime:dt.toISOString()});});closeModal();renderHistory();toast('Операция изменена')};m.querySelector('#deleteTx').onclick=()=>confirmAction({title:'Удалить операцию?',text:`${t.amount} ₽${t.merchant?' · '+t.merchant:''}`,onConfirm:()=>{if(!S.deleteTransaction(id))return toast('Операция уже удалена');closeModal();renderHistory();toast('Операция удалена');}});const n=m.querySelector('#openNote');if(n)n.onclick=()=>modal(`<h3>Заметка</h3><div class="note-doc">${U.escape(t.note)}</div><button class="btn ghost full" id="closeNote" style="margin-top:12px">Закрыть</button>`,{onOpen:x=>x.querySelector('#closeNote').onclick=closeModal});}});
  }
  function renderSettings(){
    const p=getP(),storage=S.storageStatus();setTitle('Ещё');
    const savedGroups=p.categories.map(c=>({category:c,names:p.merchantsByCategory?.[c.id]||[]})).filter(x=>x.names.length);
    const savedHtml=savedGroups.length?`<div class="saved-place-groups">${savedGroups.map(g=>`<div class="saved-place-group"><h5>${U.escape(g.category.name)}</h5><div class="chips">${g.names.map(name=>`<button class="chip" data-saved-merchant="${U.escape(name)}" data-saved-category="${g.category.id}">${U.escape(name)} ×</button>`).join('')}</div></div>`).join('')}</div>`:'<span class="muted tiny">Пока пусто</span>';
    document.getElementById('pageHost').innerHTML=`<div class="panel"><h3 style="margin-top:0">${U.escape(p.name)}</h3><p class="muted tiny">Профиль создан ${new Date(p.createdAt).toLocaleDateString('ru-RU')}</p></div><div class="panel"><div class="row between"><div><b>Сохранение данных</b><div class="tiny muted">${U.escape(storage.mode)}</div></div><b class="${storage.risk?'status-warn':'status-good'}">${storage.risk?'есть риск':'включено'}</b></div>${storage.risk?'<div class="tiny muted" style="margin-top:10px;line-height:1.45">При запуске как локального файла iPhone может очищать web-хранилище после закрытия. JSON-резервная копия остаётся самым надёжным переносом данных.</div>':''}</div><div class="panel"><div class="row between"><div><b>Face ID / биометрия</b><div class="tiny muted" id="bioStatus">Проверяю доступность…</div></div><button class="switch ${p.settings.biometrics?'on':''}" id="bioToggle"><i></i></button></div></div><div class="panel stack"><button class="btn ghost" id="exportData">Поделиться резервной копией JSON</button><label class="btn ghost" style="text-align:center">Восстановить профиль из JSON<input id="importData" type="file" accept="application/json" hidden></label><button class="btn ghost" id="switchProfile">Сменить профиль</button></div><div class="panel stack danger-zone"><div><b>Удаление профиля</b><div class="tiny muted" style="margin-top:5px;line-height:1.45">Будут удалены карты, категории, история, бюджеты и настройки этого профиля. Вернуть их можно только из ранее сохранённого JSON.</div></div><button class="btn danger full" id="deleteProfile">Удалить профиль</button></div><div class="panel"><h4>Сохранённые места</h4>${savedHtml}</div>`;
    const host=document.getElementById('pageHost');
    const bioStatusEl=host.querySelector('#bioStatus');
    FinAuth.biometricStatus().then(status=>{if(!bioStatusEl)return;bioStatusEl.textContent=status.available?(p.settings.biometrics?'Face ID / биометрия включены':'Доступно на этом устройстве'):(status.reason==='secure-context'?'Нужен HTTPS/localhost для Face ID':'В этом режиме Face ID недоступен');}).catch(()=>{});
    host.querySelector('#bioToggle').onclick=async()=>{try{if(p.settings.biometrics){S.mutate(x=>{x.settings.biometrics=false;x.biometricCredentialId=null});toast('Face ID / биометрия отключены');renderSettings()}else{await FinAuth.registerBiometric(p);toast('Face ID / биометрия включены');renderSettings()}}catch(e){toast(e.message)}};
    host.querySelector('#exportData').onclick=async()=>{
      const btn=host.querySelector('#exportData');
      const original=btn.textContent;btn.disabled=true;btn.textContent='Готовлю файл…';
      try{
        const d=new Date(),z=n=>String(n).padStart(2,'0');
        const filename=`koshelek-backup-${d.getFullYear()}-${z(d.getMonth()+1)}-${z(d.getDate())}.json`;
        const method=await U.shareFile(filename,S.export(),'application/json');
        if(method==='download')toast('Файл открыт для сохранения в «Файлы»');
      }catch(e){if(e?.name!=='AbortError'){console.error(e);toast('Не удалось создать резервную копию')}}
      finally{btn.disabled=false;btn.textContent=original;}
    };
    host.querySelector('#importData').onchange=e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{try{const restored=S.restoreProfiles(r.result);toast(restored.length===1?'Профиль восстановлен':`Восстановлено профилей: ${restored.length}`);window.FinApp.showAuth()}catch(err){console.error(err);toast('Не удалось восстановить профиль')}};r.readAsText(f)};
    host.querySelector('#switchProfile').onclick=()=>window.FinApp.showAuth();
    host.querySelector('#deleteProfile').onclick=()=>confirmAction({title:'Удалить профиль?',text:`Профиль «${p.name}» и все его данные будут удалены без возможности отмены.`,confirmText:'Да, удалить',onConfirm:()=>{const id=p.id;S.deleteProfile(id);closeModal();toast('Профиль удалён');window.FinApp.showAuth();}});
    host.querySelectorAll('[data-saved-merchant]').forEach(b=>b.onclick=()=>{const name=b.dataset.savedMerchant,categoryId=b.dataset.savedCategory;confirmAction({title:'Удалить сохранённое место?',text:`«${name}» больше не будет закреплено в этой категории. История операций останется.`,onConfirm:()=>{S.deleteMerchant(name,categoryId);renderSettings();toast('Место удалено')}})});
  }
  function renderPage(page=state.page){state.page=page;document.querySelectorAll('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.page===page));({home:renderHome,stats:renderStats,history:renderHistory,settings:renderSettings}[page]||renderHome)();}
  window.FinUI={state,renderPage,toast,closeModal,modal,confirmAction};
})();
