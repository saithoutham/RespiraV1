const CACHE_NAME = 'respira-shell-v18';
const ASSETS = [
  '/',
  '/index.html',
  '/respira.html',
  '/404.html',
  '/sw.js',
  '/public/respira-launch.css',
  '/public/respira-local-config.js',
  '/public/respira-launch.js',
  '/public/vendor/chart.umd.min.js',
  '/public/vendor/jspdf.umd.min.js',
  '/public/vendor/jszip.min.js',
  '/public/vendor/meyda.min.js',
  '/public/vendor/ort.min.js',
  '/public/vendor/ort-wasm-simd-threaded.jsep.mjs',
  '/public/vendor/ort-wasm-simd-threaded.jsep.wasm',
  '/public/vendor/pdf.min.js',
  '/public/vendor/pdf.worker.min.js',
  '/public/models/recurvoice/classifier.onnx',
  '/public/models/recurvoice/classifier.onnx.data',
  '/public/models/recurvoice/feature_columns.json',
  '/public/models/recurvoice/median_values.json',
  '/public/models/recurvoice/cusum_params.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const networkFetch = fetch(event.request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone)).catch(() => null);
          return response;
        })
        .catch(() => cached);

      return cached || networkFetch;
    })
  );
});
