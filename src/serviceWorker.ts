export const serviceWorkerCachePrefix = 'light-pos-shell-';

export type ServiceWorkerConfig = { base: string; version: string; assets: string[] };

export function buildServiceWorker({ base, version, assets }: ServiceWorkerConfig): string {
  const cacheName = `${serviceWorkerCachePrefix}${version}`;
  const precache = [base, ...assets.map((asset) => `${base}${asset}`)];
  return [
    `const BASE=${JSON.stringify(base)},CACHE=${JSON.stringify(cacheName)},PRECACHE=${JSON.stringify(precache)};`,
    `self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(PRECACHE)).then(()=>self.skipWaiting())));`,
    `self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith(${JSON.stringify(serviceWorkerCachePrefix)})&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));`,
    `self.addEventListener('fetch',event=>{const url=new URL(event.request.url);if(event.request.method!=='GET'||url.origin!==self.location.origin||url.pathname.startsWith(BASE+'api/'))return;const asset=url.pathname.startsWith(BASE+'assets/')&&(url.pathname.endsWith('.js')||url.pathname.endsWith('.css'));if(!asset&&event.request.mode==='navigate'){event.respondWith(fetch(event.request).then(response=>{if(response.ok)caches.open(CACHE).then(cache=>cache.put(BASE,response.clone()));return response}).catch(()=>caches.match(BASE)));return}if(asset){event.respondWith(caches.match(event.request).then(hit=>hit||fetch(event.request).then(response=>{if(response.ok)caches.open(CACHE).then(cache=>cache.put(event.request,response.clone()));return response})))}});`,
  ].join('\n');
}