// Service worker: shows booking notifications and opens the right page when one is tapped.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data && event.data.text() };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'Kirtan Sewa', {
      body: data.body || '',
      icon: '/icon-192.png',
      badge: '/badge-96.png',
      tag: data.tag,
      ...(data.image && { image: data.image }), // big picture (Android Chrome), e.g. the Gurpurab poster
      renotify: !!data.tag,
      data: { url: data.url || '/account' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || '/account', self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      for (const w of windows) {
        if (w.url === target && 'focus' in w) return w.focus();
      }
      for (const w of windows) {
        if ('navigate' in w && new URL(w.url).origin === self.location.origin) return w.navigate(target).then((c) => c && c.focus());
      }
      return self.clients.openWindow(target);
    }),
  );
});
