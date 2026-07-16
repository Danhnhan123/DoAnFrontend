export const environment = {
  baseUrl: 'https://backend-do-an-api-new.onrender.com/api/v1',

  // Cấu hình Firebase Cloud Messaging. Dán giá trị từ Firebase Console (Project settings > General > Web app),
  // và vapidKey từ Cloud Messaging > Web Push certificates. Để trống -> FCM bị tắt (không xin quyền).
  firebase: {
    apiKey: '',
    authDomain: '',
    projectId: '',
    storageBucket: '',
    messagingSenderId: '',
    appId: '',
    vapidKey: '',
  },
};
