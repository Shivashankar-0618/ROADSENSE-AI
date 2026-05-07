import { initializeApp } from "firebase/app";
import { getMessaging, getToken, onMessage } from "firebase/messaging";
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId:     import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

let app = null;
let messaging = null;
let analytics = null;

// Only initialize if Firebase config is provided
if (firebaseConfig.apiKey) {
  app = initializeApp(firebaseConfig);
  analytics = getAnalytics(app);

  if ("Notification" in window && "serviceWorker" in navigator) {
    try {
      messaging = getMessaging(app);
    } catch (e) {
      console.warn("Firebase messaging not available:", e.message);
    }
  }
}

/**
 * Request notification permission and get FCM token
 * @returns {Promise<string|null>} FCM token
 */
export const requestNotificationPermission = async () => {
  if (!messaging) return null;

  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return null;

    const token = await getToken(messaging, {
      vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
    });

    return token;
  } catch (error) {
    console.error("Notification permission error:", error);
    return null;
  }
};

/**
 * Listen for foreground push messages
 * @param {function} callback - Called with the message payload
 */
export const onForegroundMessage = (callback) => {
  if (!messaging) return () => {};
  return onMessage(messaging, callback);
};

export { app, messaging, analytics };
