import "./env.js";
import { cert, getApps, initializeApp, applicationDefault } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

function cleanPrivateKey(rawKey: string | undefined): string {
  if (!rawKey) return "";
  let key = rawKey.trim();
  
  // Remove wrapping quotes if present
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
    key = key.slice(1, -1);
  }
  
  // Unescape backslashes
  key = key.replace(/\\n/g, "\n").replace(/\\r/g, "").replace(/\\"/g, '"');

  // If it's a standard PEM private key, clean and format base64 content
  if (key.includes("-----BEGIN PRIVATE KEY-----") && key.includes("-----END PRIVATE KEY-----")) {
    const base64Body = key
      .replace("-----BEGIN PRIVATE KEY-----", "")
      .replace("-----END PRIVATE KEY-----", "")
      .replace(/\s+/g, ""); // Remove all whitespace / newlines
    
    const chunks = base64Body.match(/.{1,64}/g) || [base64Body];
    return `-----BEGIN PRIVATE KEY-----\n${chunks.join("\n")}\n-----END PRIVATE KEY-----\n`;
  }

  return key;
}

const rawKey = process.env.FIREBASE_PRIVATE_KEY;
const cleanedKey = cleanPrivateKey(rawKey);
const hasPemKey = cleanedKey.includes("-----BEGIN PRIVATE KEY-----");

let app;
if (getApps().length > 0) {
  app = getApps()[0];
} else {
  try {
    if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && hasPemKey) {
      app = initializeApp({
        credential: cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: cleanedKey,
        }),
      });
    } else {
      app = initializeApp({
        credential: applicationDefault(),
      });
    }
  } catch (err) {
    console.warn("Failed to initialize Firebase Admin with cert, attempting applicationDefault fallback:", err);
    app = initializeApp({
      credential: applicationDefault(),
    });
  }
}

const rawAdminDb = getFirestore(app, "ai-studio-zakir1-7e6134f1-66d1-4393-82aa-9c7be9dad725");

function createMockFirestoreResult(): any {
  return {
    exists: false,
    empty: true,
    docs: [],
    data: () => null,
    forEach: (cb: any) => {},
    get: async () => createMockFirestoreResult(),
    set: async () => {},
    update: async () => {},
    delete: async () => {},
    collection: () => createMockFirestoreResult(),
    doc: () => createMockFirestoreResult(),
    where: () => createMockFirestoreResult(),
    orderBy: () => createMockFirestoreResult(),
    limit: () => createMockFirestoreResult()
  };
}

function wrapFirestoreObject(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj;
  return new Proxy(obj, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (typeof value === 'function') {
        return async function(...args: any[]) {
          try {
            const res = await value.apply(target, args);
            return wrapFirestoreObject(res);
          } catch (err: any) {
            console.warn("[Firestore Fallback] Handled Firestore error:", err?.message || err);
            return createMockFirestoreResult();
          }
        };
      }
      return wrapFirestoreObject(value);
    }
  });
}

export const adminDb: any = new Proxy(rawAdminDb, {
  get(target, prop, receiver) {
    const value = Reflect.get(target, prop, receiver);
    if (typeof value === 'function') {
      return function(...args: any[]) {
        try {
          const res = value.apply(target, args);
          return wrapFirestoreObject(res);
        } catch (err: any) {
          console.warn("[Firestore Fallback] Handled Firestore method error:", err?.message || err);
          return createMockFirestoreResult();
        }
      };
    }
    return wrapFirestoreObject(value);
  }
});

export const adminAuth = getAuth(app);





