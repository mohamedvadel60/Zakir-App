import { Request, Response, NextFunction } from "express";
import { adminAuth, adminDb } from "../lib/firebase-admin.js";
import { DecodedIdToken } from "firebase-admin/auth";
import fs from "fs";
import path from "path";

export interface AuthRequest extends Request {
  user?: DecodedIdToken;
}

const DB_FILE = path.join(process.cwd(), "src", "db_store.json");

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

export async function isUserAdminServer(uid: string): Promise<boolean> {
  if (!uid) return false;
  if ((process.env.TEST_SUITE === "true" || process.env.NODE_ENV === "test") && uid === "usr_ceo") {
    return true;
  }
  try {
    const userDoc = await adminDb.collection("users").doc(uid).get();
    if (userDoc && userDoc.exists) {
      const userData = userDoc.data();
      const role = (userData?.role || "").toUpperCase();
      if (role === "CEO" || role === "ADMIN") return true;
    }
  } catch (err) {
    // continue to local check
  }

  // Fallback to local DB store check
  try {
    const db = readDbForAuth();
    const localUser = db.users?.find((u: any) => u.id === uid);
    if (localUser) {
      const role = (localUser.role || "").toUpperCase();
      return role === "CEO" || role === "ADMIN";
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
  if (!uid) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const isAdmin = await isUserAdminServer(uid);
  if (!isAdmin) {
    return res.status(403).json({ error: "Forbidden: Administrative access required" });
  }

  next();
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
    next();
  } catch (error) {
    // Fallback: check if token matches any user ID in db_store.json (Development/Test Only)
    if (process.env.TEST_SUITE === "true" || process.env.NODE_ENV === "test" || process.env.NODE_ENV !== "production") {
      try {
        const db = readDbForAuth();
        const foundUser = db?.users?.find((u: any) => u.id === token);
        if (foundUser) {
          req.user = { uid: foundUser.id, email: foundUser.email } as DecodedIdToken;
          return next();
        }
      } catch (dbErr) {}
    }

    return res.status(401).json({ error: "Unauthorized: Invalid or expired token" });
  }
};


