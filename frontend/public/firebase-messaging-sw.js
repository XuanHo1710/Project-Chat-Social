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

// Store for deduplication
const notifiedMessages = new Set();

// Clean up old message IDs after 10 seconds
const cleanupOldMessages = (messageId) => {
    setTimeout(() => {
        notifiedMessages.delete(messageId);
    }, 10000);
};

messaging.onBackgroundMessage(function (payload) {
    console.log('[SW] Received background message:', payload);

    const conversationId = payload.data?.conversationId || '';
    const messageId = payload.data?.messageId || '';
    const avatar = payload.data?.avatar || '/logo.png';

    // Deduplication - skip if we already showed this notification
    if (messageId && notifiedMessages.has(messageId)) {
        console.log('[SW] Duplicate notification blocked:', messageId);
        return;
    }

    // Add to notified set
    if (messageId) {
        notifiedMessages.add(messageId);
        cleanupOldMessages(messageId);
    }

    const notificationTitle = payload.notification?.title || 'Tin nhắn mới';
    const notificationOptions = {
        body: payload.notification?.body || '',
        icon: avatar || '/logo.png',
        badge: '/logo.png',
        tag: messageId || conversationId || 'message', // Use messageId as tag to prevent duplicates
        data: {
            conversationId: conversationId,
            messageId: messageId,
            url: conversationId ? `/chat/${conversationId}` : '/chat'
        },
        requireInteraction: false,
        silent: false,
        renotify: false, // Don't renotify for same tag
    };

    return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click
self.addEventListener('notificationclick', function (event) {
    console.log('[SW] Notification clicked:', event);
    event.notification.close();

    const urlToOpen = event.notification.data?.url || '/chat';

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
            // Check if app is already open
            for (let i = 0; i < clientList.length; i++) {
                const client = clientList[i];
                if (client.url.includes('/chat') && 'focus' in client) {
                    client.focus();
                    client.navigate(urlToOpen);
                    return;
                }
            }
            // Open new window if not
            if (clients.openWindow) {
                return clients.openWindow(urlToOpen);
            }
        })
    );
});