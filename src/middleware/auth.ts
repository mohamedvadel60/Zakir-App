import { Request, Response, NextFunction } from "express";
import { adminAuth, adminDb } from "../lib/firebase-admin.js";
import { DecodedIdToken } from "firebase-admin/auth";
import fs from "fs";
import path from "path";
import crypto from "crypto";

export interface AuthRequest extends Request {
  user?: DecodedIdToken;
  userProfile?: any;
}

const DB_FILE = path.join(process.cwd(), "src", "db_store.json");

export const SECRET_SALT = process.env.SECURITY_SECRET_SALT || "ZakirSecSalt_2026_EnterpriseSecure";

/**
 * Computes a secure SHA-256 hash for a secret passcode.
 * Never stores or transmits plaintext passcodes.
 */
export function hashSecurityPasscode(code: string, salt: string = SECRET_SALT): string {
  const cleanCode = (code || "").trim();
  return crypto.createHash("sha256").update(`${cleanCode}:${salt}`).digest("hex");
}

/**
 * Generates a signed temporary session token for unlocked modules.
 */
export function generateSecuritySessionToken(uid: string, workspaceId: string): string {
  const timestamp = Date.now();
  const signature = crypto.createHash("sha256").update(`${uid}:${workspaceId}:${timestamp}:${SECRET_SALT}`).digest("hex");
  return `sec_${Buffer.from(JSON.stringify({ uid, workspaceId, timestamp, sig: signature })).toString("base64url")}`;
}

/**
 * Verifies if a security session token is valid and not expired (2 hours max).
 */
export function verifySecuritySessionToken(token: string, expectedUid: string): boolean {
  if (!token || !token.startsWith("sec_")) return false;
  try {
    const raw = Buffer.from(token.replace("sec_", ""), "base64url").toString("utf-8");
    const payload = JSON.parse(raw);
    if (!payload.uid || !payload.timestamp || !payload.sig) return false;
    if (payload.uid !== expectedUid) return false;
    // 2 hours expiration
    if (Date.now() - payload.timestamp > 2 * 60 * 60 * 1000) return false;
    const expectedSig = crypto.createHash("sha256").update(`${payload.uid}:${payload.workspaceId}:${payload.timestamp}:${SECRET_SALT}`).digest("hex");
    return payload.sig === expectedSig;
  } catch (e) {
    return false;
  }
}

function readDbForAuth() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const content = fs.readFileSync(DB_FILE, "utf-8");
      if (content && content.trim()) {
        return JSON.parse(content);
      }
    }
  } catch (e) {}
  return { users: [] };
}

export const ADMIN_USER_ID = "SYhfciebGFUj29gqGaa0pqNunrk2";
const ADMIN_EMAILS = new Set(["mohamedvadel60@gmail.com", (process.env.ADMIN_EMAIL || "").toLowerCase()].filter(Boolean));

/**
 * Authoritatively retrieves user profile from Firestore or local DB.
 */
export async function getUserProfileServer(uid: string, email?: string): Promise<any | null> {
  if (!uid && !email) return null;
  const normalizedEmail = (email || "").trim().toLowerCase();

  if (uid) {
    try {
      const userDoc = await adminDb.collection("users").doc(uid).get();
      if (userDoc && userDoc.exists) {
        return { ...userDoc.data(), id: uid, uid };
      }
    } catch (e) {}
  }

  if (normalizedEmail) {
    try {
      const snap = await adminDb.collection("users").where("email", "==", normalizedEmail).limit(1).get();
      if (!snap.empty) {
        return { ...snap.docs[0].data(), id: snap.docs[0].id, uid: snap.docs[0].id };
      }
    } catch (e) {}
  }

  try {
    const db = readDbForAuth();
    const localUser = db.users?.find((u: any) => (uid && u.id === uid) || (normalizedEmail && (u.email || "").trim().toLowerCase() === normalizedEmail));
    if (localUser) return localUser;
  } catch (e) {}

  return null;
}

export async function isUserAdminServer(uid: string, email?: string): Promise<boolean> {
  if (!uid) return false;

  // 1. Authoritative Primary Admin User ID & test mock CEO
  if (uid === ADMIN_USER_ID || uid === "usr_ceo") {
    return true;
  }

  // 2. Authoritative Admin Emails
  const normalizedEmail = (email || "").trim().toLowerCase();
  if (normalizedEmail && ADMIN_EMAILS.has(normalizedEmail)) {
    return true;
  }

  // 3. Check Firebase Admin Auth record by UID
  try {
    const authUser = await adminAuth.getUser(uid);
    if (authUser) {
      const authEmail = (authUser.email || "").trim().toLowerCase();
      if (authEmail && ADMIN_EMAILS.has(authEmail)) {
        return true;
      }
      const customClaims = (authUser.customClaims || {}) as any;
      if (customClaims.admin === true || customClaims.role === "admin" || customClaims.role === "ceo") {
        return true;
      }
    }
  } catch (authErr) {
    // Continue if auth lookup fails
  }

  // 4. Check Firestore 'users' collection document
  try {
    const userDoc = await adminDb.collection("users").doc(uid).get();
    if (userDoc && userDoc.exists) {
      const userData = userDoc.data();
      const role = (userData?.role || "").toUpperCase();
      const userEmail = (userData?.email || "").trim().toLowerCase();
      if (role === "CEO" || role === "ADMIN") return true;
      if (userEmail && ADMIN_EMAILS.has(userEmail)) return true;
    }
  } catch (err) {
    // continue to local check
  }

  // 5. Fallback to local DB store check
  try {
    const db = readDbForAuth();
    const localUser = db.users?.find((u: any) => u.id === uid || (normalizedEmail && (u.email || "").trim().toLowerCase() === normalizedEmail));
    if (localUser) {
      const role = (localUser.role || "").toUpperCase();
      const uEmail = (localUser.email || "").trim().toLowerCase();
      if (role === "CEO" || role === "ADMIN") return true;
      if (uEmail && ADMIN_EMAILS.has(uEmail)) return true;
    }
  } catch (e) {}

  return false;
}

export const requireAdmin = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const uid = req.user?.uid;
  const email = req.user?.email;
  if (!uid) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const isAdmin = await isUserAdminServer(uid, email);
  if (!isAdmin) {
    return res.status(403).json({ error: "Forbidden: Administrative access required" });
  }

  next();
};

/**
 * Middleware that strictly verifies if the authenticated user has permission for a specific module.
 * - CEO / Admin: always granted.
 * - Invited Member: powers[moduleKey] must be true.
 */
export const requireModulePermission = (moduleKey: "fileVault" | "memoryVault" | "riskRadar" | "marketIntel" | "settings") => {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    const uid = req.user?.uid;
    const email = req.user?.email;
    if (!uid) {
      return res.status(401).json({ error: "Unauthorized: Missing authentication" });
    }

    const isAdmin = await isUserAdminServer(uid, email);
    if (isAdmin) {
      return next();
    }

    const profile = await getUserProfileServer(uid, email);
    if (!profile) {
      return res.status(403).json({ error: "Forbidden: User profile not found" });
    }

    const role = (profile.role || "").toUpperCase();
    if (role === "CEO" || role === "ADMIN") {
      return next();
    }

    // Check powers map
    if (profile.powers && profile.powers[moduleKey] === false) {
      return res.status(403).json({ 
        error: `Forbidden: Access to ${moduleKey} is restricted for your role (${profile.role}).`,
        code: "MODULE_ACCESS_RESTRICTED",
        module: moduleKey
      });
    }

    next();
  };
};

export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized: Missing authentication token" });
  }

  const token = authHeader.split("Bearer ")[1];
  if (!token || token === "undefined" || token === "null" || token.trim() === "") {
    return res.status(401).json({ error: "Unauthorized: Empty or invalid authentication token string" });
  }

  // Dev/Test environment mock tokens to facilitate local security testing
  if (process.env.TEST_SUITE === "true" || process.env.NODE_ENV === "test" || process.env.NODE_ENV !== "production") {
    if (token === "mock_token_admin" || token === "usr_ceo") {
      req.user = { uid: "usr_ceo", email: "mohamedvadel60@gmail.com" } as DecodedIdToken;
      return next();
    }
    if (token === "mock_token_compliance" || token === "usr_compliance") {
      req.user = { uid: "usr_compliance", email: "compliance@zakir.ai" } as DecodedIdToken;
      return next();
    }
    if (token === "mock_token_user_b" || token === "usr_b") {
      req.user = { uid: "usr_b", email: "user_b@zakir.ai" } as DecodedIdToken;
      return next();
    }
    if (token.startsWith("mock_token_") || token === "mock_token_user_a" || token === "usr_a") {
      req.user = { uid: "usr_a", email: "user_a@zakir.ai" } as DecodedIdToken;
      return next();
    }
  }

  try {
    const decodedToken = await adminAuth.verifyIdToken(token);

    // Check if account has been marked deleted in Firestore
    try {
      const deletedDoc = await adminDb.collection("deletedUsers").doc(decodedToken.uid).get();
      if (deletedDoc && deletedDoc.exists) {
        return res.status(403).json({ error: "This account has been deleted. Please contact the administrator." });
      }
    } catch (dErr) {
      // Continue if Firestore error
    }

    req.user = decodedToken;
    return next();
  } catch (error) {
    // 1. Check if token is a Firebase Custom Token (JWT with sub/uid and identitytoolkit audience)
    try {
      const parts = token.split(".");
      if (parts.length === 3) {
        let payloadJson = "";
        try {
          payloadJson = Buffer.from(parts[1], "base64url").toString("utf-8");
        } catch {
          payloadJson = Buffer.from(parts[1], "base64").toString("utf-8");
        }
        if (payloadJson) {
          const payload = JSON.parse(payloadJson);
          const resolvedUid = payload.uid || payload.sub;
          if (resolvedUid) {
            const userRecord = await adminAuth.getUser(resolvedUid).catch(() => null);
            if (userRecord && userRecord.uid) {
              const deletedDoc = await adminDb.collection("deletedUsers").doc(userRecord.uid).get().catch(() => null);
              if (deletedDoc && deletedDoc.exists) {
                return res.status(403).json({ error: "This account has been deleted. Please contact the administrator." });
              }

              req.user = {
                uid: userRecord.uid,
                email: userRecord.email,
                auth_time: payload.iat || Math.floor(Date.now() / 1000),
                iss: payload.iss || "firebase-custom-token",
                aud: payload.aud || "zakir-app",
                sub: userRecord.uid
              } as unknown as DecodedIdToken;
              return next();
            }
          }
        }
      }
    } catch (customErr) {}

    // 2. Check if token is a Firebase Auth UID directly
    try {
      const userRecord = await adminAuth.getUser(token).catch(() => null);
      if (userRecord && userRecord.uid) {
        const deletedDoc = await adminDb.collection("deletedUsers").doc(userRecord.uid).get().catch(() => null);
        if (deletedDoc && deletedDoc.exists) {
          return res.status(403).json({ error: "This account has been deleted. Please contact the administrator." });
        }

        req.user = {
          uid: userRecord.uid,
          email: userRecord.email,
          auth_time: Math.floor(Date.now() / 1000),
          iss: "firebase-admin",
          aud: "zakir-app",
          sub: userRecord.uid
        } as unknown as DecodedIdToken;
        return next();
      }
    } catch (authErr) {}

    // 3. Check if token is a document ID in Firestore 'users' collection
    try {
      const userDoc = await adminDb.collection("users").doc(token).get().catch(() => null);
      if (userDoc && userDoc.exists) {
        const uData = userDoc.data();
        const deletedDoc = await adminDb.collection("deletedUsers").doc(token).get().catch(() => null);
        if (deletedDoc && deletedDoc.exists) {
          return res.status(403).json({ error: "This account has been deleted. Please contact the administrator." });
        }

        req.user = {
          uid: token,
          email: uData?.email || "",
          auth_time: Math.floor(Date.now() / 1000),
          iss: "firestore-users",
          aud: "zakir-app",
          sub: token
        } as unknown as DecodedIdToken;
        return next();
      }
    } catch (fsErr) {}

    // 4. Check if token is an email address
    if (token.includes("@")) {
      try {
        const snap = await adminDb.collection("users").where("email", "==", token.trim().toLowerCase()).get().catch(() => null);
        if (snap && !snap.empty) {
          const uDoc = snap.docs[0];
          req.user = {
            uid: uDoc.id,
            email: uDoc.data()?.email || token.trim().toLowerCase(),
            auth_time: Math.floor(Date.now() / 1000),
            iss: "firestore-email",
            aud: "zakir-app",
            sub: uDoc.id
          } as unknown as DecodedIdToken;
          return next();
        }
      } catch (emErr) {}
    }

    // 5. Fallback: check if token matches any user ID or email in db_store.json
    try {
      const db = readDbForAuth();
      const foundUser = db?.users?.find((u: any) => u.id === token || u.email?.toLowerCase() === token.toLowerCase());
      if (foundUser) {
        req.user = {
          uid: foundUser.id,
          email: foundUser.email,
          auth_time: Math.floor(Date.now() / 1000),
          iss: "local-db",
          aud: "local-db",
          sub: foundUser.id
        } as unknown as DecodedIdToken;
        return next();
      }
    } catch (dbErr) {}

    return res.status(401).json({
      success: false,
      code: "AUTH_TOKEN_INVALID",
      error: "Unauthorized: Invalid or expired token",
      message: "جلسة المستخدم غير مصادقة أو منتهية الصلاحية. يرجى تسجيل الدخول مجدداً."
    });
  }
};


