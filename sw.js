const CACHE_NAME='webhometv-site-list-v1.4.0';
const APP_SHELL=['./','./index.html','./manifest.webmanifest','./icons/icon.svg'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE_NAME).then(c=>c.addAll(APP_SHELL)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{const r=e.request;if(r.method!=='GET')return;const u=new URL(r.url),s=new URL(self.registration.scope);
if(u.origin!==s.origin||!u.pathname.startsWith(s.pathname))return;
e.respondWith(fetch(r).then(res=>{if(res.ok&&(r.mode==='navigate'||/\\.(html|webmanifest|svg)$/.test(u.pathname))){const copy=res.clone();caches.open(CACHE_NAME).then(c=>c.put(r,copy));}return res;}).catch(async()=>{const cached=await caches.match(r);if(cached)return cached;if(r.mode==='navigate')return(await caches.match('./index.html'))||Response.error();return Response.error();}));});
