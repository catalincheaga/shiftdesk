const CACHE = 'shiftdesk-v4';
const SHELL = [
  './shiftdesk-admin.html',
  './manifest.json',
  './icon.svg',
  './icon-maskable.svg',
];

// ─── INSTALL ──────────────────────────────────
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

// ─── ACTIVATE ─────────────────────────────────
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// ─── FETCH (cache-first pentru shell) ─────────
self.addEventListener('fetch', e => {
  if (new URL(e.request.url).pathname.includes('/wp-json/')) return;
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      });
    })
  );
});

// ─── PUSH — notificare primita de la server ────
self.addEventListener('push', e => {
  let data = { title: 'ShiftDesk', body: 'Notificare noua', tag: 'shiftdesk', url: './shiftdesk-admin.html' };

  try {
    if (e.data) data = { ...data, ...e.data.json() };
  } catch(_) {}

  e.waitUntil(
    self.registration.showNotification(data.title, {
      body:    data.body,
      icon:    './icon.svg',
      badge:   './icon.svg',
      tag:     data.tag || 'shiftdesk',
      vibrate: [200, 100, 200],
      data:    { url: data.url || './shiftdesk-admin.html#orders' },
      actions: [
        { action: 'open',    title: 'Deschide' },
        { action: 'dismiss', title: 'Ignora'   },
      ],
    })
  );
});

// ─── NOTIFICATION CLICK ───────────────────────
self.addEventListener('notificationclick', e => {
  e.notification.close();
  if (e.action === 'dismiss') return;

  const targetUrl = e.notification.data?.url || './shiftdesk-admin.html#orders';

  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      // Daca aplicatia e deja deschisa, activeaz-o
      for (const client of list) {
        if (client.url.includes('shiftdesk-admin') && 'focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      // Altfel, deschide o fereastra noua
      return clients.openWindow(targetUrl);
    })
  );
});

// ─── SUBSCRIPTION CHANGE (token reinnoit de browser) ─
self.addEventListener('pushsubscriptionchange', e => {
  e.waitUntil(
    self.registration.pushManager.subscribe(e.oldSubscription.options)
      .then(sub => {
        // Trimite noua subscriptie la worker
        return fetch('WORKER_URL_PLACEHOLDER/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(sub),
        });
      })
  );
});
