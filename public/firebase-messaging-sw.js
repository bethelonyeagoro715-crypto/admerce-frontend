// public/firebase-messaging-sw.js
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

// ─── Your Firebase config ──────────────────────────────────
firebase.initializeApp({
  apiKey: "AIzaSyCObj2DhOCM5xbRzHoG4xT90BoYWNjP_Aw",
  authDomain: "admerce-app-2026.firebaseapp.com",
  projectId: "admerce-app-2026",
  storageBucket: "admerce-app-2026.appspot.com",
  messagingSenderId: "162363596776",
  appId: "1:162363596776:web:959ff532d765cfa4704e5d",
});

const messaging = firebase.messaging();

// ─── Background messages ───────────────────────────────────
messaging.onBackgroundMessage((payload) => {
  console.log('📩 Background message:', payload);

  // Optional: customise the notification that appears
  const notificationTitle = payload.notification?.title || 'Admerce';
  const notificationOptions = {
    body: payload.notification?.body || '',
    icon: '/admerce_symbol.png',
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// ─── Service worker lifecycle improvements ─────────────────
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

// ─── Handle notification click (background) ────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  // This opens the app and focuses an existing window or opens a new one
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});