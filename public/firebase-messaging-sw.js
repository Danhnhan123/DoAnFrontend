/* eslint-disable no-undef */
// Service worker cho Firebase Cloud Messaging (nhận thông báo khi tab đóng/nền).
// Đặt ở web root -> được phục vụ tại /firebase-messaging-sw.js (thư mục public/).
//
// >>> DÁN CẤU HÌNH FIREBASE CỦA BẠN VÀO firebaseConfig BÊN DƯỚI <<<
// (Service worker KHÔNG đọc được environment.ts nên phải điền trực tiếp ở đây.)

importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: '',
  authDomain: '',
  projectId: '',
  storageBucket: '',
  messagingSenderId: '',
  appId: '',
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

// Thông báo khi app ở nền (tab không mở/không focus).
messaging.onBackgroundMessage((payload) => {
  const data = payload.data || {};
  const notification = payload.notification || {};
  const title = notification.title || data.title || 'Thông báo';
  const options = {
    body: notification.body || data.content || '',
    icon: '/favicon.ico',
    // directionId là đường dẫn nội bộ để điều hướng khi bấm vào thông báo.
    data: { url: data.directionId || data.url || '/' },
  };
  self.registration.showNotification(title, options);
});

// Bấm vào thông báo -> mở/điều hướng tới trang tương ứng.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          try { client.navigate(url); } catch (e) { /* ignore */ }
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
