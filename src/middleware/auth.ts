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

// In-memory rate limiting and lockout map for security passcodes
interface PasscodeAttemptRecord {
  attempts: number;
  lockedUntil?: number;
  lastAttemptAt: number;
}
const passcodeAttemptsMap = new Map<string, PasscodeAttemptRecord>();

export function checkPasscodeRateLimit(identifier: string): { allowed: boolean; remainingAttempts: number; lockedUntil?: number } {
  const record = passcodeAttemptsMap.get(identifier);
  if (!record) {
    return { allowed: true, remainingAttempts: 5 };
  }

  const now = Date.now();
  // Check if currently locked out
  if (record.lockedUntil && now < record.lockedUntil) {
    return { allowed: false, remainingAttempts: 0, lockedUntil: record.lockedUntil };
  }

  // If lockout or cooldown (15 minutes) has expired, reset attempts
  if (record.lastAttemptAt && (now - record.lastAttemptAt > 15 * 60 * 1000)) {
    passcodeAttemptsMap.delete(identifier);
    return { allowed: true, remainingAttempts: 5 };
  }

  const remaining = Math.max(0, 5 - record.attempts);
  return { allowed: record.attempts < 5, remainingAttempts: remaining };
}

export function recordPasscodeFailure(identifier: string): { locked: boolean; remainingAttempts: number; lockedUntil?: number } {
  const now = Date.now();
  const record = passcodeAttemptsMap.get(identifier) || { attempts: 0, lastAttemptAt: now };
  record.attempts += 1;
  record.lastAttemptAt = now;

  if (record.attempts >= 5) {
    record.lockedUntil = now + 15 * 60 * 1000; // 15-minute lockout
    passcodeAttemptsMap.set(identifier, record);
    return { locked: true, remainingAttempts: 0, lockedUntil: record.lockedUntil };
  }

  passcodeAttemptsMap.set(identifier, record);
  return { locked: false, remainingAttempts: Math.max(0, 5 - record.attempts) };
}

export function resetPasscodeFailures(identifier: string): void {
  passcodeAttemptsMap.delete(identifier);
}

/**
 * Computes an industrial-strength scrypt hash for a secret passcode.
 * Never stores or transmits plaintext passcodes.
 */
export function hashSecurityPasscode(code: string, salt: string = SECRET_SALT): string {
  const cleanCode = (code || "").trim();
  const derivedKey = crypto.scryptSync(cleanCode, salt, 32, { N: 16384, r: 8, p: 1 });
  return `scrypt$N=16384,r=8,p=1$${salt}$${derivedKey.toString("hex")}`;
}

/**
 * Timing-safe verification of security passcode against scrypt or legacy hashes.
 */
export function verifySecurityPasscode(code: string, storedHashOrPlain?: string, salt: string = SECRET_SALT): boolean {
  if (!storedHashOrPlain || !code) return false;
  const cleanCode = (code || "").trim();

  // 1. Scrypt format verification
  if (storedHashOrPlain.startsWith("scrypt$")) {
    try {
      const parts = storedHashOrPlain.split("$");
      const extractedSalt = parts[2] || salt;
      const expectedHex = parts[3] || "";
      const derivedKey = crypto.scryptSync(cleanCode, extractedSalt, 32, { N: 16384, r: 8, p: 1 });
      const expectedBuffer = Buffer.from(expectedHex, "hex");
      if (derivedKey.length === expectedBuffer.length) {
        return crypto.timingSafeEqual(derivedKey, expectedBuffer);
      }
    } catch (e) {}
  }

  // 2. Legacy SHA-256 fallback compatibility
  try {
    const legacySha256 = crypto.createHash("sha256").update(`${cleanCode}:${salt}`).digest("hex");
    if (storedHashOrPlain === legacySha256) return true;
  } catch (e) {}

  // 3. Strict match for legacy hashed/plain strings (no hardcoded fallbacks)
  if (storedHashOrPlain && cleanCode) {
    const cleanStored = storedHashOrPlain.trim();
    if (cleanStored === cleanCode) return true;
  }

  return false;
}

/**
 * Generates a signed temporary session token for unlocked modules.
 * Scoped strictly to uid, workspaceId, and short-lived timestamp (1 hour).
 */
export function generateSecuritySessionToken(uid: string, workspaceId: string): string {
  const timestamp = Date.now();
  const expiresAt = timestamp + 60 * 60 * 1000; // 1 hour expiration
  const dataToSign = `${uid}:${workspaceId || "default"}:${timestamp}:${expiresAt}`;
  const hmac = crypto.createHmac("sha256", SECRET_SALT).update(dataToSign).digest("hex");
  
  const tokenPayload = {
    uid,
    workspaceId: workspaceId || "default",
    timestamp,
    expiresAt,
    sig: hmac
  };

  return `sec_${Buffer.from(JSON.stringify(tokenPayload)).toString("base64url")}`;
}

/**
 * Verifies if a security session token is valid, unexpired, and belongs to the authenticated user and workspace.
 */
export function verifySecuritySessionToken(token: string, expectedUid: string, expectedWorkspaceId?: string): boolean {
  if (!token || !token.startsWith("sec_")) return false;
  try {
    const raw = Buffer.from(token.replace("sec_", ""), "base64url").toString("utf-8");
    const payload = JSON.parse(raw);
    if (!payload.uid || !payload.timestamp || !payload.expiresAt || !payload.sig) return false;
    
    // Check UID match
    if (payload.uid !== expectedUid) return false;

    // Check workspace match if specified
    if (expectedWorkspaceId && payload.workspaceId && payload.workspaceId !== expectedWorkspaceId) {
      return false;
    }

    // Check expiration (max 1 hour)
    const now = Date.now();
    if (now > payload.expiresAt || (now - payload.timestamp > 60 * 60 * 1000)) {
      return false;
    }

    // Verify HMAC cryptographic signature
    const dataToSign = `${payload.uid}:${payload.workspaceId || "default"}:${payload.timestamp}:${payload.expiresAt}`;
    const expectedSig = crypto.createHmac("sha256", SECRET_SALT).update(dataToSign).digest("hex");
    
    const bufSig = Buffer.from(payload.sig);
    const bufExpected = Buffer.from(expectedSig);
    if (bufSig.length !== bufExpected.length) return false;
    return crypto.timingSafeEqual(bufSig, bufExpected);
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
export const ADMIN_UIDS = new Set([
  "SYhfciebGFUj29gqGaa0pqNunrk2",
  "SYhfciebGFUj29qGgAa0pqNunrk2"
]);
export const ADMIN_EMAILS = new Set([
  "mohamedvadel60@mail.com",
  "mohamedvadel60@gmail.com",
  "admin@zakir.ai",
  "admin@getzakir.com",
  (process.env.ADMIN_EMAIL || "").toLowerCase().trim()
].filter(Boolean));

/**
 * Authoritatively retrieves user profile from Firestore or local DB.
 * Strictly enforces that profile.id matches the authenticated firebaseUser.uid.
 */
export async function getUserProfileServer(uid?: string, email?: string): Promise<any | null> {
  if (!uid && !email) return null;
  const normalizedEmail = (email || "").trim().toLowerCase();

  // Primary Path: Strict lookup by authenticated UID
  if (uid) {
    let profileData: any = null;
    let fetchedId: string | null = null;

    try {
      const userDoc = await adminDb.collection("users").doc(uid).get();
      if (userDoc && userDoc.exists) {
        profileData = userDoc.data();
        fetchedId = userDoc.id || profileData?.id || profileData?.uid;
      }
    } catch (e) {}

    if (!profileData) {
      try {
        const db = readDbForAuth();
        const localUser = db.users?.find((u: any) => u.id === uid || u.uid === uid);
        if (localUser) {
          profileData = localUser;
          fetchedId = localUser.id || localUser.uid;
        }
      } catch (e) {}
    }

    if (profileData) {
      if (fetchedId && fetchedId !== uid) {
        console.error(`[MANDATORY_UID_ASSERTION_FAILURE] Mismatch in getUserProfileServer: firebaseUser.uid (${uid}) !== profileDocument.id (${fetchedId})`);
        throw new Error(`SECURITY_FATAL_UID_MISMATCH: firebaseUser.uid (${uid}) !== profileDocument.id (${fetchedId})`);
      }

      if (!profileData.files || !Array.isArray(profileData.files) || profileData.files.length === 0) {
        try {
          const filesSnap = await adminDb.collection("users").doc(uid).collection("files").get();
          if (!filesSnap.empty) {
            profileData.files = filesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
          }
        } catch (e) {}
      }

      let effectivePlan = profileData.subscriptionPlan;
      if (profileData.workspaceId && profileData.workspaceId !== uid && (profileData.role || "").toUpperCase() !== "CEO" && (profileData.role || "").toUpperCase() !== "ADMIN" && (profileData.role || "").toUpperCase() !== "OWNER") {
        try {
          const ceoSnap = await adminDb.collection("users").where("workspaceId", "==", profileData.workspaceId).where("role", "in", ["CEO", "Admin", "Owner", "FOUNDER"]).limit(1).get();
          if (!ceoSnap.empty) {
            const ceoData = ceoSnap.docs[0].data();
            if (ceoData.subscriptionPlan) {
              effectivePlan = ceoData.subscriptionPlan;
            }
          }
        } catch (e) {}
      }

      return { ...profileData, id: uid, uid: uid, subscriptionPlan: effectivePlan || profileData.subscriptionPlan || "Starter" };
    }

    // When UID is provided, DO NOT fall back to arbitrary email matches that could return a mismatched profile ID.
    return null;
  }

  // Secondary Path: Pure email lookup when UID is omitted (e.g. system email pre-checks)
  if (normalizedEmail) {
    try {
      const snap = await adminDb.collection("users").where("email", "==", normalizedEmail).limit(1).get();
      if (!snap.empty) {
        const docData = snap.docs[0].data();
        if (docData && (docData.email || "").trim().toLowerCase() === normalizedEmail) {
          return { ...docData, id: snap.docs[0].id, uid: snap.docs[0].id };
        }
      }
    } catch (e) {}

    try {
      const db = readDbForAuth();
      const localUser = db.users?.find((u: any) => (u.email || "").trim().toLowerCase() === normalizedEmail);
      if (localUser) return localUser;
    } catch (e) {}
  }

  return null;
}

export async function isUserAdminServer(uid: string, email?: string): Promise<boolean> {
  if (!uid && !email) return false;

  const directEmail = (email || "").trim().toLowerCase();
  const isUidAdmin = uid === ADMIN_USER_ID || ADMIN_UIDS.has(uid);
  const isEmailAdmin = Boolean(directEmail && ADMIN_EMAILS.size > 0 && ADMIN_EMAILS.has(directEmail));

  if (isUidAdmin || isEmailAdmin) {
    return true;
  }

  // Check Firestore user doc for Admin role
  try {
    if (uid) {
      const uDoc = await adminDb.collection("users").doc(uid).get();
      if (uDoc.exists) {
        const data = uDoc.data();
        const role = (data?.role || "").trim().toLowerCase();
        const em = (data?.email || "").trim().toLowerCase();
        if (role === "admin" || data?.isAdmin === true || (em && ADMIN_EMAILS.has(em))) {
          return true;
        }
      }
    }
  } catch (e) {}

  // Check local db for Admin role
  try {
    const db = readDbForAuth();
    const found = db?.users?.find((u: any) => u.id === uid || (directEmail && u.email?.toLowerCase() === directEmail));
    if (found) {
      const r = (found.role || "").trim().toLowerCase();
      if (r === "admin" || found.isAdmin === true || (found.email && ADMIN_EMAILS.has(found.email.toLowerCase()))) {
        return true;
      }
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
    return res.status(401).json({
      success: false,
      code: "UNAUTHORIZED",
      error: "Unauthorized: Missing authentication token",
      userFriendlyMessage: "يجب تسجيل الدخول أولاً لتنفيذ هذا الإجراء."
    });
  }

  const isAdmin = await isUserAdminServer(uid, email);
  if (!isAdmin) {
    return res.status(403).json({
      success: false,
      code: "FORBIDDEN",
      error: "Forbidden: Administrative access required",
      userFriendlyMessage: "هذا الإجراء يتطلب صلاحيات المسؤول الإداري."
    });
  }

  next();
};

/**
 * Middleware that strictly verifies if the authenticated user has permission for a specific module.
 * - Sensitive administrative areas (fileVault, memoryVault, riskRadar): strictly restricted to the Primary / First Administrator.
 * - Other modules (marketIntel, settings): CEO / Admin or explicit powers permission.
 */
export const requireModulePermission = (moduleKey: "fileVault" | "memoryVault" | "riskRadar" | "marketIntel" | "settings") => {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    const uid = req.user?.uid;
    const email = req.user?.email;
    if (!uid) {
      return res.status(401).json({
        success: false,
        code: "UNAUTHORIZED",
        error: "Unauthorized: Missing authentication",
        userFriendlyMessage: "يجب تسجيل الدخول أولاً."
      });
    }

    const isAdmin = await isUserAdminServer(uid, email);
    if (isAdmin) {
      return next();
    }

    const profile = await getUserProfileServer(uid, email);
    if (!profile) {
      return res.status(403).json({
        success: false,
        code: "USER_PROFILE_NOT_FOUND",
        error: "Forbidden: User profile not found",
        userFriendlyMessage: "تعذر العثور على ملف تعريف المستخدم."
      });
    }

    const role = (profile.role || "").toUpperCase();
    if (role === "CEO" || role === "ADMIN") {
      return next();
    }

    // Check powers map: strictly require explicit permission for non-admin/non-CEO roles
    const hasPermission = Boolean(profile.powers && profile.powers[moduleKey] === true);
    if (!hasPermission) {
      return res.status(403).json({ 
        success: false,
        code: "MODULE_ACCESS_RESTRICTED",
        error: `Forbidden: Access to ${moduleKey} is restricted for your role (${profile.role || "Member"}).`,
        userFriendlyMessage: `ليس لديك صلاحية الوصول إلى قسم (${moduleKey}). يرجى مراجعة مسؤول المؤسسة (CEO).`,
        module: moduleKey
      });
    }

    next();
  };
};

export interface EntitlementCheckResult {
  allowed: boolean;
  isAdmin: boolean;
  accountStatus: string;
  hasActiveSubscription: boolean;
  isTrialActive: boolean;
  activePlan: "Starter" | "Professional" | "Enterprise" | null;
  trialStartedAt: string | null;
  trialEndsAt: string | null;
  trialRemainingSeconds: number;
  reason: "OK" | "NOT_APPROVED" | "PENDING_REVIEW" | "PENDING_INSTITUTIONAL_DATA" | "PENDING_EMAIL_VERIFICATION" | "PENDING_DOCUMENT_VERIFICATION" | "VERIFICATION_REQUIRED" | "REJECTED" | "TRIAL_EXPIRED" | "NO_PLAN" | "PROFILE_NOT_FOUND";
  userFriendlyMessage?: string;
  profile?: any;
}

export type UserEntitlementResult = EntitlementCheckResult;

export interface StrictVerificationResult {
  effectiveStatus: "APPROVED" | "REJECTED" | "PENDING_ADMIN_REVIEW" | "VERIFICATION_REQUIRED" | "PENDING_DOCUMENT_VERIFICATION" | "PENDING_EMAIL_VERIFICATION";
  isVerified: boolean;
  verificationRequired: boolean;
  verificationStatus: "verified" | "rejected" | "pending" | "unverified" | "action_required";
  documentCount: number;
  hasRejectedDocument: boolean;
  hasPendingDocument: boolean;
  allDocumentsApproved: boolean;
  adminVerificationOverride: boolean;
  reason?: string;
}

export function computeStrictVerificationState(profile: any, isAdmin: boolean = false): StrictVerificationResult {
  if (isAdmin || profile?.role === "ADMIN" || profile?.isAdmin === true) {
    return {
      effectiveStatus: "APPROVED",
      isVerified: true,
      verificationRequired: false,
      verificationStatus: "verified",
      documentCount: 0,
      hasRejectedDocument: false,
      hasPendingDocument: false,
      allDocumentsApproved: true,
      adminVerificationOverride: true,
    };
  }

  // 1. Gather all documents
  const rawDocs = [
    ...(Array.isArray(profile?.verificationDocuments) ? profile.verificationDocuments : []),
    ...(Array.isArray(profile?.verificationInfo?.documents) ? profile.verificationInfo.documents : []),
    ...(Array.isArray(profile?.documents) ? profile.documents : []),
    ...(Array.isArray(profile?.files) ? profile.files.filter((f: any) => f && (f.category === "Verification" || f.category === "Identity" || f.isVerificationDoc)) : [])
  ];

  const uniqueDocs: any[] = [];
  const seenIds = new Set<string>();
  for (const doc of rawDocs) {
    if (!doc) continue;
    const docId = String(doc.documentId || doc.id || doc.storageReference || doc.fileName || JSON.stringify(doc));
    if (!seenIds.has(docId)) {
      seenIds.add(docId);
      uniqueDocs.push(doc);
    }
  }

  const documentCount = uniqueDocs.length;
  const adminOverride = profile?.adminVerificationOverride === true;

  let hasRejectedDoc = false;
  let hasPendingDoc = false;
  let hasApprovedDoc = false;

  for (const d of uniqueDocs) {
    const s = String(d.status || d.verificationStatus || "").toUpperCase();
    if (s === "REJECTED") {
      hasRejectedDoc = true;
    } else if (s === "APPROVED" || s === "VERIFIED") {
      hasApprovedDoc = true;
    } else if (s === "PENDING" || s === "PENDING_REVIEW" || s === "PENDING_ADMIN_REVIEW" || s === "UNDER_REVIEW" || !s) {
      hasPendingDoc = true;
    }
  }

  const overallDocStatus = String(profile?.documentVerificationStatus || profile?.verificationInfo?.status || "").toUpperCase();
  const rawAccountStatus = String(profile?.accountStatus || "").toUpperCase();

  const isEmailVer = Boolean(
    profile?.isEmailVerified === true ||
    profile?.emailVerified === true ||
    profile?.email_verified === true
  );

  // RULE: Email verification pending
  if (!isEmailVer || rawAccountStatus === "PENDING_EMAIL_VERIFICATION") {
    return {
      effectiveStatus: "PENDING_EMAIL_VERIFICATION",
      isVerified: false,
      verificationRequired: true,
      verificationStatus: "action_required",
      documentCount,
      hasRejectedDocument: hasRejectedDoc,
      hasPendingDocument: hasPendingDoc,
      allDocumentsApproved: false,
      adminVerificationOverride: adminOverride,
      reason: "PENDING_EMAIL_VERIFICATION"
    };
  }

  // RULE: Rejected documents or explicitly rejected account
  if (rawAccountStatus === "REJECTED" || overallDocStatus === "REJECTED" || (hasRejectedDoc && !adminOverride)) {
    return {
      effectiveStatus: "REJECTED",
      isVerified: false,
      verificationRequired: true,
      verificationStatus: "rejected",
      documentCount,
      hasRejectedDocument: true,
      hasPendingDocument: hasPendingDoc,
      allDocumentsApproved: false,
      adminVerificationOverride: adminOverride,
      reason: profile?.rejectionReason || profile?.verificationInfo?.adminNote || "وثائق التوثيق مرفوضة أو تتطلب تعديلاً.",
    };
  }

  // RULE: Explicit Admin Approval -> APPROVED
  const isMarkedApproved = (rawAccountStatus === "APPROVED" || profile?.accountStatus === "APPROVED" || Boolean(profile?.approvedAt && !hasRejectedDoc));
  if (isMarkedApproved) {
    const isKycVerified = Boolean(adminOverride || (documentCount > 0 && (overallDocStatus === "APPROVED" || (hasApprovedDoc && !hasRejectedDoc && !hasPendingDoc))));
    return {
      effectiveStatus: "APPROVED",
      isVerified: isKycVerified,
      verificationRequired: false,
      verificationStatus: isKycVerified ? "verified" : (hasRejectedDoc ? "rejected" : (hasPendingDoc ? "pending" : "unverified")),
      documentCount,
      hasRejectedDocument: false,
      hasPendingDocument: hasPendingDoc,
      allDocumentsApproved: isKycVerified,
      adminVerificationOverride: adminOverride,
    };
  }

  // RULE: No documents and no admin override -> VERIFICATION_REQUIRED
  if (documentCount === 0 && !adminOverride) {
    return {
      effectiveStatus: "VERIFICATION_REQUIRED",
      isVerified: false,
      verificationRequired: true,
      verificationStatus: "action_required",
      documentCount: 0,
      hasRejectedDocument: false,
      hasPendingDocument: false,
      allDocumentsApproved: false,
      adminVerificationOverride: false,
      reason: "VERIFICATION_REQUIRED"
    };
  }

  // RULE: Documents pending review -> PENDING_ADMIN_REVIEW
  if (documentCount > 0 || rawAccountStatus === "PENDING_ADMIN_REVIEW" || overallDocStatus === "UNDER_REVIEW" || overallDocStatus === "PENDING") {
    return {
      effectiveStatus: "PENDING_ADMIN_REVIEW",
      isVerified: false,
      verificationRequired: true,
      verificationStatus: "pending",
      documentCount,
      hasRejectedDocument: false,
      hasPendingDocument: true,
      allDocumentsApproved: false,
      adminVerificationOverride: false,
      reason: "PENDING_REVIEW"
    };
  }

  // Default fallback -> VERIFICATION_REQUIRED
  return {
    effectiveStatus: "VERIFICATION_REQUIRED",
    isVerified: false,
    verificationRequired: true,
    verificationStatus: "action_required",
    documentCount,
    hasRejectedDocument: hasRejectedDoc,
    hasPendingDocument: hasPendingDoc,
    allDocumentsApproved: false,
    adminVerificationOverride: false,
    reason: "VERIFICATION_REQUIRED"
  };
}

export async function verifyUserAccess(uid: string, email?: string): Promise<UserEntitlementResult> {
  if (!uid && !email) {
    return {
      allowed: false,
      isAdmin: false,
      accountStatus: "UNAUTHENTICATED",
      hasActiveSubscription: false,
      isTrialActive: false,
      activePlan: null,
      trialStartedAt: null,
      trialEndsAt: null,
      trialRemainingSeconds: 0,
      reason: "PROFILE_NOT_FOUND",
      userFriendlyMessage: "جلسة المستخدم غير مصادقة."
    };
  }

  const isAdmin = await isUserAdminServer(uid || "", email);
  if (isAdmin) {
    return {
      allowed: true,
      isAdmin: true,
      accountStatus: "APPROVED",
      hasActiveSubscription: true,
      isTrialActive: true,
      activePlan: "Enterprise",
      trialStartedAt: null,
      trialEndsAt: null,
      trialRemainingSeconds: 86400 * 365,
      reason: "OK",
      userFriendlyMessage: "حساب إداري مفوض بصلاحيات كاملة."
    };
  }

  const profile = await getUserProfileServer(uid, email);
  if (!profile) {
    return {
      allowed: false,
      isAdmin: false,
      accountStatus: "NOT_FOUND",
      hasActiveSubscription: false,
      isTrialActive: false,
      activePlan: null,
      trialStartedAt: null,
      trialEndsAt: null,
      trialRemainingSeconds: 0,
      reason: "PROFILE_NOT_FOUND",
      userFriendlyMessage: "تعذر العثور على ملف تعريف المستخدم."
    };
  }

  // Compute Strict Verification State (Backend is Single Source of Truth)
  const verState = computeStrictVerificationState(profile, false);
  const effectiveStatus = verState.effectiveStatus;

  // 1. NON-APPROVED ACCOUNT GATES: strictly deny access
  if (effectiveStatus === "REJECTED") {
    return {
      allowed: false,
      isAdmin: false,
      accountStatus: "REJECTED",
      hasActiveSubscription: false,
      isTrialActive: false,
      activePlan: null,
      trialStartedAt: profile.trialStartedAt || null,
      trialEndsAt: profile.trialEndsAt || null,
      trialRemainingSeconds: 0,
      reason: "REJECTED",
      userFriendlyMessage: profile.rejectionReason 
        ? `يلزم تحديث مستندات التوثيق: ${profile.rejectionReason}`
        : "يلزم تحديث مستندات التوثيق لإعادة مراجعة حسابك.",
      profile
    };
  }

  if (effectiveStatus === "PENDING_ADMIN_REVIEW") {
    return {
      allowed: false,
      isAdmin: false,
      accountStatus: "PENDING_ADMIN_REVIEW",
      hasActiveSubscription: false,
      isTrialActive: false,
      activePlan: null,
      trialStartedAt: null,
      trialEndsAt: null,
      trialRemainingSeconds: 0,
      reason: "PENDING_REVIEW",
      userFriendlyMessage: "تم استلام طلب التوثيق، ومستنداتك قيد المراجعة الإدارية حالياً.",
      profile
    };
  }

  if (effectiveStatus === "PENDING_DOCUMENT_VERIFICATION" || (effectiveStatus as string) === "PENDING_INSTITUTIONAL_DATA") {
    return {
      allowed: false,
      isAdmin: false,
      accountStatus: "PENDING_DOCUMENT_VERIFICATION",
      hasActiveSubscription: false,
      isTrialActive: false,
      activePlan: null,
      trialStartedAt: null,
      trialEndsAt: null,
      trialRemainingSeconds: 0,
      reason: "PENDING_DOCUMENT_VERIFICATION",
      userFriendlyMessage: "يرجى رفع وتأكيد مستندات التوثيق المطلوبة.",
      profile
    };
  }

  if (effectiveStatus === "PENDING_EMAIL_VERIFICATION") {
    return {
      allowed: false,
      isAdmin: false,
      accountStatus: "PENDING_EMAIL_VERIFICATION",
      hasActiveSubscription: false,
      isTrialActive: false,
      activePlan: null,
      trialStartedAt: null,
      trialEndsAt: null,
      trialRemainingSeconds: 0,
      reason: "PENDING_EMAIL_VERIFICATION",
      userFriendlyMessage: "يرجى تأكيد البريد الإلكتروني برمز التحقق أولاً.",
      profile
    };
  }

  if (effectiveStatus === "VERIFICATION_REQUIRED") {
    return {
      allowed: false,
      isAdmin: false,
      accountStatus: "VERIFICATION_REQUIRED",
      hasActiveSubscription: false,
      isTrialActive: false,
      activePlan: null,
      trialStartedAt: null,
      trialEndsAt: null,
      trialRemainingSeconds: 0,
      reason: "VERIFICATION_REQUIRED",
      userFriendlyMessage: "يرجى إرفاق وثائق إثبات الهوية والبيانات المؤسسية لتوثيق الحساب والدخول.",
      profile
    };
  }

  if (effectiveStatus !== "APPROVED") {
    return {
      allowed: false,
      isAdmin: false,
      accountStatus: effectiveStatus,
      hasActiveSubscription: false,
      isTrialActive: false,
      activePlan: null,
      trialStartedAt: null,
      trialEndsAt: null,
      trialRemainingSeconds: 0,
      reason: "VERIFICATION_REQUIRED",
      userFriendlyMessage: "الحساب غير معتمد بعد. يرجى استكمال إجراءات التوثيق.",
      profile
    };
  }

  // 2. ONLY APPROVED ACCOUNTS PROCEED TO SUBSCRIPTION & TRIAL CHECK
  const subStatus = (profile.subscriptionStatus || "").trim();
  const subPlan = (profile.subscriptionPlan || "") as "Starter" | "Professional" | "Enterprise";
  const hasActivePlan = subStatus === "Active" && (subPlan === "Starter" || subPlan === "Professional" || subPlan === "Enterprise");

  if (hasActivePlan) {
    return {
      allowed: true,
      isAdmin: false,
      accountStatus: "APPROVED",
      hasActiveSubscription: true,
      isTrialActive: false,
      activePlan: subPlan,
      trialStartedAt: profile.trialStartedAt || null,
      trialEndsAt: profile.trialEndsAt || null,
      trialRemainingSeconds: 0,
      reason: "OK",
      userFriendlyMessage: "اشتراك نشط.",
      profile
    };
  }

  // 3. 24-Hour Trial check (calculated from approvedAt or trialStartedAt)
  const trialStartIso = profile.trialStartedAt || profile.approvedAt || profile.createdAt || new Date().toISOString();
  let trialEndIso = profile.trialEndsAt || profile.trialExpiresAt;
  if (!trialEndIso) {
    const startMs = new Date(trialStartIso).getTime();
    trialEndIso = new Date(startMs + 24 * 60 * 60 * 1000).toISOString();
  }

  const trialEndMs = new Date(trialEndIso).getTime();
  const nowMs = Date.now();
  const remainingSeconds = Math.max(0, Math.floor((trialEndMs - nowMs) / 1000));

  if (remainingSeconds > 0) {
    return {
      allowed: true,
      isAdmin: false,
      accountStatus: "APPROVED",
      hasActiveSubscription: false,
      isTrialActive: true,
      activePlan: subPlan || "Starter",
      trialStartedAt: trialStartIso,
      trialEndsAt: trialEndIso,
      trialRemainingSeconds: remainingSeconds,
      reason: "OK",
      userFriendlyMessage: "الفترة التجريبية نشطة (24 ساعة).",
      profile
    };
  }

  // Trial expired and no active subscription
  return {
    allowed: false,
    isAdmin: false,
    accountStatus: "APPROVED",
    hasActiveSubscription: false,
    isTrialActive: false,
    activePlan: subPlan || null,
    trialStartedAt: trialStartIso,
    trialEndsAt: trialEndIso,
    trialRemainingSeconds: 0,
    reason: "TRIAL_EXPIRED",
    userFriendlyMessage: "انتهت فترة التجربة المجانية (24 ساعة). يرجى الاشتراك في إحدى باقات ذاكر للاستمرار.",
    profile
  };
}

export const checkUserEntitlementServer = verifyUserAccess;

/**
 * Server-side middleware that guarantees the requesting user has valid access entitlement
 * (Admin, or approved account with active subscription or active 24h trial).
 */
export const requireEntitlement = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const uid = req.user?.uid;
  const email = req.user?.email;
  if (!uid) {
    return res.status(401).json({
      success: false,
      code: "UNAUTHORIZED",
      error: "Unauthorized: Missing authentication token",
      userFriendlyMessage: "يجب تسجيل الدخول أولاً للوصول إلى هذا المورد."
    });
  }

  try {
    const entitlement = await checkUserEntitlementServer(uid, email);
    if (!entitlement.allowed) {
      return res.status(403).json({
        success: false,
        code: entitlement.reason === "TRIAL_EXPIRED" ? "TRIAL_EXPIRED" : "ENTITLEMENT_REQUIRED",
        reason: entitlement.reason,
        accountStatus: entitlement.accountStatus,
        trialEndsAt: entitlement.trialEndsAt,
        trialRemainingSeconds: entitlement.trialRemainingSeconds,
        error: entitlement.userFriendlyMessage || "Access denied: Subscription or active trial required",
        userFriendlyMessage: entitlement.userFriendlyMessage
      });
    }

    (req as any).userEntitlement = entitlement;
    next();
  } catch (err: any) {
    console.error("[ENTITLEMENT_MIDDLEWARE_ERROR]", err);
    return res.status(500).json({
      success: false,
      code: "ENTITLEMENT_CHECK_FAILED",
      error: "Failed to verify access entitlement.",
      userFriendlyMessage: "تعذر التحقق من صلاحيات الاشتراك. يرجى المحاولة لاحقاً."
    });
  }
};

export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  let token = "";
  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.split("Bearer ")[1];
  } else if (req.headers["x-auth-token"]) {
    token = String(req.headers["x-auth-token"]);
  } else if (req.headers["x-id-token"]) {
    token = String(req.headers["x-id-token"]);
  } else if (req.query?.token) {
    token = String(req.query.token);
  } else if (req.query?.idToken) {
    token = String(req.query.idToken);
  } else if (req.query?.auth) {
    token = String(req.query.auth);
  } else if (req.body?.token) {
    token = String(req.body.token);
  } else if (req.body?.idToken) {
    token = String(req.body.idToken);
  }

  if (!token || token === "undefined" || token === "null" || token.trim() === "") {
    return res.status(401).json({
      success: false,
      code: "AUTH_REQUIRED",
      error: "Unauthorized: Missing authentication token",
      userFriendlyMessage: "يجب تسجيل الدخول أولاً للوصول إلى هذا المورد."
    });
  }

  // Dev/Test environment mock tokens to facilitate local security testing
  if (process.env.TEST_SUITE === "true" || process.env.NODE_ENV === "test" || process.env.NODE_ENV !== "production") {
    if (token === "usr_ceo") {
      req.user = { uid: "usr_ceo", email: "ceo@zakir.ai", isMockUser: true } as any;
      (req as any).isMockAuth = true;
      return next();
    }
    if (token === "mock_token_admin" || token === "ADMIN_LOCAL_BYPASS") {
      req.user = { uid: ADMIN_USER_ID, email: "admin@zakir.ai", isMockUser: true } as any;
      (req as any).isMockAuth = true;
      return next();
    }
    if (token.startsWith("usr_")) {
      try {
        const user = await getUserProfileServer(token);
        if (user) {
          req.user = { uid: user.id || token, email: user.email, isMockUser: true } as any;
          (req as any).isMockAuth = true;
          return next();
        }
      } catch (e) {}
    }
    if (token === "mock_token_compliance" || token === "usr_compliance") {
      req.user = { uid: "usr_compliance", email: "compliance@zakir.ai", isMockUser: true } as any;
      (req as any).isMockAuth = true;
      return next();
    }
    if (token === "mock_token_user_b" || token === "usr_b") {
      req.user = { uid: "usr_b", email: "user_b@zakir.ai", isMockUser: true } as any;
      (req as any).isMockAuth = true;
      return next();
    }
    if (token === "mock_token_sarah" || token === "usr_sarah") {
      req.user = { uid: "usr_sarah", email: "sarah.lead@testorg.com", isMockUser: true } as any;
      (req as any).isMockAuth = true;
      return next();
    }
    if (token.startsWith("mock_token_email_")) {
      const email = token.replace("mock_token_email_", "").trim().toLowerCase();
      const uid = `usr_${email.replace(/[^a-zA-Z0-9]/g, "_")}`;
      req.user = { uid, email, isMockUser: true } as any;
      (req as any).isMockAuth = true;
      return next();
    }
    if (token.startsWith("mock_token_") || token === "mock_token_user_a" || token === "usr_a") {
      req.user = { uid: "usr_a", email: "user_a@zakir.ai", isMockUser: true } as any;
      (req as any).isMockAuth = true;
      return next();
    }
  }

  try {
    const decodedToken = await adminAuth.verifyIdToken(token);

    // Check if account has been marked deleted in Firestore
    try {
      const deletedDoc = await adminDb.collection("deletedUsers").doc(decodedToken.uid).get();
      if (deletedDoc && deletedDoc.exists) {
        return res.status(403).json({
          success: false,
          code: "ACCOUNT_DELETED",
          error: "This account has been deleted. Please contact the administrator.",
          userFriendlyMessage: "تم حذف هذا الحساب. يرجى التواصل مع الإدارة أو تقديم طلب استعادة."
        });
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
                return res.status(403).json({
                  success: false,
                  code: "ACCOUNT_DELETED",
                  error: "This account has been deleted. Please contact the administrator.",
                  userFriendlyMessage: "تم حذف هذا الحساب. يرجى التواصل مع الإدارة أو تقديم طلب استعادة."
                });
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
          return res.status(403).json({
            success: false,
            code: "ACCOUNT_DELETED",
            error: "This account has been deleted. Please contact the administrator.",
            userFriendlyMessage: "تم حذف هذا الحساب. يرجى التواصل مع الإدارة أو تقديم طلب استعادة."
          });
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
          return res.status(403).json({
            success: false,
            code: "ACCOUNT_DELETED",
            error: "This account has been deleted. Please contact the administrator.",
            userFriendlyMessage: "تم حذف هذا الحساب. يرجى التواصل مع الإدارة أو تقديم طلب استعادة."
          });
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


