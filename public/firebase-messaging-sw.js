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

  const notificationTitle = payload.notification?.title || 'Admerce';
  const notificationOptions = {
    body: payload.notification?.body || '',
    icon: '/admerce_symbol.png',
    badge: '/admerce_symbol.png',
    data: payload.data || {}, // Crucial for deep linking on tap
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

  const data = event.notification.data || {};
  
  // Determine the target URL based on the payload data
  let targetUrl = '/notifications';
  if (data.url) {
    targetUrl = data.url;
  } else if (data.conversation_id) {
    targetUrl = `/chat/${data.conversation_id}`;
  } else if (data.order_id) {
    targetUrl = `/wallet/order/${data.order_id}`;
  } else if (data.listing_id) {
    targetUrl = `/item-detail/${data.listing_id}`;
  } else if (data.store_id) {
    targetUrl = `/store-detail/${data.store_id}`;
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If a window is already open, focus it and navigate
      for (const client of clientList) {
        if (client.url.includes(targetUrl) && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise, open a new window
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});