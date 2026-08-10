import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { initializeFirestore, setLogLevel } from "firebase/firestore";
import { getStorage } from "firebase/storage";

setLogLevel("silent");

function getClientFirebaseConfig() {
  const env = typeof process !== "undefined" && process.env ? process.env : (import.meta as any).env || {};
  
  return {
    apiKey: env.VITE_FIREBASE_API_KEY || env.FIREBASE_API_KEY || "AIzaSyAvjj-PBHknriQ73FYyQc2nhhBNCF_lvnE",
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || env.FIREBASE_AUTH_DOMAIN || "potent-turbine-47c1c.firebaseapp.com",
    projectId: env.VITE_FIREBASE_PROJECT_ID || env.FIREBASE_PROJECT_ID || "potent-turbine-47c1c",
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || env.FIREBASE_STORAGE_BUCKET || "potent-turbine-47c1c.firebasestorage.app",
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || env.FIREBASE_MESSAGING_SENDER_ID || "936745730990",
    appId: env.VITE_FIREBASE_APP_ID || env.FIREBASE_APP_ID || "1:936745730990:web:dcf1aa773ecda858c6be3f",
    firestoreDatabaseId: env.VITE_FIREBASE_DATABASE_ID || env.FIREBASE_DATABASE_ID || "ai-studio-zakir1-7e6134f1-66d1-4393-82aa-9c7be9dad725"
  };
}

const config = getClientFirebaseConfig();

const firebaseConfig = {
  apiKey: config.apiKey,
  authDomain: config.authDomain,
  projectId: config.projectId,
  storageBucket: config.storageBucket,
  messagingSenderId: config.messagingSenderId,
  appId: config.appId,
};

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);

const dbId = config.firestoreDatabaseId;
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
}, dbId && dbId !== "(default)" ? dbId : undefined);

export const storage = getStorage(app);
export default app;

