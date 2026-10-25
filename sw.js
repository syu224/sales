// オフラインでも画面を開けるようにする仕組み（Service Worker）
// アプリのファイルを更新したら VERSION を上げること（端末の古い控えが入れ替わる）
const VERSION = 'v1.2.0';
const CACHE = `rentic-${VERSION}`;
const FILES = [
  './', './index.html', './styles.css', './manifest.webmanifest', './icons/icon.svg', './icons/icon-192.png',
  './js/app.js', './js/nav.js', './js/schema.js', './js/util.js', './js/db.js', './js/sync.js', './js/logic.js', './js/ui.js',
  './js/views/today.js', './js/views/calls.js', './js/views/deals.js', './js/views/progress.js', './js/views/search.js',
  './js/views/settings.js', './js/views/prospect.js', './js/views/prospectForm.js', './js/views/activityForm.js',
  './js/views/deal.js', './js/views/dealForm.js', './js/views/pick.js',
  './js/views/listTabs.js', './js/views/listCustomers.js', './js/views/listActivities.js',
];

self.addEventListener('install', (e) => {
  // GitHub Pages はファイルを10分間ブラウザに残すので、必ずサーバーから取り直す
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(FILES.map((f) => new Request(f, { cache: 'reload' }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('rentic-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return; // シートとのやりとり（POST）には関わらない
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  const isFont = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (!sameOrigin && !isFont) return;

  // 控えをすぐ返し、裏で新しいものを取りに行く
  e.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(req, { ignoreSearch: sameOrigin });
      const fresh = fetch(req, sameOrigin ? { cache: 'no-cache' } : {}).then((res) => {
        if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
        return res;
      }).catch(() => cached);
      return cached || fresh;
    }),
  );
});
