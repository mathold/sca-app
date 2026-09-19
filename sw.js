/* service worker — ให้ใช้งานออฟไลน์ได้หลังเปิดครั้งแรก */
const CACHE = 'sca-v9';
const ASSETS = [
  './', './index.html', './manifest.webmanifest',
  './vendor/xlsx.full.min.js',
  './src/ortho_calc.js', './src/analyze.js', './src/sca_xlsx.js', './src/report.js',
  './icons/icon-192.png', './icons/icon-512.png', './icons/icon-180.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// cache-first สำหรับไฟล์ของแอพ · ไม่แตะคำขออื่น
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;
  e.respondWith(
    caches.match(e.request).then(hit => hit || fetch(e.request).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
      return res;
    }).catch(() => caches.match('./index.html')))
  );
});
