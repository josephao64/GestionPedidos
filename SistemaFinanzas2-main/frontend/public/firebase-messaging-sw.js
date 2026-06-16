// public/firebase-messaging-sw.js
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyBJ6vgHCboEyeFh_YMohMhLk1fK4Wn8ZeY",
  authDomain: "sistema-vipizza.firebaseapp.com",
  projectId: "sistema-vipizza",
  storageBucket: "sistema-vipizza.firebasestorage.app",
  messagingSenderId: "923759550793",
  appId: "1:923759550793:web:39d49aeef741d8a74d7a98",
  measurementId: "G-QE8FMBLSL0"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(payload => {
  console.log('Mensaje recibido en segundo plano:', payload);
  self.registration.showNotification(payload.notification.title, {
    body: payload.notification.body,
    icon: '/icon.png'
  });
});
