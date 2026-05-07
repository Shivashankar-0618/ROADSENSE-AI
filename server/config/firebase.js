
const admin = require("firebase-admin");

let firebaseApp = null;

// Strip surrounding quotes and semicolons that some .env editors add
const cleanEnv = (val) => val?.replace(/^["']|["'];?$/g, "").trim();

const initFirebase = () => {
  try {
    const projectId = cleanEnv(process.env.FIREBASE_PROJECT_ID);
    if (!projectId) {
      console.warn("⚠️  Firebase credentials not set. Push notifications disabled.");
      return;
    }

    // Firebase private key: dotenv may or may not expand \n — handle both cases
    const rawKey = cleanEnv(process.env.FIREBASE_PRIVATE_KEY) || "";
    const privateKey = rawKey.includes("\\n")
      ? rawKey.replace(/\\n/g, "\n")
      : rawKey;

    const serviceAccount = {
      type:                        "service_account",
      project_id:                  projectId,
      private_key_id:              cleanEnv(process.env.FIREBASE_PRIVATE_KEY_ID),
      private_key:                 privateKey,
      client_email:                cleanEnv(process.env.FIREBASE_CLIENT_EMAIL),
      client_id:                   cleanEnv(process.env.FIREBASE_CLIENT_ID),
      auth_uri:                    cleanEnv(process.env.FIREBASE_AUTH_URI),
      token_uri:                   cleanEnv(process.env.FIREBASE_TOKEN_URI),
    };

    // Only pass storageBucket if it has a real value
    const storageBucket = cleanEnv(process.env.FIREBASE_STORAGE_BUCKET);
    const appConfig = { credential: admin.credential.cert(serviceAccount) };
    if (storageBucket) appConfig.storageBucket = storageBucket;

    firebaseApp = admin.initializeApp(appConfig);
    console.log("✅ Firebase Admin initialized");
  } catch (error) {
    console.error("❌ Firebase initialization failed:", error.message);
    // Non-fatal — app continues, push notifications just won't work
  }
};

/**
 * Send push notification to a single device
 */
const sendPushNotification = async (token, title, body, data = {}) => {
  if (!firebaseApp) {
    console.warn("Firebase not initialized. Skipping push notification.");
    return null;
  }
  try {
    const message = {
      token,
      notification: { title, body },
      data: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])),
      android: {
        priority: "high",
        notification: { sound: "default", channelId: "roadsense_alerts" },
      },
      apns: { payload: { aps: { sound: "default", badge: 1 } } },
    };
    return await admin.messaging().send(message);
  } catch (error) {
    console.error("Push notification failed:", error.message);
    return null;
  }
};

/**
 * Send push notification to multiple devices (multicast)
 */
const sendMulticastNotification = async (tokens, title, body, data = {}) => {
  if (!firebaseApp || !tokens?.length) return null;
  try {
    const message = {
      tokens,
      notification: { title, body },
      data: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])),
    };
    const response = await admin.messaging().sendEachForMulticast(message);
    console.log("Push sent: ${response.successCount} success, ${response.failureCount} failed");
    return response;
  } catch (error) {
    console.error("Multicast notification failed:", error.message);
    return null;
  }
};

module.exports = { initFirebase, sendPushNotification, sendMulticastNotification };

