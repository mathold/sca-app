/* service worker — ให้ใช้งานออฟไลน์ได้หลังเปิดครั้งแรก
 *
 * สำคัญ: ทุกครั้งที่แก้ไฟล์ในแอพ ต้องเปลี่ยนเลข CACHE ข้างล่างด้วย
 * ไม่งั้นเครื่องที่เคยเปิดแล้วจะยังใช้ไฟล์เก่าค้างอยู่
 */
const CACHE = 'sca-v12';
const ASSETS = [
  './', './index.html', './manifest.webmanifest',
  './vendor/xlsx.full.min.js',
  './src/ortho_calc.js', './src/analyze.js', './src/sca_xlsx.js', './src/report.js',
  './icons/icon-192.png', './icons/icon-512.png', './icons/icon-180.png',
];

// ดึงจากเซิร์ฟเวอร์ตรง ๆ (cache:'reload') ไม่งั้นอาจได้ไฟล์เก่าจาก HTTP cache มาเก็บซ้ำ
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(ASSETS.map(u => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// cache-first สำหรับไฟล์ของแอพ · ไม่แตะคำขออื่น และไม่เก็บ URL ที่มี query string
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (url.search) return;
  e.respondWith(
    caches.match(e.request).then(hit => hit || fetch(e.request).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
      return res;
    }).catch(() => caches.match('./index.html')))
  );
});
