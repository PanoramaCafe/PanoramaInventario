const CACHE_NAME = 'panorama-cafe-inventario-v21-compras';

const APP_SHELL = [
  './','./index.html','./manifest.json','./icon-192.png','./icon-512.png','./icon-512-maskable.png',
  './js/01-storage.js','./js/02-render.js','./js/03-catalogo.js','./js/04-datos-excel-pwa.js','./js/05-stock-conteo.js',
  './js/06-recetas.js','./js/07-compras.js','./js/08-modal.js','./js/09-form-producto.js','./js/10-form-costo-ajuste.js',
  './js/11-form-cat-prov.js','./js/12-exportar-texto.js','./js/13-loza.js','./js/14-eventos.js','./js/15-sync-supabase.js'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(APP_SHELL)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE_NAME).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const request=event.request;if(request.method!=='GET')return;
  const url=new URL(request.url),same=url.origin===self.location.origin;
  if(same){
    event.respondWith(caches.match(request).then(cached=>{
      if(cached)return cached;
      return fetch(request).then(response=>{
        if(response&&response.ok){const copy=response.clone();caches.open(CACHE_NAME).then(cache=>cache.put(request,copy));}
        return response;
      }).catch(()=>request.mode==='navigate'?caches.match('./index.html'):Promise.reject(new Error('Recurso no disponible sin conexión')));
    }));return;
  }
  event.respondWith(fetch(request).then(response=>{
    if(response&&(response.ok||response.type==='opaque')){const copy=response.clone();caches.open(CACHE_NAME).then(cache=>cache.put(request,copy));}
    return response;
  }).catch(()=>caches.match(request)));
});
