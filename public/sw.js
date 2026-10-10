// Service Worker pour la réception des notifications Web Push VAPID et la navigation
self.addEventListener('push', function (event) {
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch {
      data = { body: event.data.text() };
    }
  }

  const title = data.title || 'Nouveau message';
  const options = {
    body: data.body || 'Vous avez reçu un média/message.',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    vibrate: [200, 100, 200],
    data: {
      url: data.url || '/',
      timestamp: Date.now(),
    },
    actions: [
      {
        action: 'open',
        title: 'Ouvrir',
      },
    ],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
      // Si une fenêtre est déjà ouverte, lui redonner le focus
      for (const client of clientList) {
        if ('focus' in client) {
          return client.focus();
        }
      }
      // Sinon ouvrir une nouvelle fenêtre PWA
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

// Activation immédiate du SW
self.addEventListener('install', function (event) {
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil(clients.claim());
});
