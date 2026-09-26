(function(){
  const S=FinStore;
  const pending=new Map();
  let seq=0;

  window.MonetaNativeReply=(id,payload)=>{
    const p=pending.get(id); if(!p)return;
    pending.delete(id); p(payload);
  };

  const nativeCall=action=>new Promise(resolve=>{
    if(!window.webkit?.messageHandlers?.monetaNative)return resolve({ok:false,available:false,error:'native-unavailable'});
    const requestId='bio_'+Date.now()+'_'+(++seq);
    pending.set(requestId,resolve);
    window.webkit.messageHandlers.monetaNative.postMessage({action,requestId});
    setTimeout(()=>{if(pending.has(requestId)){pending.delete(requestId);resolve({ok:false,available:false,error:'timeout'})}},65000);
  });

  const biometricStatus=async()=>{
    const r=await nativeCall('biometricStatus');
    return {available:!!(r.ok&&r.available),reason:r.ok&&r.available?null:'platform'};
  };
  const biometricAvailable=async()=> (await biometricStatus()).available;

  const registerBiometric=async(profile)=>{
    const status=await biometricStatus();
    if(!status.available)throw new Error('Face ID сейчас недоступен на этом iPhone');
    const r=await nativeCall('authenticateBiometric');
    if(!r.ok)throw new Error(r.error||'Не удалось включить Face ID');
    S.mutate(p=>{p.settings.biometrics=true;});
    return true;
  };

  const authenticateBiometric=async(profile)=>{
    if(!profile?.settings?.biometrics)throw new Error('Face ID не включён для этого профиля');
    const r=await nativeCall('authenticateBiometric');
    if(!r.ok)throw new Error(r.error||'Не удалось войти через Face ID');
    return true;
  };

  window.FinAuth={biometricAvailable,biometricStatus,registerBiometric,authenticateBiometric};
})();
