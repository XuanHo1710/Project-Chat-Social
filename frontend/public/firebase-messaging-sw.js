importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');


firebase.initializeApp({
    apiKey: "AIzaSyCFdlHGDYEc4YXfSm7eYI5vdxScHxN_I3o",
    authDomain: "project-chat-ca9b5.firebaseapp.com",
    projectId: "project-chat-ca9b5",
    storageBucket: "project-chat-ca9b5.firebasestorage.app",
    messagingSenderId: "371677931472",
    appId: "1:371677931472:web:1f95ceeafdad66c2993bd5",
    measurementId: "G-YDKW5DQW0H"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(function (payload) {
    console.log('Received background message ', payload);

    const notificationTitle = payload.notification.title;
    const notificationOptions = {
        body: payload.notification.body,
        icon: '/logo.png', // Đường dẫn icon app
        data: payload.data
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
});