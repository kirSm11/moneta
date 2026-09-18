const CACHE='koshelek-v12';
const FILES=["./", "./index.html", "./styles.css", "./js/utils.js", "./js/storage.js", "./js/auth.js", "./js/stats.js", "./js/ui.js", "./js/app.js", "./manifest.webmanifest", "./assets/icon.svg", "./assets/category-icons/cart.png", "./assets/category-icons/coffee.png", "./assets/category-icons/burger.png", "./assets/category-icons/home.png", "./assets/category-icons/taxi.png", "./assets/category-icons/takeaway.png", "./assets/category-icons/cinema.png", "./assets/category-icons/gamepad.png", "./assets/category-icons/medicine.png", "./assets/category-icons/clothes.png", "./assets/category-icons/travel.png", "./assets/category-icons/pets.png", "./assets/category-icons/gift.png", "./assets/category-icons/phone.png", "./assets/category-icons/receipt.png", "./assets/category-icons/work.png", "./assets/category-icons/income.png", "./assets/category-icons/growth.png", "./assets/category-icons/trophy.png", "./assets/category-icons/education.png", "./assets/category-icons/repair.png", "./assets/category-icons/heart.png", "./assets/category-icons/shopping.png", "./assets/category-icons/card.png"];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(
  caches.keys()
    .then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
    .then(()=>self.clients.claim())
    .then(()=>self.clients.matchAll({type:'window'}))
    .then(clients=>Promise.all(clients.map(c=>c.navigate(c.url).catch(()=>null))))
));
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  e.respondWith(fetch(e.request).then(res=>{
    if(res && res.ok && new URL(e.request.url).origin===self.location.origin){
      const copy=res.clone();caches.open(CACHE).then(c=>c.put(e.request,copy)).catch(()=>{});
    }
    return res;
  }).catch(()=>caches.match(e.request).then(r=>r||Response.error())));
});
