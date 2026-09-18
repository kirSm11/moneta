(function(){
  const U=FinUtils, S=FinStore;
  const biometricStatus=async()=>{
    if(!window.isSecureContext)return {available:false,reason:'secure-context'};
    if(!window.PublicKeyCredential || !PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable)return {available:false,reason:'webauthn'};
    try{
      const available=await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
      return {available:!!available,reason:available?null:'platform'};
    }catch{return {available:false,reason:'platform'};}
  };
  const biometricAvailable=async()=> (await biometricStatus()).available;
  const biometricError=status=>{
    if(status.reason==='secure-context')return 'Face ID на iPhone можно включить, но этот экран открыт не через HTTPS/localhost. В локальном file:// или временном предпросмотрщике iOS блокирует WebAuthn.';
    if(status.reason==='webauthn')return 'Этот режим браузера не поддерживает системную биометрию. Открой приложение в Safari через HTTPS или установи как PWA.';
    return 'Системная биометрия сейчас недоступна. Проверь, что на iPhone настроены Face ID и код-пароль.';
  };
  const registerBiometric=async(profile)=>{
    const status=await biometricStatus();
    if(!status.available)throw new Error(biometricError(status));
    const challenge=crypto.getRandomValues(new Uint8Array(32)); const userId=crypto.getRandomValues(new Uint8Array(16));
    const cred=await navigator.credentials.create({publicKey:{challenge,rp:{name:'Кошелёк'},user:{id:userId,name:profile.id,displayName:profile.name},pubKeyCredParams:[{type:'public-key',alg:-7},{type:'public-key',alg:-257}],authenticatorSelection:{authenticatorAttachment:'platform',userVerification:'required'},timeout:60000,attestation:'none'}});
    if(!cred)throw new Error('Не удалось включить Face ID / биометрию');
    S.mutate(p=>{p.biometricCredentialId=U.toBase64Url(new Uint8Array(cred.rawId));p.settings.biometrics=true;});
    return true;
  };
  const authenticateBiometric=async(profile)=>{
    if(!profile?.biometricCredentialId)throw new Error('Face ID / биометрия ещё не настроены');
    const status=await biometricStatus();
    if(!status.available)throw new Error(biometricError(status));
    const challenge=crypto.getRandomValues(new Uint8Array(32));
    const result=await navigator.credentials.get({publicKey:{challenge,allowCredentials:[{type:'public-key',id:U.fromBase64Url(profile.biometricCredentialId)}],userVerification:'required',timeout:60000}});
    return !!result;
  };
  window.FinAuth={biometricAvailable,biometricStatus,registerBiometric,authenticateBiometric};
})();
