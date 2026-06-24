// Service Worker — iPad 単体モードを「ホーム画面に追加」後に完全オフラインで動かすためのキャッシュ。
// 方針：アプリ殻（solo＋共有JS＋アイコン）を install 時にプリキャッシュし、fetch は cache-first。
// → 初回だけ Safari で Mac の /solo を開いて追加すれば、以降は機内/会場でもネット不要で起動できる。
const CACHE = 'seminar-timer-v1';
const ASSETS = [
  '/solo', '/solo.html',
  '/timer-core.js', '/bell.js',
  '/manifest.webmanifest',
  '/icon-192.png', '/icon-512.png', '/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then((hit) => {
      if (hit) return hit;
      // 未キャッシュは取得を試み、成功すれば同一オリジン GET をキャッシュに追加。失敗時は殻にフォールバック。
      return fetch(req).then((res) => {
        if (res && res.ok && new URL(req.url).origin === self.location.origin) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      }).catch(() => caches.match('/solo'));
    })
  );
});
