// Service worker do Finanças.
//
// Estratégia: "rede primeiro". Com internet, cada arquivo é buscado de novo e a
// cópia guardada é atualizada na hora; sem internet, a última cópia é usada.
// Por isso o nome do cache não precisa mais ser trocado a cada versão: ele só
// muda se a estrutura do cache mudar. Caches antigos (financas-v1…v66) são
// apagados na ativação.
//
// Ao adicionar um arquivo que o app precisa para abrir, inclua-o em FILES.
// A verificação do GitHub (scripts/check-app.mjs) falha se faltar algum.
const CACHE='financas-app';
const FILES=[
  './',
  'index.html',
  'style.css',
  'app.js',
  'auth.js',
  'seed.js',
  'manifest.webmanifest',
  'icon.svg',
  'vendor/supabase-js-2.119.0.min.js',
  'assets/bancos/Fonte-Bancos-Brasileiros.woff',
  'assets/fonts/poppins/poppins-latin-300-normal.woff2',
  'assets/fonts/poppins/poppins-latin-400-normal.woff2',
  'assets/fonts/poppins/poppins-latin-500-normal.woff2',
  'assets/fonts/poppins/poppins-latin-600-normal.woff2',
  'assets/fonts/poppins/poppins-latin-700-normal.woff2',
  'assets/fonts/poppins/poppins-latin-800-normal.woff2'
];
self.addEventListener('install',event=>event.waitUntil(
  caches.open(CACHE)
    .then(cache=>cache.addAll(FILES.map(file=>new Request(file,{cache:'reload'}))))
    .then(()=>self.skipWaiting())
));
self.addEventListener('activate',event=>event.waitUntil(
  caches.keys()
    .then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key))))
    .then(()=>self.clients.claim())
));
self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET')return;
  const url=new URL(request.url);
  if(url.origin!==self.location.origin)return;
  event.respondWith(
    fetch(new Request(request,{cache:'no-store'}))
      .then(response=>{
        if(response.ok){
          const copy=response.clone();
          caches.open(CACHE).then(cache=>cache.put(request,copy));
        }
        return response;
      })
      .catch(()=>caches.match(request,{ignoreSearch:true}).then(cached=>cached||(request.mode==='navigate'?caches.match('index.html'):null)).then(cached=>cached||Response.error()))
  );
});
