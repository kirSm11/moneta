(function(){
  const U=window.FinUtils;
  const KEY='finapp_db_v1'; // keep the old key so v1.x data migrates automatically
  const IDB_NAME='koshelek_finance_storage';
  const IDB_STORE='app_state';
  const IDB_VERSION=1;

  const defaultDB=()=>({version:2,profiles:[],activeProfileId:null,revision:0,updatedAt:null});
  let db=defaultDB();
  let memoryRaw=null;
  let localAvailable=false;
  let idbAvailable=false;
  let idbHandle=null;
  let writeQueue=Promise.resolve();

  const clone=x=>JSON.parse(JSON.stringify(x));
  const normText=v=>String(v||'').trim().toLocaleLowerCase('ru-RU');
  const pushUnique=(arr,value)=>{if(!value)return;const key=normText(value);if(!arr.some(x=>normText(x)===key))arr.push(value)};
  const ensureProfileShape=p=>{
    p.cards ||= [];
    p.categories ||= [];
    p.transactions ||= [];
    p.merchants ||= []; // legacy global saved places
    p.merchantsByCategory ||= {};
    p.settings ||= {biometrics:false};
    if(typeof p.settings.biometrics!=='boolean')p.settings.biometrics=false;
    if(!p.cards.some(c=>c.id===p.settings.activeCardId))p.settings.activeCardId=p.cards[0]?.id||null;
    // One-time migration of old globally saved places. We infer categories from history,
    // so old saved "Пятёрочка" stops appearing in unrelated categories.
    if(!p.settings.merchantCategoryMigrationV1){
      for(const name of p.merchants){
        const cats=[...new Set(p.transactions.filter(t=>t.categoryId&&normText(t.merchant)===normText(name)).map(t=>t.categoryId))];
        for(const categoryId of cats){
          const list=p.merchantsByCategory[categoryId] ||= [];
          pushUnique(list,name);
        }
      }
      p.settings.merchantCategoryMigrationV1=true;
    }
    for(const key of Object.keys(p.merchantsByCategory)){
      if(!Array.isArray(p.merchantsByCategory[key]))p.merchantsByCategory[key]=[];
    }
    return p;
  };
  const ensureDBShape=value=>{
    const next=value&&typeof value==='object'?value:defaultDB();
    next.version=Math.max(2,Number(next.version)||1);
    next.profiles=Array.isArray(next.profiles)?next.profiles:[];
    next.profiles.forEach(ensureProfileShape);
    next.activeProfileId=next.activeProfileId||null;
    next.revision=Number(next.revision)||0;
    next.updatedAt=next.updatedAt||null;
    return next;
  };
  const parseRaw=raw=>{
    if(!raw)return null;
    try{return ensureDBShape(JSON.parse(raw));}catch{return null;}
  };

  const localGet=()=>{
    try{
      const s=window.localStorage;
      const probe='__koshelek_storage_probe__';
      s.setItem(probe,'1');
      if(s.getItem(probe)!=='1')throw new Error('localStorage readback failed');
      s.removeItem(probe);
      localAvailable=true;
      return s.getItem(KEY);
    }catch(e){
      localAvailable=false;
      return memoryRaw;
    }
  };
  const localSet=raw=>{
    memoryRaw=raw;
    try{
      const s=window.localStorage;
      s.setItem(KEY,raw);
      localAvailable=s.getItem(KEY)===raw;
      return localAvailable;
    }catch(e){
      localAvailable=false;
      return false;
    }
  };

  const openIDB=()=>new Promise(resolve=>{
    if(!('indexedDB' in window)){idbAvailable=false;return resolve(null);}
    let req;
    try{req=indexedDB.open(IDB_NAME,IDB_VERSION);}catch(e){idbAvailable=false;return resolve(null);}
    req.onupgradeneeded=()=>{
      const d=req.result;
      if(!d.objectStoreNames.contains(IDB_STORE))d.createObjectStore(IDB_STORE);
    };
    req.onsuccess=()=>{idbHandle=req.result;idbAvailable=true;resolve(idbHandle);};
    req.onerror=()=>{idbAvailable=false;resolve(null);};
    req.onblocked=()=>{idbAvailable=false;resolve(null);};
  });
  const idbGet=(handle,key)=>new Promise(resolve=>{
    if(!handle)return resolve(null);
    try{
      const tx=handle.transaction(IDB_STORE,'readonly');
      const req=tx.objectStore(IDB_STORE).get(key);
      req.onsuccess=()=>resolve(req.result||null);
      req.onerror=()=>resolve(null);
    }catch(e){resolve(null);}
  });
  const idbSet=(handle,key,value)=>new Promise(resolve=>{
    if(!handle)return resolve(false);
    try{
      const tx=handle.transaction(IDB_STORE,'readwrite');
      tx.objectStore(IDB_STORE).put(value,key);
      tx.oncomplete=()=>{idbAvailable=true;resolve(true);};
      tx.onerror=()=>{idbAvailable=false;resolve(false);};
      tx.onabort=()=>{idbAvailable=false;resolve(false);};
    }catch(e){idbAvailable=false;resolve(false);}
  });

  const candidateTime=x=>{
    const t=Date.parse(x?.updatedAt||'');
    return Number.isFinite(t)?t:0;
  };
  const chooseNewest=(a,b)=>{
    if(!a)return b||defaultDB();
    if(!b)return a;
    const ar=Number(a.revision)||0, br=Number(b.revision)||0;
    if(ar!==br)return ar>br?a:b;
    const at=candidateTime(a), bt=candidateTime(b);
    if(at!==bt)return at>bt?a:b;
    const ac=a.profiles?.length||0, bc=b.profiles?.length||0;
    return bc>ac?b:a;
  };

  // Load the synchronous backup first so legacy v1.x data is never ignored.
  db=parseRaw(localGet())||defaultDB();

  const queueIDBWrite=raw=>{
    writeQueue=writeQueue
      .catch(()=>{})
      .then(async()=>{
        const handle=idbHandle||await openIDB();
        if(!handle)return false;
        return idbSet(handle,KEY,raw);
      });
    return writeQueue;
  };

  const save=(touch=true)=>{
    db=ensureDBShape(db);
    if(touch){
      db.revision=(Number(db.revision)||0)+1;
      db.updatedAt=new Date().toISOString();
    }
    const raw=JSON.stringify(db);
    localSet(raw);
    queueIDBWrite(raw);
    return localAvailable||idbAvailable;
  };

  const ready=(async()=>{
    const handle=await openIDB();
    const fromIDB=parseRaw(await idbGet(handle,KEY));
    const fromLocal=parseRaw(localGet());
    db=ensureDBShape(chooseNewest(fromLocal,fromIDB));
    const raw=JSON.stringify(db);
    localSet(raw);
    if(handle)await idbSet(handle,KEY,raw);
    return db;
  })();

  const flush=async()=>{await ready;await writeQueue.catch(()=>{});};
  const requestPersistence=async()=>{
    try{
      if(navigator.storage?.persist){
        const granted=await navigator.storage.persist();
        return !!granted;
      }
    }catch{}
    return false;
  };
  const storageStatus=()=>({
    localStorage:localAvailable,
    indexedDB:idbAvailable,
    protocol:location.protocol,
    risk:(!localAvailable&&!idbAvailable)||location.protocol==='file:',
    mode:idbAvailable&&localAvailable?'IndexedDB + резервная копия':idbAvailable?'IndexedDB':localAvailable?'localStorage':'только память'
  });

  const getProfile=(id=db.activeProfileId)=>db.profiles.find(p=>p.id===id)||null;

  const createProfile=async(name,pin)=>{
    await ready;
    if(!/^\d{5}$/.test(String(pin||'')))throw new Error('PIN должен состоять ровно из 5 цифр');
    const salt=U.id('salt');
    const hash=await U.hashPin(pin,salt);
    const now=new Date().toISOString();
    const p=ensureProfileShape({
      id:U.id('profile'),
      name:(name||'Профиль').trim()||'Профиль',
      pinSalt:salt,
      pinHash:hash,
      createdAt:now,
      lastUsedAt:now
    });
    const firstCard={id:U.id('card'),name:'Основная карта',bank:'Своя карта',theme:'mustard',color:'#d8a72e',textColor:'#111111',texture:null};
    p.cards.push(firstCard);
    p.settings.activeCardId=firstCard.id;
    p.categories.push(
      {id:U.id('cat'),name:'Продукты',type:'expense',icon:'cart',budget:15000,createdAt:now},
      {id:U.id('cat'),name:'Транспорт',type:'expense',icon:'taxi',budget:5000,createdAt:now},
      {id:U.id('cat'),name:'Зарплата',type:'income',icon:'work',budget:0,createdAt:now}
    );
    db.profiles.push(p);
    db.activeProfileId=p.id;
    save();
    await flush(); // profile creation must be durable before we enter the app
    return p;
  };

  const verifyPin=async(profile,pin)=>!!profile&&(await U.hashPin(pin,profile.pinSalt))===profile.pinHash;
  const mutate=fn=>{
    const p=getProfile();
    if(!p)return null;
    const r=fn(p);
    save();
    return r;
  };
  const deleteTransaction=id=>{let removed=false;mutate(p=>{const before=p.transactions.length;p.transactions=p.transactions.filter(t=>t.id!==id);removed=p.transactions.length<before;});return removed;};
  const deleteCategory=id=>{let removed=false;mutate(p=>{const before=p.categories.length;p.categories=p.categories.filter(c=>c.id!==id);p.transactions=p.transactions.filter(t=>t.categoryId!==id);if(p.merchantsByCategory)delete p.merchantsByCategory[id];removed=p.categories.length<before;});return removed;};
  const saveMerchant=(categoryId,name)=>{let saved=false;mutate(p=>{if(!categoryId||!name)return;p.merchantsByCategory ||= {};const list=p.merchantsByCategory[categoryId] ||= [];const before=list.length;pushUnique(list,name.trim());saved=list.length>before;});return saved;};
  const deleteMerchant=(name,categoryId=null)=>{let removed=false;mutate(p=>{
    if(categoryId){const list=p.merchantsByCategory?.[categoryId]||[];const before=list.length;p.merchantsByCategory[categoryId]=list.filter(m=>normText(m)!==normText(name));removed=p.merchantsByCategory[categoryId].length<before;return;}
    const before=p.merchants.length;p.merchants=p.merchants.filter(m=>normText(m)!==normText(name));removed=p.merchants.length<before;
    for(const key of Object.keys(p.merchantsByCategory||{}))p.merchantsByCategory[key]=p.merchantsByCategory[key].filter(m=>normText(m)!==normText(name));
  });return removed;};
  const deleteCard=id=>{let removed=false;mutate(p=>{if(p.cards.length<=1)return;const idx=p.cards.findIndex(c=>c.id===id);if(idx<0)return;p.cards.splice(idx,1);const fallback=p.cards[0]?.id||null;p.transactions.forEach(t=>{if(t.cardId===id)t.cardId=fallback;});p.settings||={biometrics:false};if(p.settings.activeCardId===id||!p.cards.some(c=>c.id===p.settings.activeCardId))p.settings.activeCardId=fallback;removed=true;});return removed;};

  const restoreProfiles=json=>{
    const parsed=typeof json==='string'?JSON.parse(json):json;
    let candidates=[];
    if(Array.isArray(parsed?.profiles))candidates=parsed.profiles;
    else if(parsed?.profile&&typeof parsed.profile==='object')candidates=[parsed.profile];
    else if(parsed&&typeof parsed==='object'&&(parsed.pinHash||parsed.cards||parsed.transactions))candidates=[parsed];
    candidates=candidates.filter(x=>x&&typeof x==='object');
    if(!candidates.length)throw new Error('В JSON нет данных профиля');
    for(const src of candidates){
      if(!src.pinHash||!src.pinSalt)throw new Error(`У профиля «${src.name||'без имени'}» нет данных PIN`);
    }
    const restored=[];
    for(const src of candidates){
      const p=ensureProfileShape(clone(src));
      if(db.profiles.some(x=>x.id===p.id)||restored.some(x=>x.id===p.id))p.id=U.id('profile');
      p.name=(p.name||'Восстановленный профиль').trim()||'Восстановленный профиль';
      p.restoredAt=new Date().toISOString();
      db.profiles.push(p);
      restored.push(p);
    }
    db.activeProfileId=restored[0].id;
    save();
    return restored;
  };

  const api={
    get db(){return db;},
    ready,
    save,
    flush,
    getProfile,
    createProfile,
    verifyPin,
    mutate,
    deleteTransaction,
    deleteCategory,
    saveMerchant,
    deleteMerchant,
    deleteCard,
    requestPersistence,
    storageStatus,
    isPersistent:()=>localAvailable||idbAvailable,
    setActive:id=>{
      db.activeProfileId=id;
      const p=db.profiles.find(x=>x.id===id);
      if(p)p.lastUsedAt=new Date().toISOString();
      save();
    },
    deleteProfile:id=>{
      db.profiles=db.profiles.filter(p=>p.id!==id);
      if(db.activeProfileId===id)db.activeProfileId=db.profiles[0]?.id||null;
      save();
    },
    export:()=>JSON.stringify(db,null,2),
    restoreProfiles,
    import:json=>{
      const next=ensureDBShape(JSON.parse(json));
      if(!Array.isArray(next.profiles))throw new Error('Неверный формат');
      db=next;
      save();
      return db;
    }
  };
  window.FinStore=api;

  // Save before iOS/Safari freezes or closes the page.
  const lifecycleSave=()=>{save(false);void flush();};
  window.addEventListener('pagehide',lifecycleSave,{capture:true});
  window.addEventListener('beforeunload',lifecycleSave,{capture:true});
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')lifecycleSave();});
  document.addEventListener('freeze',lifecycleSave);
})();
