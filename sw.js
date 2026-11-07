const CACHE = 'hrg-v2';
const PRECACHE = ['/', '/icon-192.png', '/icon-512.png', '/manifest.webmanifest'];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(PRECACHE)).catch(() => {})
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET') return;
  const url = new URL(r.url);
  if (url.pathname.startsWith('/api')) return;

  e.respondWith(
    fetch(r)
      .then(res => {
        if (res.ok && url.origin === self.location.origin) {
          const cp = res.clone();
          caches.open(CACHE).then(c => c.put(r, cp));
        }
        return res;
      })
      .catch(() => caches.match(r).then(m => m || caches.match('/')))
  );
});

self.addEventListener('push', e => {
  let d = {};
  try { d = e.data.json(); } catch (_) {}
  e.waitUntil(
    self.registration.showNotification(d.title || 'تصاريح الغردقة', {
      body: d.body || '',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: { url: d.url || '/?start=1' },
      dir: 'rtl',
      lang: 'ar'
    })
  );
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const target = (e.notification.data && e.notification.data.url) || '/?start=1';
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const c of list) {
        if (c.url.includes(self.location.origin) && 'focus' in c) {
          c.navigate(target);
          return c.focus();
        }
      }
      return clients.openWindow(target);
    })
  );
});
