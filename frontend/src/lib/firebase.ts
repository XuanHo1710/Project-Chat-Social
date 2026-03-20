import { NotificationPayloadType } from "@/components/FirebaseNotification";
import { initializeApp } from "firebase/app";
import {
  Messaging,
  getMessaging,
  getToken,
  onMessage,
} from "firebase/messaging";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

const app = initializeApp(firebaseConfig);

// Firebase Messaging requires HTTPS + Service Worker support
const isMessagingSupported = () =>
  typeof window !== "undefined" &&
  "serviceWorker" in navigator &&
  window.isSecureContext;

let messagingInstance: Messaging | null = null;
const getMessagingInstance = (): Messaging | null => {
  if (!isMessagingSupported()) return null;
  if (!messagingInstance) {
    messagingInstance = getMessaging(app);
  }
  return messagingInstance;
};

export const getFirebaseToken = async () => {
  try {
    const messaging = getMessagingInstance();
    if (!messaging) return null;

    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      const currentToken = await getToken(messaging, {
        vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
      });
      if (currentToken) return currentToken;
    }
  } catch (err) {
    console.log("An error occurred while retrieving token. ", err);
  }
  return null;
};

export const onMessageListener = (
  callback: (payload: NotificationPayloadType) => void,
) => {
  const messaging = getMessagingInstance();
  if (!messaging) return () => {};
  return onMessage(messaging, (payload) => {
    callback(payload);
  });
};
