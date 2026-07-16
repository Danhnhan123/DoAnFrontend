/* eslint-disable no-undef */
/**
 * Sinh file cấu hình từ BIẾN MÔI TRƯỜNG lúc build (dùng cho Vercel, vì các file cấu hình
 * chứa key firebase đã bị gitignore nên không có sẵn khi build trên CI).
 *
 * - Chỉ ghi khi có đủ biến FIREBASE_* -> khi build/chạy ở máy local (không set env) sẽ BỎ QUA,
 *   giữ nguyên file bạn đã điền tay.
 * - Chạy tự động trước "ng build" nhờ npm hook "prebuild".
 *
 * Biến môi trường cần khai báo trên Vercel:
 *   API_BASE_URL (tuỳ chọn), FIREBASE_API_KEY, FIREBASE_AUTH_DOMAIN, FIREBASE_PROJECT_ID,
 *   FIREBASE_STORAGE_BUCKET, FIREBASE_MESSAGING_SENDER_ID, FIREBASE_APP_ID, FIREBASE_VAPID_KEY
 */
const fs = require('fs');
const path = require('path');

const env = process.env;
const required = ['FIREBASE_API_KEY', 'FIREBASE_APP_ID', 'FIREBASE_MESSAGING_SENDER_ID'];
const hasFirebase = required.every((k) => env[k]);

if (!hasFirebase) {
  console.log('[generate-env] Thiếu biến FIREBASE_* -> bỏ qua, giữ nguyên file cấu hình cục bộ.');
  process.exit(0);
}

const baseUrl = env.API_BASE_URL || 'https://backend-do-an-api-new.onrender.com/api/v1';
const fb = {
  apiKey: env.FIREBASE_API_KEY || '',
  authDomain: env.FIREBASE_AUTH_DOMAIN || '',
  projectId: env.FIREBASE_PROJECT_ID || '',
  storageBucket: env.FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: env.FIREBASE_MESSAGING_SENDER_ID || '',
  appId: env.FIREBASE_APP_ID || '',
  vapidKey: env.FIREBASE_VAPID_KEY || '',
};

const root = path.join(__dirname, '..');

const environmentTs = `export const environment = {
  baseUrl: '${baseUrl}',
  firebase: {
    apiKey: '${fb.apiKey}',
    authDomain: '${fb.authDomain}',
    projectId: '${fb.projectId}',
    storageBucket: '${fb.storageBucket}',
    messagingSenderId: '${fb.messagingSenderId}',
    appId: '${fb.appId}',
    vapidKey: '${fb.vapidKey}',
  },
};
`;

fs.mkdirSync(path.join(root, 'src/environments'), { recursive: true });
fs.writeFileSync(path.join(root, 'src/environments/environment.ts'), environmentTs);
fs.writeFileSync(path.join(root, 'src/environments/environment.development.ts'), environmentTs);

const serviceWorker = `/* eslint-disable no-undef */
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: '${fb.apiKey}',
  authDomain: '${fb.authDomain}',
  projectId: '${fb.projectId}',
  storageBucket: '${fb.storageBucket}',
  messagingSenderId: '${fb.messagingSenderId}',
  appId: '${fb.appId}',
});
const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const data = payload.data || {};
  const notification = payload.notification || {};
  const title = notification.title || data.title || 'Thông báo';
  self.registration.showNotification(title, {
    body: notification.body || data.content || '',
    icon: '/favicon.ico',
    data: { url: data.directionId || data.url || '/' },
  });
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ('focus' in c) {
          try { c.navigate(url); } catch (e) { /* ignore */ }
          return c.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
`;

fs.mkdirSync(path.join(root, 'public'), { recursive: true });
fs.writeFileSync(path.join(root, 'public/firebase-messaging-sw.js'), serviceWorker);

console.log('[generate-env] Đã sinh environment.ts, environment.development.ts và firebase-messaging-sw.js từ biến môi trường.');
