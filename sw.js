/* service worker — ให้ใช้งานออฟไลน์ได้หลังเปิดครั้งแรก
 *
 * network-first: ออนไลน์ = ได้ไฟล์ล่าสุดเสมอ · ออฟไลน์ = ใช้ของที่แคชไว้
 *
 * เดิมเป็น cache-first แล้วต้องไล่เปลี่ยนเลข CACHE เองทุกครั้งที่ deploy
 * ถ้าลืม เบราว์เซอร์จะเห็น sw.js เหมือนเดิมทุกไบต์ -> ไม่อัปเดตอะไรเลย
 * เครื่องที่เคยเปิดแล้วจึงค้างของเก่าถาวร (ที่มาของการต้องพิมพ์ ?v=NN ต่อท้ายลิงก์)
 *
 * VERSION ด้านล่าง tools/bump.py แก้ให้อัตโนมัติ — ไม่ต้องแก้มือ
 */
const VERSION = '50';
const CACHE = 'sca-v' + VERSION;
const ASSETS = [
  './', './index.html', './manifest.webmanifest',
  './vendor/xlsx.full.min.js',
  './src/ortho_calc.js', './src/analyze.js', './src/sca_xlsx.js', './src/report.js',
  './src/plan_sheets.js',
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

// network-first สำหรับไฟล์ของแอพ · ไม่แตะคำขออื่น และไม่เก็บ URL ที่มี query string
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (url.search) return;
  // cache:'no-cache' = ถามเซิร์ฟเวอร์ทุกครั้งว่าไฟล์เปลี่ยนไหม (ได้ 304 ถ้าเหมือนเดิม จึงยังเร็ว)
  // ถ้าไม่ใส่ fetch() จะหยิบจากแคช HTTP ของเบราว์เซอร์ได้ — GitHub Pages ตั้ง max-age=600
  // ทำให้ยังเห็นของเก่าได้ถึง 10 นาทีทั้งที่ตั้งใจให้เป็น network-first
  e.respondWith(
    fetch(e.request, { cache: 'no-cache' })
      .then(res => {
        // เก็บเฉพาะที่โหลดสำเร็จจริง ไม่งั้นหน้า error จะถูกแคชแทนของดี
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(e.request).then(hit => hit || caches.match('./index.html')))
  );
});
