import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signInWithCustomToken,
  signOut, 
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithPopup,
  GoogleAuthProvider,
  User as FirebaseUser 
} from "firebase/auth";
import { 
  doc, 
  setDoc, 
  getDoc, 
  collection, 
  getDocs, 
  addDoc, 
  deleteDoc, 
  updateDoc,
  query, 
  where,
  limit,
  orderBy,
  getDocFromServer,
  onSnapshot
} from "firebase/firestore";
import { 
  ref, 
  uploadBytes, 
  getDownloadURL, 
  deleteObject 
} from "firebase/storage";
import { auth, db, storage } from "../firebase.js";
import { authenticatedFetch, safeJsonResponse, sanitizeBaseUrl } from "./apiUtils.js";
import {
  LoginError,
  LoginErrorCode,
  logLoginTrace,
  normalizeLoginError,
  isNetworkException,
  formatLoginErrorMessage
} from "./authErrors.js";
export {
  LoginError,
  normalizeLoginError,
  formatLoginErrorMessage
};
export type { LoginErrorCode };
import { 
  normalizeUserDocuments, 
  computeCanonicalVerification, 
  UnifiedDocument, 
  UnifiedDocumentsResult,
  CanonicalVerificationDetails,
  CanonicalVerificationState
} from "./unifiedVerification.js";
export { normalizeUserDocuments, computeCanonicalVerification };
export type { UnifiedDocument, UnifiedDocumentsResult, CanonicalVerificationDetails, CanonicalVerificationState };
import { 
  User, 
  AccountStatus,
  Memory, 
  RiskAlert, 
  UserFile, 
  UserRole, 
  UserPreferences, 
  WorkspaceInfo,
  ModulePermissions,
  TeamMember,
  VerificationInfo
} from "../types.js";

// ================= FIRESTORE ERROR HANDLING INTERFACES =================

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

// Global flags tracking if Firestore connection is offline or quota exceeded
export let isFirestoreOffline = false;
export let isFirestoreQuotaExceeded = false;

export const isOfflineOrQuotaError = (err: unknown): boolean => {
  if (!err) return false;
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  return (
    msg.includes('offline') ||
    msg.includes('network') ||
    msg.includes('unavailable') ||
    msg.includes('quota') ||
    msg.includes('resource-exhausted') ||
    msg.includes('free daily read units')
  );
};

// Helpers to read/write JSON from localStorage
const getLocalItem = <T = any>(key: string, defaultVal: any = null): T => {
  try {
    const val = localStorage.getItem(`offline_db_${key}`);
    return val ? JSON.parse(val) : defaultVal;
  } catch {
    return defaultVal;
  }
};

const setLocalItem = (key: string, value: any) => {
  try {
    localStorage.setItem(`offline_db_${key}`, JSON.stringify(value));
  } catch (e) {
    console.warn("localStorage quota or write error:", e);
  }
};

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errMessage = error instanceof Error ? error.message : String(error);
  
  const errInfo: FirestoreErrorInfo = {
    error: errMessage,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };

  const isOfflineOrQuota = isOfflineOrQuotaError(error);
  if (isOfflineOrQuota) {
    isFirestoreOffline = true;
    if (errMessage.toLowerCase().includes('quota') || errMessage.toLowerCase().includes('resource-exhausted') || errMessage.toLowerCase().includes('free daily read units')) {
      isFirestoreQuotaExceeded = true;
      console.warn('Firestore free daily quota reached. Seamlessly utilizing local offline cache storage.');
    } else {
      console.warn('Firestore is operating in offline fallback mode:', errMessage);
    }
    return;
  }

  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw error;
}

// Validate connection to Firestore on initial boot
function testConnection() {
  if (typeof navigator !== 'undefined' && navigator.onLine) {
    isFirestoreOffline = false;
  }
}
testConnection();

// System Default Preferences for New User Onboarding
export const DEFAULT_USER_PREFERENCES: UserPreferences = {
  theme: "dark",
  language: "ar",
  emailNotifications: true,
  riskRadarAlerts: true,
  autoSaveMemories: true,
  defaultView: "overview"
};

// Helper: Convert File to Base64 Data URL (Fallback for Storage)
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });
}

// Format byte size to human readable format
export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Executes a Firestore getDoc with retry and exponential backoff to handle
 * transient auth propagation latency (permission denied errors immediately after login).
 */
export async function getDocWithRetry(docRef: any, maxRetries = 5, initialDelay = 200): Promise<any> {
  let delay = initialDelay;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await getDoc(docRef);
    } catch (err: any) {
      const errStr = err instanceof Error ? err.message : String(err);
      const isPermissionError =
        errStr.toLowerCase().includes("permission") ||
        errStr.toLowerCase().includes("denied") ||
        errStr.toLowerCase().includes("unauthenticated") ||
        err?.code === "permission-denied";

      if (isPermissionError && i < maxRetries - 1) {
        console.warn(`[Firestore getDoc retry] Permission/auth latency encountered, refreshing token and retrying in ${delay}ms (attempt ${i + 1}/${maxRetries})...`);
        try {
          if (auth.currentUser) {
            await auth.currentUser.getIdToken(true);
          }
        } catch (tErr) {}
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2;
        continue;
      }
      throw err;
    }
  }
}

/* ================= AUTHENTICATION & USER PROFILE ================= */

/**
 * Scenario 1: New User Onboarding
 * - Generates a new Workspace and a unique User ID.
 * - Sets Subscription Plan status to "Free Tier" (Default/Free Tier).
 * - Sets Preferences, toggles, and notifications to System Default Values.
 */
export async function registerFirebaseUser(
  email: string,
  pass: string,
  companyName: string,
  ownerName: string,
  role: UserRole = "CEO",
  invitedWorkspaceId?: string,
  invitedWorkspace?: WorkspaceInfo,
  powers?: ModulePermissions
): Promise<User> {
  const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
  const uid = userCredential.user.uid;

  isFirestoreOffline = false; // Auth succeeded, reset offline flag!

  const userDocRef = doc(db, "users", uid);

  // Check if profile was already created by authoritative server endpoint (/api/auth/register)
  try {
    const existingSnap = await getDocWithRetry(userDocRef);
    if (existingSnap && existingSnap.exists()) {
      const existingData = existingSnap.data() as User;
      setLocalItem(`user_${uid}`, existingData);
      return existingData;
    }
  } catch (e) {
    console.warn("Notice: Checking existing user doc in registerFirebaseUser:", e);
  }

  let workspaceId = invitedWorkspaceId;
  let workspace = invitedWorkspace;

  if (!workspaceId) {
    workspaceId = `ws_${uid.substring(0, 8)}_${Date.now().toString(36)}`;
    workspace = {
      id: workspaceId,
      name: `${companyName} Workspace`,
      ownerId: uid,
      createdAt: new Date().toISOString(),
      memberCount: 1
    };
  }

  // 2. Initialize new user profile with selected role (defaulting to CEO for workspace owners)
  const effectiveRole: UserRole = role || "CEO";
  const nowIso = new Date().toISOString();
  const newUser: User = {
    id: uid,
    email: email,
    companyName: companyName,
    ownerName: ownerName,
    role: effectiveRole,
    powers: powers,
    workspaceId: workspaceId,
    workspace: workspace,
    subscriptionStatus: "Pending Selection",
    userPreferences: { ...DEFAULT_USER_PREFERENCES },
    createdAt: nowIso,
    trialExpiresAt: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
    lastActiveAt: nowIso,
    lastLoginAt: nowIso,
    isVerified: false,
    isEmailVerified: false,
    email_verified: false,
    emailVerified: false,
    accountStatus: "PENDING_EMAIL_VERIFICATION",
    requiresDocumentVerification: true,
    documentVerificationStatus: "PENDING_EMAIL_VERIFICATION",
    verification_required: true,
    verification_status: "unverified"
  };

  // Keep in localStorage first
  setLocalItem(`user_${uid}`, newUser);

  // 3. Store new user document under /users/{uid} in Firestore
  try {
    await setDoc(userDocRef, newUser);
  } catch (error) {
    // If setDoc failed (e.g. race condition where server created profile concurrently), retry reading doc
    try {
      const retrySnap = await getDocWithRetry(userDocRef);
      if (retrySnap && retrySnap.exists()) {
        const retryData = retrySnap.data() as User;
        setLocalItem(`user_${uid}`, retryData);
        return retryData;
      }
    } catch (rErr) {
      console.warn("Retry fetch failed in registerFirebaseUser:", rErr);
    }
    if (isOfflineOrQuotaError(error)) {
      isFirestoreOffline = true;
    } else {
      handleFirestoreError(error, OperationType.CREATE, `users/${uid}`);
    }
  }

  return newUser;
}

export function clearUserLocalCache(userId?: string): void {
  try {
    if (typeof window !== "undefined") {
      if (typeof localStorage !== "undefined") {
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && (
            key.startsWith("user_") ||
            key.startsWith("offline_db_") ||
            key.startsWith("zakir_current_user") ||
            key.startsWith("zakir_auth_token") ||
            key.startsWith("zakir_user_") ||
            key === "user" ||
            key === "currentUser"
          )) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach((k) => localStorage.removeItem(k));
        localStorage.removeItem("pending_owner_name");
      }

      if (typeof sessionStorage !== "undefined") {
        const sessionKeysToRemove: string[] = [];
        for (let i = 0; i < sessionStorage.length; i++) {
          const key = sessionStorage.key(i);
          if (key && (
            key.startsWith("auto_sent_otp_") ||
            key.startsWith("zakir_")
          )) {
            sessionKeysToRemove.push(key);
          }
        }
        sessionKeysToRemove.forEach((k) => sessionStorage.removeItem(k));
      }
    }
  } catch (e) {
    console.warn("clearUserLocalCache error:", e);
  }
}

/**
 * Scenario 2: Existing User Login
 * - Fetches user profile from /users/{uid} in Firestore.
 * - Restores persisted workspace, custom preferences, subscription status, and configurations.
 */
export async function loginFirebaseUser(email: string, pass: string, attemptId?: string): Promise<User> {
  const normalizedEmail = email.trim().toLowerCase();
  const currentAttemptId = attemptId || `login_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  let clientAuthError: any = null;
  let clientUid: string | null = null;

  logLoginTrace("LOGIN_ATTEMPT_START", {
    attemptId: currentAttemptId,
    email: normalizedEmail
  });

  // 1. Try client Firebase Auth first
  try {
    const userCredential = await signInWithEmailAndPassword(auth, normalizedEmail, pass);
    clientUid = userCredential.user.uid;
    try {
      await userCredential.user.getIdToken();
    } catch (tErr) {
      console.warn("Notice: getIdToken resolution in loginFirebaseUser:", tErr);
    }
    isFirestoreOffline = false;
    logLoginTrace("LOGIN_FIREBASE_RESULT", {
      attemptId: currentAttemptId,
      email: normalizedEmail,
      success: true
    });
  } catch (authErr: any) {
    clientAuthError = authErr;
    const fbCode = authErr?.code || "";
    logLoginTrace("LOGIN_FIREBASE_RESULT", {
      attemptId: currentAttemptId,
      email: normalizedEmail,
      firebaseErrorCode: fbCode,
      success: false
    });

    // Deterministic early exits for non-credential client errors & lifecycle checks:
    if (
      fbCode === "auth/user-disabled" ||
      fbCode === "auth/invalid-credential" ||
      fbCode === "auth/wrong-password" ||
      fbCode === "auth/user-not-found" ||
      fbCode === "auth/invalid-login-credentials"
    ) {
      try {
        const resolution = await resolveAccountState(normalizedEmail);
        if (resolution && resolution.accountState && resolution.accountState.startsWith("DELETED_ACCOUNT")) {
          throw new LoginError("LOGIN_SELF_DELETED", resolution.userFriendlyMessage || "تم العثور على حسابك المحذوف سابقاً، وهو متاح للاستعادة.", {
            originalCode: "SELF_RESTORE_AVAILABLE",
            email: normalizedEmail,
            daysRemaining: resolution.daysRemaining ?? 31,
            restoreUntil: resolution.restoreUntil,
            hasRecoveryRequest: resolution.hasRecoveryRequest,
            recoveryStatus: resolution.recoveryStatus,
            recoveryRequestId: resolution.recoveryRequestId,
            accountState: resolution.accountState,
            initialTab: resolution.hasRecoveryRequest ? "status" : "request",
            isExpired: resolution.isExpired,
            statusCode: 403,
            attemptId: currentAttemptId
          });
        }
        if (resolution && resolution.isExpired) {
          throw new LoginError("LOGIN_INVALID_CREDENTIALS", "انتهت فترة سماح استعادة هذا الحساب (31 يوماً). تم حذف البيانات بشكل نهائي ولم يعد قابلاً للاستعادة.", {
            originalCode: "RESTORE_EXPIRED",
            email: normalizedEmail,
            statusCode: 403,
            attemptId: currentAttemptId
          });
        }
      } catch (lcErr) {
        if (lcErr instanceof LoginError) throw lcErr;
      }
    }

    if (fbCode === "auth/user-disabled") {
      throw new LoginError("LOGIN_USER_DISABLED", "User account is disabled.", {
        originalCode: fbCode,
        email: normalizedEmail,
        attemptId: currentAttemptId
      });
    }

    if (
      fbCode === "auth/invalid-credential" ||
      fbCode === "auth/wrong-password" ||
      fbCode === "auth/user-not-found" ||
      fbCode === "auth/invalid-login-credentials"
    ) {
      throw new LoginError("LOGIN_INVALID_CREDENTIALS", "بيانات الدخول غير صحيحة. يرجى التحقق من البريد الإلكتروني وكلمة المرور.", {
        originalCode: fbCode,
        email: normalizedEmail,
        attemptId: currentAttemptId
      });
    }
    if (fbCode === "auth/too-many-requests") {
      throw new LoginError("LOGIN_TOO_MANY_REQUESTS", "Too many requests.", {
        originalCode: fbCode,
        attemptId: currentAttemptId
      });
    }
    if (fbCode === "auth/unauthorized-domain") {
      throw new LoginError("LOGIN_UNAUTHORIZED_DOMAIN", "Domain unauthorized.", {
        originalCode: fbCode,
        attemptId: currentAttemptId
      });
    }
  }

  // 2. If client authentication succeeded, try Firestore retrieval
  if (clientUid) {
    const uid = clientUid;

    // Check if account was marked deleted in account state resolution or /deletedUsers/{uid}
    try {
      const resolution = await resolveAccountState(normalizedEmail);
      if (resolution && resolution.accountState && resolution.accountState.startsWith("DELETED_ACCOUNT")) {
        await signOut(auth);
        clearUserLocalCache(uid);
        throw new LoginError("LOGIN_SELF_DELETED", resolution.userFriendlyMessage || "تم العثور على حسابك المحذوف سابقاً، وهو متاح للاستعادة.", {
          originalCode: "SELF_RESTORE_AVAILABLE",
          email: normalizedEmail,
          daysRemaining: resolution.daysRemaining ?? 31,
          restoreUntil: resolution.restoreUntil,
          hasRecoveryRequest: resolution.hasRecoveryRequest,
          recoveryStatus: resolution.recoveryStatus,
          recoveryRequestId: resolution.recoveryRequestId,
          accountState: resolution.accountState,
          initialTab: resolution.hasRecoveryRequest ? "status" : "request",
          isExpired: resolution.isExpired,
          statusCode: 403,
          attemptId: currentAttemptId
        });
      }

      const deletedSnap = await getDocWithRetry(doc(db, "deletedUsers", uid), 2, 150);
      if (deletedSnap && deletedSnap.exists()) {
        await signOut(auth);
        clearUserLocalCache(uid);
        throw new LoginError("LOGIN_SELF_DELETED", "تم العثور على حسابك المحذوف سابقاً، وهو متاح للاستعادة.", {
          originalCode: "SELF_RESTORE_AVAILABLE",
          email: normalizedEmail,
          daysRemaining: 31,
          attemptId: currentAttemptId
        });
      }
    } catch (dErr: any) {
      if (dErr instanceof LoginError) throw dErr;
      if (dErr.message?.includes("deleted") || dErr.message?.includes("حذف")) {
        throw new LoginError("LOGIN_SELF_DELETED", dErr.message, {
          originalCode: "SELF_RESTORE_AVAILABLE",
          email: normalizedEmail,
          daysRemaining: 31,
          attemptId: currentAttemptId
        });
      }
      console.warn("Notice: Verifying account status in /deletedUsers/ encountered non-fatal error:", uid, dErr);
    }

    // Retrieve user document from /users/{uid}
    const userDocRef = doc(db, "users", uid);
    let userSnap;
    try {
      userSnap = await getDocWithRetry(userDocRef, 4, 200);
    } catch (error) {
      console.warn("Notice: getDocWithRetry error for userDocRef in loginFirebaseUser:", uid, error);
    }

    if (userSnap && userSnap.exists()) {
      const userData = userSnap.data() as User;
      userData.id = uid;
      const nowIso = new Date().toISOString();
      userData.lastActiveAt = nowIso;
      userData.lastLoginAt = nowIso;

      const breakdown = computeUserVerificationBreakdown(userData);
      const isEmailVer = Boolean(
        userData.isEmailVerified === true ||
        userData.emailVerified === true ||
        userData.email_verified === true
      );
      if (isEmailVer) {
        userData.isEmailVerified = true;
        userData.email_verified = true;
        userData.emailVerified = true;
      }
      
      const isKycVerified = breakdown.kycStatus === "VERIFIED";
      userData.isVerified = isKycVerified;
      userData.kycStatus = breakdown.kycStatus;
      userData.documentVerificationStatus = breakdown.documentStatus;
      userData.verification_status = isKycVerified ? "verified" : (breakdown.kycStatus === "UNDER_REVIEW" ? "pending" : (breakdown.kycStatus === "REJECTED" ? "rejected" : "unverified"));
      userData.verification_required = !isKycVerified;

      if (!userData.userPreferences) {
        userData.userPreferences = { ...DEFAULT_USER_PREFERENCES };
      }
      if (!userData.subscriptionStatus) {
        userData.subscriptionStatus = "Active";
      }

      try {
        await updateDoc(userDocRef, {
          lastActiveAt: nowIso,
          lastLoginAt: nowIso
        });
      } catch (e) {}

      if (isUserAdmin(userData)) {
        userData.isVerified = true;
        userData.kycStatus = "VERIFIED";
        userData.documentVerificationStatus = "APPROVED";
        userData.isEmailVerified = true;
        userData.email_verified = true;
        userData.emailVerified = true;
        userData.verification_required = false;
        userData.verification_status = "verified";
      }

      setLocalItem(`user_${uid}`, userData);
      return userData;
    }
  }

  // 3. Resilient Authoritative Server-backed Login (resolves rules latency, missing docs, or client SDK blocks)
  try {
    const url = getAuthApiUrl("/api/auth/login");
    const srvRes = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: normalizedEmail, password: pass })
    });
    
    const srvData = await safeJsonResponse(srvRes);

    if (srvRes.ok && srvData && (srvData.user || srvData.id)) {
      const authenticatedUser: User = srvData.user || srvData;
      const serverBreakdown = computeUserVerificationBreakdown(authenticatedUser);
      const isServerKycVerified = serverBreakdown.kycStatus === "VERIFIED";
      authenticatedUser.isVerified = isServerKycVerified;
      authenticatedUser.kycStatus = serverBreakdown.kycStatus;
      authenticatedUser.documentVerificationStatus = serverBreakdown.documentStatus;
      authenticatedUser.verification_status = isServerKycVerified ? "verified" : (serverBreakdown.kycStatus === "UNDER_REVIEW" ? "pending" : (serverBreakdown.kycStatus === "REJECTED" ? "rejected" : "unverified"));
      authenticatedUser.verification_required = !isServerKycVerified;

      if (isUserAdmin(authenticatedUser)) {
        authenticatedUser.isVerified = true;
        authenticatedUser.kycStatus = "VERIFIED";
        authenticatedUser.documentVerificationStatus = "APPROVED";
        authenticatedUser.isEmailVerified = true;
        authenticatedUser.email_verified = true;
        authenticatedUser.emailVerified = true;
        authenticatedUser.verification_required = false;
        authenticatedUser.verification_status = "verified";
      }
      logLoginTrace("LOGIN_SERVER_RESULT", {
        attemptId: currentAttemptId,
        email: normalizedEmail,
        serverHttpStatus: srvRes.status,
        success: true
      });

      // Synchronize client Firebase Auth session with custom token if not authenticated
      if (srvData.customToken && !auth.currentUser) {
        try {
          await signInWithCustomToken(auth, srvData.customToken);
        } catch (ctErr) {
          console.warn("Notice: signInWithCustomToken sync notice:", ctErr);
        }
      }

      setLocalItem(`user_${authenticatedUser.id}`, authenticatedUser);
      return authenticatedUser;
    }

    // Server error responses classified deterministically
    const serverStatus = srvRes.status;
    const serverCode = srvData?.code || srvData?.error || "";
    logLoginTrace("LOGIN_SERVER_RESULT", {
      attemptId: currentAttemptId,
      email: normalizedEmail,
      serverHttpStatus: serverStatus,
      serverErrorCode: serverCode,
      success: false
    });

    if (serverCode === "SELF_RESTORE_AVAILABLE" || srvData?.error === "SELF_RESTORE_AVAILABLE") {
      throw new LoginError("LOGIN_SELF_DELETED", srvData?.message || "Self deleted account found", {
        originalCode: "SELF_RESTORE_AVAILABLE",
        email: normalizedEmail,
        daysRemaining: srvData?.daysRemaining ?? 31,
        restoreUntil: srvData?.restoreUntil,
        statusCode: 403,
        attemptId: currentAttemptId
      });
    }

    if (serverStatus === 429 || serverCode === "TOO_MANY_REQUESTS" || serverCode === "auth/too-many-requests") {
      throw new LoginError("LOGIN_TOO_MANY_REQUESTS", "Too many requests", {
        originalCode: serverCode || "TOO_MANY_REQUESTS",
        statusCode: 429,
        attemptId: currentAttemptId
      });
    }

    if (
      serverStatus === 403 ||
      serverCode === "auth/user-disabled" ||
      serverCode === "USER_DISABLED" ||
      serverCode === "ADMIN_DELETED_BLOCKED"
    ) {
      try {
        const resolution = await resolveAccountState(normalizedEmail);
        if (resolution && resolution.accountState && resolution.accountState.startsWith("DELETED_ACCOUNT")) {
          throw new LoginError("LOGIN_SELF_DELETED", resolution.userFriendlyMessage || "Account deleted, restoration available", {
            originalCode: "SELF_RESTORE_AVAILABLE",
            email: normalizedEmail,
            daysRemaining: resolution.daysRemaining ?? 31,
            restoreUntil: resolution.restoreUntil,
            hasRecoveryRequest: resolution.hasRecoveryRequest,
            recoveryStatus: resolution.recoveryStatus,
            recoveryRequestId: resolution.recoveryRequestId,
            accountState: resolution.accountState,
            initialTab: resolution.hasRecoveryRequest ? "status" : "request",
            isExpired: resolution.isExpired,
            statusCode: 403,
            attemptId: currentAttemptId
          });
        }
      } catch (lcErr) {
        if (lcErr instanceof LoginError) throw lcErr;
      }
      throw new LoginError("LOGIN_USER_DISABLED", srvData?.message || "User disabled", {
        originalCode: serverCode || "auth/user-disabled",
        email: normalizedEmail,
        statusCode: 403,
        attemptId: currentAttemptId
      });
    }

    if (serverCode === "auth/user-not-found" || serverCode === "EMAIL_NOT_FOUND" || serverCode === "USER_NOT_FOUND") {
      try {
        const resolution = await resolveAccountState(normalizedEmail);
        if (resolution && resolution.accountState && resolution.accountState.startsWith("DELETED_ACCOUNT")) {
          throw new LoginError("LOGIN_SELF_DELETED", resolution.userFriendlyMessage || "Account deleted, restoration available", {
            originalCode: "SELF_RESTORE_AVAILABLE",
            email: normalizedEmail,
            daysRemaining: resolution.daysRemaining ?? 31,
            restoreUntil: resolution.restoreUntil,
            hasRecoveryRequest: resolution.hasRecoveryRequest,
            recoveryStatus: resolution.recoveryStatus,
            recoveryRequestId: resolution.recoveryRequestId,
            accountState: resolution.accountState,
            initialTab: resolution.hasRecoveryRequest ? "status" : "request",
            isExpired: resolution.isExpired,
            statusCode: 403,
            attemptId: currentAttemptId
          });
        }
      } catch (lcErr) {
        if (lcErr instanceof LoginError) throw lcErr;
      }
      throw new LoginError("LOGIN_USER_NOT_FOUND", srvData?.message || "User not found", {
        originalCode: serverCode,
        statusCode: 401,
        attemptId: currentAttemptId
      });
    }

    if (
      serverStatus === 401 ||
      serverCode === "auth/invalid-credential" ||
      serverCode === "INVALID_CREDENTIALS"
    ) {
      try {
        const resolution = await resolveAccountState(normalizedEmail);
        if (resolution && resolution.accountState && resolution.accountState.startsWith("DELETED_ACCOUNT")) {
          throw new LoginError("LOGIN_SELF_DELETED", resolution.userFriendlyMessage || "Account deleted, restoration available", {
            originalCode: "SELF_RESTORE_AVAILABLE",
            email: normalizedEmail,
            daysRemaining: resolution.daysRemaining ?? 31,
            restoreUntil: resolution.restoreUntil,
            hasRecoveryRequest: resolution.hasRecoveryRequest,
            recoveryStatus: resolution.recoveryStatus,
            recoveryRequestId: resolution.recoveryRequestId,
            accountState: resolution.accountState,
            initialTab: resolution.hasRecoveryRequest ? "status" : "request",
            isExpired: resolution.isExpired,
            statusCode: 403,
            attemptId: currentAttemptId
          });
        }
      } catch (lcErr) {
        if (lcErr instanceof LoginError) throw lcErr;
      }
      throw new LoginError("LOGIN_INVALID_CREDENTIALS", "Invalid credentials", {
        originalCode: serverCode || "auth/invalid-credential",
        statusCode: 401,
        attemptId: currentAttemptId
      });
    }

    if (serverStatus >= 500) {
      // If client already established invalid credentials, keep invalid credentials
      if (
        clientAuthError?.code === "auth/invalid-credential" ||
        clientAuthError?.code === "auth/invalid-login-credentials" ||
        clientAuthError?.code === "auth/wrong-password"
      ) {
        throw new LoginError("LOGIN_INVALID_CREDENTIALS", "Invalid credentials", {
          originalCode: clientAuthError.code,
          attemptId: currentAttemptId
        });
      }
      throw new LoginError("LOGIN_SERVER_ERROR", "Server error", {
        originalCode: serverCode || "SERVER_ERROR",
        statusCode: serverStatus,
        attemptId: currentAttemptId
      });
    }

    const norm = normalizeLoginError({
      firebaseError: clientAuthError,
      serverResponse: srvData,
      httpStatus: serverStatus
    });
    throw new LoginError(norm, "Authentication failed", {
      originalCode: serverCode || (clientAuthError ? clientAuthError.code : undefined),
      statusCode: serverStatus,
      attemptId: currentAttemptId
    });
  } catch (srvErr: any) {
    if (srvErr instanceof LoginError) {
      throw srvErr;
    }

    // Fetch threw a network error
    if (isNetworkException(srvErr)) {
      if (
        clientAuthError?.code === "auth/invalid-credential" ||
        clientAuthError?.code === "auth/invalid-login-credentials" ||
        clientAuthError?.code === "auth/wrong-password"
      ) {
        throw new LoginError("LOGIN_INVALID_CREDENTIALS", "Invalid credentials", {
          originalCode: clientAuthError.code,
          attemptId: currentAttemptId
        });
      }
      throw new LoginError("LOGIN_NETWORK_ERROR", "Network connection failed", {
        originalCode: "NETWORK_ERROR",
        attemptId: currentAttemptId
      });
    }

    // If client had a known error
    if (clientAuthError) {
      const norm = normalizeLoginError(clientAuthError);
      throw new LoginError(norm, clientAuthError.message, {
        originalCode: clientAuthError.code,
        attemptId: currentAttemptId
      });
    }

    const norm = normalizeLoginError(srvErr);
    throw new LoginError(norm, srvErr?.message || "Login failed", {
      attemptId: currentAttemptId
    });
  }

  // 4. Final safety guarantee
  if (clientAuthError) {
    const norm = normalizeLoginError(clientAuthError);
    throw new LoginError(norm, clientAuthError.message, {
      originalCode: clientAuthError.code,
      attemptId: currentAttemptId
    });
  }

  throw new LoginError("LOGIN_INVALID_CREDENTIALS", "Invalid credentials", {
    originalCode: "auth/invalid-credential",
    attemptId: currentAttemptId
  });
}

let isGoogleLoginRunning = false;

export async function loginWithGoogle(): Promise<User> {
  if (isGoogleLoginRunning) {
    throw new Error("عملية تسجيل الدخول قيد المعالجة حالياً. يرجى الانتظار...");
  }
  isGoogleLoginRunning = true;

  try {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    let userCredential: any;
    try {
      userCredential = await signInWithPopup(auth, provider);
    } catch (popupErr: any) {
      // If Firebase Auth threw assertion error or popup was cancelled
      const errMsg = popupErr?.message || "";
      const errCode = popupErr?.code || "";

      if (
        errCode === "auth/popup-closed-by-user" ||
        errCode === "auth/cancelled-popup-request" ||
        errCode === "auth/popup-blocked"
      ) {
        throw new Error("تم إغلاق نافذة تسجيل الدخول من قِبل المستخدم.");
      }

      // Check for internal assertion failed: Pending promise was never set
      if (
        errMsg.includes("Pending promise was never set") ||
        errCode === "auth/internal-error"
      ) {
        console.warn("Notice: Handled Firebase Auth assertion error during popup:", popupErr);
        if (auth.currentUser) {
          userCredential = { user: auth.currentUser };
        } else {
          throw new Error("تعذر إكمال المصادقة المنبثقة. يرجى إعادة المحاولة أو تسجيل الدخول بالبريد الإلكتروني وكلمة المرور.");
        }
      }

      if (!userCredential) {
        const errEmail = (popupErr?.customData?.email || popupErr?._tokenResponse?.email || "").trim().toLowerCase();
        if (errEmail) {
          try {
            const resolution = await resolveAccountState(errEmail);
            if (resolution && resolution.accountState && resolution.accountState.startsWith("DELETED_ACCOUNT")) {
              throw new LoginError("LOGIN_SELF_DELETED", resolution.userFriendlyMessage || "تم العثور على حسابك المحذوف سابقاً، وهو متاح للاستعادة.", {
                originalCode: "SELF_RESTORE_AVAILABLE",
                email: errEmail,
                daysRemaining: resolution.daysRemaining ?? 31,
                restoreUntil: resolution.restoreUntil,
                hasRecoveryRequest: resolution.hasRecoveryRequest,
                recoveryStatus: resolution.recoveryStatus,
                recoveryRequestId: resolution.recoveryRequestId,
                accountState: resolution.accountState,
                initialTab: resolution.hasRecoveryRequest ? "status" : "request",
                isExpired: resolution.isExpired
              });
            }
          } catch (checkErr) {
            if (checkErr instanceof LoginError || (checkErr as any).name === "LoginError") throw checkErr;
          }
        }
        throw popupErr;
      }
    }

    if (!userCredential || !userCredential.user) {
      if (auth.currentUser) {
        userCredential = { user: auth.currentUser };
      } else {
        throw new Error("لم يتم استلام بيانات المستخدم من Google.");
      }
    }

    const uid = userCredential.user.uid;
  const email = userCredential.user.email || "";
  const displayName = userCredential.user.displayName || email.split("@")[0];

  isFirestoreOffline = false;
  
  const normEmail = (email || "").trim().toLowerCase();
  if (normEmail) {
    try {
      const resolution = await resolveAccountState(normEmail);
      if (resolution && resolution.accountState && resolution.accountState.startsWith("DELETED_ACCOUNT")) {
        await signOut(auth);
        clearUserLocalCache(uid);
        throw new LoginError("LOGIN_SELF_DELETED", resolution.userFriendlyMessage || "تم العثور على حسابك المحذوف سابقاً، وهو متاح للاستعادة.", {
          originalCode: "SELF_RESTORE_AVAILABLE",
          email: normEmail,
          daysRemaining: resolution.daysRemaining ?? 31,
          restoreUntil: resolution.restoreUntil,
          hasRecoveryRequest: resolution.hasRecoveryRequest,
          recoveryStatus: resolution.recoveryStatus,
          recoveryRequestId: resolution.recoveryRequestId,
          accountState: resolution.accountState,
          initialTab: resolution.hasRecoveryRequest ? "status" : "request",
          isExpired: resolution.isExpired
        });
      }
    } catch (lcErr: any) {
      if (lcErr instanceof LoginError || lcErr.name === "LoginError") throw lcErr;
    }
  }

  // Check if account was marked deleted in /deletedUsers/{uid}
  try {
    const deletedSnap = await getDocWithRetry(doc(db, "deletedUsers", uid), 3, 200);
    if (deletedSnap && deletedSnap.exists()) {
      await signOut(auth);
      clearUserLocalCache(uid);
      throw new LoginError("LOGIN_SELF_DELETED", "تم العثور على حسابك المحذوف سابقاً، وهو متاح للاستعادة.", {
        originalCode: "SELF_RESTORE_AVAILABLE",
        email: normEmail,
        daysRemaining: 31
      });
    }
  } catch (dErr: any) {
    if (dErr instanceof LoginError || dErr.name === "LoginError") throw dErr;
    if (dErr.message?.includes("deleted") || dErr.message?.includes("حذف")) {
      await signOut(auth);
      clearUserLocalCache(uid);
      throw new LoginError("LOGIN_SELF_DELETED", dErr.message, {
        originalCode: "SELF_RESTORE_AVAILABLE",
        email: normEmail,
        daysRemaining: 31
      });
    }
    console.warn("Notice: /deletedUsers/ check in loginWithGoogle encountered non-fatal error:", uid, dErr);
  }

  const userDocRef = doc(db, "users", uid);
  let userSnap;
  try {
    userSnap = await getDoc(userDocRef);
  } catch (error) {
    if (isOfflineOrQuotaError(error)) {
      isFirestoreOffline = true;
    } else {
      const errMessage = error instanceof Error ? error.message : String(error);
      const isAuthPermissionError = errMessage.toLowerCase().includes("permission") || errMessage.toLowerCase().includes("denied") || errMessage.toLowerCase().includes("unauthenticated");
      if (isAuthPermissionError) {
        await signOut(auth);
        clearUserLocalCache(uid);
        throw new Error("Access denied: Insufficient permissions to access profile.");
      }
      handleFirestoreError(error, OperationType.GET, `users/${uid}`);
    }
  }

  if (userSnap && userSnap.exists()) {
    const userData = userSnap.data() as User;
    if (
      (userData as any).deleted === true ||
      (userData as any).status === "ADMIN_DELETED" ||
      (userData as any).status === "SELF_DELETED" ||
      (userData as any).accountLifecycleStatus === "SELF_DELETED"
    ) {
      await signOut(auth);
      clearUserLocalCache(uid);
      throw new LoginError("LOGIN_SELF_DELETED", "تم العثور على حسابك المحذوف سابقاً، وهو متاح للاستعادة.", {
        originalCode: "SELF_RESTORE_AVAILABLE",
        email: normEmail,
        daysRemaining: 31
      });
    }

    const nowIso = new Date().toISOString();
    userData.lastActiveAt = nowIso;
    userData.lastLoginAt = nowIso;
    if (!userData.userPreferences) {
      userData.userPreferences = { ...DEFAULT_USER_PREFERENCES };
    }
    
    try {
      await updateDoc(userDocRef, {
        lastActiveAt: nowIso,
        lastLoginAt: nowIso
      });
    } catch (e) {
      console.warn("Failed to update last login timestamp:", e);
    }
    
    setLocalItem(`user_${uid}`, userData);
    return userData;
  }

  // Secondary lookup by email in case doc ID differs
  try {
      if (email) {
        const emailQuery = query(collection(db, "users"), where("email", "==", email.trim().toLowerCase()), limit(1));
        const emailSnap = await getDocs(emailQuery);
        if (!emailSnap.empty) {
          const foundData = emailSnap.docs[0].data() as User;
          if (
            (foundData as any).deleted === true ||
            (foundData as any).status === "ADMIN_DELETED" ||
            (foundData as any).status === "SELF_DELETED" ||
            (foundData as any).accountLifecycleStatus === "SELF_DELETED"
          ) {
            await signOut(auth);
            clearUserLocalCache(uid);
            throw new LoginError("LOGIN_SELF_DELETED", "تم العثور على حسابك المحذوف سابقاً، وهو متاح للاستعادة.", {
              originalCode: "SELF_RESTORE_AVAILABLE",
              email: normEmail,
              daysRemaining: 31
            });
          }
          setLocalItem(`user_${uid}`, foundData);
          return foundData;
        }
      }
    } catch (e) {
      if (e instanceof LoginError || (e as any).name === "LoginError") throw e;
      console.warn("Notice: Secondary email lookup in loginWithGoogle failed:", e);
    }

    // Strictly verify if this Google email belongs to a deleted account before creating a new user
    if (normEmail) {
      try {
        const resolution = await resolveAccountState(normEmail);
        if (resolution && resolution.accountState && resolution.accountState.startsWith("DELETED_ACCOUNT")) {
          await signOut(auth);
          clearUserLocalCache(uid);
          throw new LoginError("LOGIN_SELF_DELETED", resolution.userFriendlyMessage || "Account deleted, restoration available", {
            originalCode: "SELF_RESTORE_AVAILABLE",
            email: normEmail,
            daysRemaining: resolution.daysRemaining ?? 31,
            restoreUntil: resolution.restoreUntil,
            hasRecoveryRequest: resolution.hasRecoveryRequest,
            recoveryStatus: resolution.recoveryStatus,
            recoveryRequestId: resolution.recoveryRequestId,
            accountState: resolution.accountState,
            initialTab: resolution.hasRecoveryRequest ? "status" : "request",
            isExpired: resolution.isExpired
          });
        }
      } catch (lcCheckErr) {
        if (lcCheckErr instanceof LoginError || (lcCheckErr as any).name === "LoginError") throw lcCheckErr;
      }
    }

    // New Google user: check if there is an active invitation for this email
    let invitation: WorkspaceInvitation | null = null;
    try {
      if (email) {
        invitation = await checkWorkspaceInvitation(email);
      }
    } catch (invErr) {
      console.warn("Notice: Invitation check in loginWithGoogle fallback:", invErr);
    }

    const effectiveRole: UserRole = invitation?.role || "CEO";
    const workspaceId = invitation?.workspaceId || `ws_${uid.substring(0, 8)}_${Date.now().toString(36)}`;
    const effectiveCompany = invitation?.companyName || "Personal Account";
    const workspaceInfo: WorkspaceInfo = invitation ? {
      id: invitation.workspaceId,
      name: `${invitation.companyName} Workspace`,
      ownerId: invitation.senderId,
      createdAt: invitation.createdAt || new Date().toISOString(),
      memberCount: 2
    } : {
      id: workspaceId,
      name: `${effectiveCompany} Workspace`,
      ownerId: uid,
      createdAt: new Date().toISOString(),
      memberCount: 1
    };

    const isSysAdmin = isUserAdmin({ id: uid, email, role: effectiveRole });
    const defaultUser: User = {
      id: uid,
      email: email,
      companyName: effectiveCompany,
      ownerName: displayName,
      role: effectiveRole,
      powers: invitation?.powers,
      workspaceId: workspaceId,
      workspace: workspaceInfo,
      subscriptionStatus: "Pending Selection",
      userPreferences: { ...DEFAULT_USER_PREFERENCES },
      createdAt: new Date().toISOString(),
      trialExpiresAt: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
      isVerified: isSysAdmin,
      isEmailVerified: true,
      email_verified: true,
      emailVerified: true,
      accountStatus: isSysAdmin ? "APPROVED" : "VERIFICATION_REQUIRED",
      documentVerificationStatus: isSysAdmin ? "APPROVED" : "NOT_SUBMITTED",
      kycStatus: isSysAdmin ? "VERIFIED" : "NOT_VERIFIED",
      verification_required: !isSysAdmin,
      verification_status: isSysAdmin ? "verified" : "unverified",
      verificationDocuments: []
    };
    
    try {
      await setDoc(userDocRef, defaultUser);
    } catch (error) {
      console.warn("Failed to save new Google user to Firestore:", error);
      try {
        const retrySnap = await getDoc(userDocRef);
        if (retrySnap && retrySnap.exists()) {
          const rData = retrySnap.data() as User;
          setLocalItem(`user_${uid}`, rData);
          return rData;
        }
      } catch (rErr) {
        console.warn("Retry fetch in loginWithGoogle failed:", rErr);
      }
    }
    
    setLocalItem(`user_${uid}`, defaultUser);
    return defaultUser;
  } finally {
    isGoogleLoginRunning = false;
  }
}

export async function logoutFirebaseUser(): Promise<void> {
  const uid = auth.currentUser?.uid;
  await signOut(auth);
  clearUserLocalCache(uid);
}

export function sanitizeFirestoreData(obj: any): any {
  if (obj === null || obj === undefined) return null;
  if (Array.isArray(obj)) {
    return obj.map(sanitizeFirestoreData);
  }
  if (typeof obj === "object" && !(obj instanceof Date)) {
    const cleaned: any = {};
    for (const key of Object.keys(obj)) {
      const val = obj[key];
      if (val !== undefined) {
        cleaned[key] = sanitizeFirestoreData(val);
      }
    }
    return cleaned;
  }
  return obj;
}

export async function saveFirebaseUserProfile(user: User): Promise<void> {
  if (!user.id) return;
  
  // Store in local storage first
  setLocalItem(`user_${user.id}`, user);

  const isCurrentCallerAdmin = isUserAdmin(auth.currentUser);
  if (!auth.currentUser || (!isCurrentCallerAdmin && auth.currentUser.uid !== user.id)) {
    console.warn("Skipping client Firestore profile update: User not authenticated as owner or admin.");
    return;
  }

  const userDocRef = doc(db, "users", user.id);

  // Check if non-admin user is trying to update protected organization/role fields
  const isCeoOrAdmin = (user.role || "").toUpperCase() === "CEO" || (user.role || "").toUpperCase() === "ADMIN";

  // Omit protected system fields that non-admin clients are not allowed to modify on update
  const {
    role,
    subscriptionPlan,
    trialExpiresAt,
    stripeSubscriptionId,
    subscriptionStatus,
    companyName,
    organizationName,
    workspaceId,
    workspace,
    powers,
    ...updatableProfile
  } = user;

  const sanitizedUser = sanitizeFirestoreData({
    ...updatableProfile,
    ...(isCeoOrAdmin ? {
      companyName,
      organizationName,
      workspaceId,
      workspace,
      powers
    } : {})
  });

  try {
    await setDoc(userDocRef, sanitizedUser, { merge: true });
    isFirestoreOffline = false; // Successfully connected!
  } catch (error) {
    if (isOfflineOrQuotaError(error)) {
      isFirestoreOffline = true;
    } else {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.id}`);
    }
  }

  // Also sync with server-side endpoint
  try {
    const token = await auth.currentUser?.getIdToken();
    if (token) {
      await fetch(getAuthApiUrl("/api/users/profile"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(user)
      });
    }
  } catch (syncErr) {}
}

export async function updateUserPreferences(userId: string, newPrefs: Partial<UserPreferences>): Promise<UserPreferences> {
  // Update local storage first
  const localUser = getLocalItem(`user_${userId}`, null);
  let currentPrefs = { ...DEFAULT_USER_PREFERENCES };
  if (localUser && localUser.userPreferences) {
    currentPrefs = { ...localUser.userPreferences };
  }
  const updatedPrefs = { ...currentPrefs, ...newPrefs };
  if (localUser) {
    localUser.userPreferences = updatedPrefs;
    setLocalItem(`user_${userId}`, localUser);
  }

  const userDocRef = doc(db, "users", userId);
  let userSnap;
  try {
    userSnap = await getDoc(userDocRef);
    isFirestoreOffline = false; // Successfully connected!
  } catch (error) {
    if (isOfflineOrQuotaError(error)) {
      isFirestoreOffline = true;
      return updatedPrefs;
    } else {
      handleFirestoreError(error, OperationType.GET, `users/${userId}`);
    }
  }
  
  try {
    await updateDoc(userDocRef, { userPreferences: updatedPrefs });
    isFirestoreOffline = false; // Successfully connected!
  } catch (error) {
    if (isOfflineOrQuotaError(error)) {
      isFirestoreOffline = true;
    } else {
      handleFirestoreError(error, OperationType.UPDATE, `users/${userId}`);
    }
  }
  return updatedPrefs;
}

export function normalizeStrictUserVerification(user: User): User {
  if (!user) return user;
  const isSysAdmin = isUserAdmin(user);
  const canonical = computeCanonicalVerification(user, isSysAdmin);

  user.isVerified = canonical.isFullyApproved;
  user.isEmailVerified = canonical.isEmailVerified;
  user.email_verified = canonical.isEmailVerified;
  user.emailVerified = canonical.isEmailVerified;
  user.accountStatus = canonical.accountStatus;
  user.documentVerificationStatus = canonical.documentVerificationStatus;
  user.kycStatus = canonical.kycStatus;
  user.verification_status = canonical.canonicalStatus === "approved" ? "verified" : (canonical.canonicalStatus === "rejected" ? "rejected" : (canonical.canonicalStatus === "pending" ? "under_review" : "unverified"));
  user.verification_required = canonical.canonicalStatus !== "approved";
  user.verificationDocuments = canonical.documents as any;
  (user as any).documents = canonical.documents;
  (user as any).documentCount = canonical.documentCount;
  (user as any).canonicalVerificationStatus = canonical.canonicalStatus;
  if (canonical.rejectionReason) {
    user.rejectionReason = canonical.rejectionReason;
  }
  return user;
}

export function subscribeToFirebaseAuthState(rawCallback: (user: User | null) => void) {
  const callback = (u: User | null) => {
    if (u) {
      normalizeStrictUserVerification(u);
    }
    rawCallback(u);
  };
  return onAuthStateChanged(auth, async (fbUser: FirebaseUser | null) => {
    if (!fbUser) {
      callback(null);
      return;
    }
    
    // If the browser reports being online, attempt to reset offline status and contact server
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      isFirestoreOffline = false;
    }

    try {
      // Ensure auth token is synchronized
      try {
        const idToken = await fbUser.getIdToken();
        if (idToken && typeof window !== "undefined") {
          localStorage.setItem("zakir_auth_token", idToken);
        }
      } catch (tErr) {
        console.warn("Notice: getIdToken resolution in subscribeToFirebaseAuthState:", tErr);
      }

      // Check account lifecycle and deletion state before proceeding
      if (fbUser.email) {
        try {
          const resolution = await resolveAccountState(fbUser.email);
          if (resolution && resolution.accountState && resolution.accountState.startsWith("DELETED_ACCOUNT")) {
            console.warn("subscribeToFirebaseAuthState: Detected deleted account for email:", fbUser.email);
            await signOut(auth);
            clearUserLocalCache(fbUser.uid);
            callback(null);
            return;
          }
        } catch (resErr) {
          console.warn("subscribeToFirebaseAuthState: account state check warning:", resErr);
        }
      }

      // Check if user account is marked deleted in /deletedUsers/{uid}
      try {
        const deletedSnap = await getDocWithRetry(doc(db, "deletedUsers", fbUser.uid), 3, 200);
        if (deletedSnap && deletedSnap.exists()) {
          console.warn("User account is marked as deleted in /deletedUsers/", fbUser.uid);
          await signOut(auth);
          clearUserLocalCache(fbUser.uid);
          callback(null);
          return;
        }
      } catch (dErr: any) {
        if (dErr.message?.includes("deleted") || dErr.message?.includes("حذف")) {
          await signOut(auth);
          clearUserLocalCache(fbUser.uid);
          callback(null);
          return;
        }
        console.warn("Notice: Verifying account status in /deletedUsers/ encountered non-fatal error in subscribeToFirebaseAuthState:", fbUser.uid, dErr);
      }

      let userSnap;
      try {
        userSnap = await getDocWithRetry(doc(db, "users", fbUser.uid), 5, 250);
        isFirestoreOffline = false; // Successfully connected!
      } catch (error) {
        if (isOfflineOrQuotaError(error)) {
          console.warn("Firestore offline or quota exceeded during auth state fetch.");
          isFirestoreOffline = true;
        } else {
          console.warn("Notice: getDocWithRetry error during auth state fetch:", fbUser.uid, error);
          const cached = getLocalItem<User>(`user_${fbUser.uid}`);
          if (cached) {
            callback(cached);
            return;
          }
        }
      }

      if (userSnap && userSnap.exists()) {
        const userObj = userSnap.data() as User;
        if (
          (userObj as any).deleted === true ||
          (userObj as any).status === "ADMIN_DELETED" ||
          (userObj as any).status === "SELF_DELETED" ||
          (userObj as any).accountLifecycleStatus === "SELF_DELETED"
        ) {
          console.warn("User profile marked as deleted in /users/:", fbUser.uid);
          await signOut(auth);
          clearUserLocalCache(fbUser.uid);
          callback(null);
          return;
        }

        const profileId = userObj.id || fbUser.uid;
        if (profileId !== fbUser.uid) {
          console.error(`[MANDATORY_UID_ASSERTION_FAILURE] Mismatch in subscribeToFirebaseAuthState: fbUser.uid (${fbUser.uid}) !== userObj.id (${profileId})`);
          throw new Error(`SECURITY_FATAL_UID_MISMATCH: fbUser.uid (${fbUser.uid}) !== userObj.id (${profileId})`);
        }
        const validatedUser = { ...userObj, id: fbUser.uid };
        const isSysAdmin = isUserAdmin(validatedUser);
        if (!isSysAdmin && (validatedUser.role === "Admin" || (validatedUser.role as string) === "admin")) {
          const isOwner = Boolean(validatedUser.workspace?.ownerId && validatedUser.workspace.ownerId === fbUser.uid) ||
                          Boolean(validatedUser.workspaceId && validatedUser.workspaceId.startsWith(`ws_${fbUser.uid.substring(0, 8)}`));
          validatedUser.role = isOwner ? "CEO" : "Contributor";
        }

        normalizeStrictUserVerification(validatedUser);
        setLocalItem(`user_${fbUser.uid}`, validatedUser);
        callback(validatedUser);
      } else {
        // Check if there is an active invitation for this email
        let invitation: WorkspaceInvitation | null = null;
        try {
          if (fbUser.email) {
            invitation = await checkWorkspaceInvitation(fbUser.email);
          }
        } catch (invErr) {
          console.warn("Notice: Invitation check in subscribeToFirebaseAuthState fallback:", invErr);
        }

        const effectiveRole: UserRole = invitation?.role || "CEO";
        const workspaceId = invitation?.workspaceId || `ws_${fbUser.uid.substring(0, 8)}_${Date.now().toString(36)}`;
        const effectiveCompany = invitation?.companyName || "Personal Account";
        const workspaceInfo: WorkspaceInfo = invitation ? {
          id: invitation.workspaceId,
          name: `${invitation.companyName} Workspace`,
          ownerId: invitation.senderId,
          createdAt: invitation.createdAt || new Date().toISOString(),
          memberCount: 2
        } : {
          id: workspaceId,
          name: `${effectiveCompany} Workspace`,
          ownerId: fbUser.uid,
          createdAt: new Date().toISOString(),
          memberCount: 1
        };

        let resolvedName = invitation?.name || "User";
        if (resolvedName === "User" && typeof localStorage !== "undefined") {
          const pending = localStorage.getItem("pending_owner_name");
          if (pending && pending.trim()) {
            resolvedName = pending.trim();
          }
        }
        if (resolvedName === "User" && fbUser.displayName) {
          resolvedName = fbUser.displayName;
        }
        if (resolvedName === "User" && fbUser.email) {
          resolvedName = fbUser.email.split("@")[0];
        }

        // Firestore is online and user profile does not exist: create default profile for this UID
        const defaultUser: User = {
          id: fbUser.uid,
          email: fbUser.email || "",
          companyName: effectiveCompany,
          ownerName: resolvedName,
          fullName: resolvedName,
          role: effectiveRole,
          powers: invitation?.powers,
          workspaceId: workspaceId,
          workspace: workspaceInfo,
          createdAt: new Date().toISOString(),
          trialExpiresAt: new Date(Date.now() + 24 * 3600 * 1000).toISOString()
        };
        try {
          await setDoc(doc(db, "users", fbUser.uid), defaultUser);
        } catch (e) {
          console.warn("Failed to create default profile in Firestore:", e);
        }
        setLocalItem(`user_${fbUser.uid}`, defaultUser);
        callback(defaultUser);
      }
    } catch (err) {
      console.warn("Notice: user profile fetch in subscribeToFirebaseAuthState:", err);

      // Fallback to local storage strictly by UID
      const localUser = fbUser ? getLocalItem(`user_${fbUser.uid}`, null) : null;
      if (localUser && (localUser.id === fbUser.uid || localUser.uid === fbUser.uid)) {
        callback({ ...localUser, id: fbUser.uid });
        return;
      }
      
      let resolvedFallbackName = "User";
      try {
        if (fbUser.email) {
          const fallbackInv = getLocalItem("invitations", []).find((i: any) => (i.email || "").trim().toLowerCase() === fbUser.email?.trim().toLowerCase());
          if (fallbackInv?.name) {
            resolvedFallbackName = fallbackInv.name;
          }
        }
      } catch (e) {}

      if (resolvedFallbackName === "User" && typeof localStorage !== "undefined") {
        const pending = localStorage.getItem("pending_owner_name");
        if (pending && pending.trim()) {
          resolvedFallbackName = pending.trim();
        }
      }
      if (resolvedFallbackName === "User" && fbUser.displayName) {
        resolvedFallbackName = fbUser.displayName;
      }
      if (resolvedFallbackName === "User" && fbUser.email) {
        resolvedFallbackName = fbUser.email.split("@")[0];
      }

      const fallbackRole: UserRole = "CEO";
      const isFallbackAdmin = fbUser.uid === ADMIN_USER_ID || (fbUser.email && ADMIN_EMAILS.includes(fbUser.email.toLowerCase().trim()));
      callback({
        id: fbUser.uid,
        email: fbUser.email || "",
        companyName: "Personal Account",
        ownerName: resolvedFallbackName,
        fullName: resolvedFallbackName,
        role: fallbackRole,
        createdAt: new Date().toISOString(),
        trialExpiresAt: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
        accountStatus: isFallbackAdmin ? "APPROVED" : "VERIFICATION_REQUIRED",
        isVerified: isFallbackAdmin,
        isEmailVerified: isFallbackAdmin,
        email_verified: isFallbackAdmin,
        emailVerified: isFallbackAdmin,
        verification_required: !isFallbackAdmin,
        verification_status: isFallbackAdmin ? "verified" : "unverified"
      });
    }
  });
}

/* ================= USER MEMORIES (FIRESTORE) ================= */

export async function fetchFirebaseUserMemories(userId: string): Promise<Memory[]> {
  const path = `users/${userId}/memories`;
  if (isFirestoreOffline) {
    return getLocalItem(`memories_${userId}`, []);
  }

  try {
    const memColRef = collection(db, "users", userId, "memories");
    const snap = await getDocs(memColRef);
    const list: Memory[] = [];
    snap.forEach((docSnap) => {
      list.push({ id: docSnap.id, ...docSnap.data() } as Memory);
    });
    setLocalItem(`memories_${userId}`, list);
    return list;
  } catch (err) {
    if (isOfflineOrQuotaError(err)) {
      isFirestoreOffline = true;
      console.warn("Loading memories from local storage cache (Firestore offline / quota limit reached).");
      return getLocalItem(`memories_${userId}`, []);
    }
    console.error("Failed to fetch memories from Firestore:", err);
    try {
      handleFirestoreError(err, OperationType.LIST, path);
    } catch {
      // Graceful fallback to cached storage
    }
    return getLocalItem(`memories_${userId}`, []);
  }
}

export async function addFirebaseUserMemory(userId: string, memoryData: Omit<Memory, "id">): Promise<Memory> {
  const path = `users/${userId}/memories`;
  const tempId = "mem_" + Date.now() + "_" + Math.random().toString(36).substr(2, 6);
  const newMemory: Memory = { id: tempId, ...memoryData };

  // Save to local storage first
  const currentMemories = getLocalItem(`memories_${userId}`, []);
  currentMemories.push(newMemory);
  setLocalItem(`memories_${userId}`, currentMemories);

  if (isFirestoreOffline) {
    return newMemory;
  }

  try {
    const memColRef = collection(db, "users", userId, "memories");
    const docRef = await addDoc(memColRef, memoryData);
    const savedMem: Memory = { id: docRef.id, ...memoryData };
    const updatedMemories = currentMemories.map(m => m.id === tempId ? savedMem : m);
    setLocalItem(`memories_${userId}`, updatedMemories);
    return savedMem;
  } catch (error) {
    if (isOfflineOrQuotaError(error)) {
      isFirestoreOffline = true;
      return newMemory;
    }
    handleFirestoreError(error, OperationType.CREATE, path);
    throw error;
  }
}

export async function deleteFirebaseUserMemory(userId: string, memoryId: string): Promise<void> {
  const path = `users/${userId}/memories/${memoryId}`;
  
  // Remove from local storage
  const currentMemories = getLocalItem(`memories_${userId}`, []);
  const updatedMemories = currentMemories.filter((m: Memory) => m.id !== memoryId);
  setLocalItem(`memories_${userId}`, updatedMemories);

  if (isFirestoreOffline) {
    return;
  }

  try {
    const docRef = doc(db, "users", userId, "memories", memoryId);
    await deleteDoc(docRef);
  } catch (error) {
    if (isOfflineOrQuotaError(error)) {
      isFirestoreOffline = true;
    } else {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  }
}

export async function updateFirebaseUserMemory(userId: string, memoryId: string, updatedData: Partial<Memory>): Promise<void> {
  const path = `users/${userId}/memories/${memoryId}`;
  
  // Update in local storage
  const currentMemories = getLocalItem(`memories_${userId}`, []);
  const updatedMemories = currentMemories.map((m: Memory) => m.id === memoryId ? { ...m, ...updatedData } : m);
  setLocalItem(`memories_${userId}`, updatedMemories);

  if (isFirestoreOffline) {
    return;
  }

  try {
    const docRef = doc(db, "users", userId, "memories", memoryId);
    await updateDoc(docRef, updatedData);
  } catch (err) {
    if (isOfflineOrQuotaError(err)) {
      isFirestoreOffline = true;
    } else {
      console.warn("Firestore update memory non-critical error:", err);
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  }
}

/* ================= USER FILE STORAGE & METADATA ================= */

export async function fetchFirebaseUserFiles(userId: string): Promise<UserFile[]> {
  if (isFirestoreOffline) {
    return getLocalItem(`files_${userId}`, []);
  }

  const listMap = new Map<string, UserFile>();

  // 1. Fetch from top-level /files collection
  try {
    const topColRef = collection(db, "files");
    const q = query(topColRef, where("userId", "==", userId));
    const snap = await getDocs(q);
    snap.forEach((docSnap) => {
      listMap.set(docSnap.id, { id: docSnap.id, ...docSnap.data() } as UserFile);
    });
  } catch (err) {
    console.warn("Top-level /files query fallback:", err);
    if (isOfflineOrQuotaError(err)) {
      isFirestoreOffline = true;
      return getLocalItem(`files_${userId}`, []);
    }
  }

  // 2. Fetch from /users/{userId}/files subcollection
  try {
    const filesColRef = collection(db, "users", userId, "files");
    const snap = await getDocs(filesColRef);
    snap.forEach((docSnap) => {
      if (!listMap.has(docSnap.id)) {
        listMap.set(docSnap.id, { id: docSnap.id, ...docSnap.data() } as UserFile);
      }
    });
  } catch (err) {
    console.warn("User subcollection files fetch error:", err);
  }

  // 3. Fetch verification documents stored in user profile document (/users/{userId})
  try {
    const userDocRef = doc(db, "users", userId);
    const userSnap = await getDoc(userDocRef);
    if (userSnap.exists()) {
      const userData = userSnap.data() as User;
      if (userData.verificationInfo?.documents) {
        for (const vDoc of userData.verificationInfo.documents) {
          if (!listMap.has(vDoc.id)) {
            listMap.set(vDoc.id, {
              id: vDoc.id,
              fileName: vDoc.fileName,
              fileUrl: vDoc.fileUrl,
              fileSize: 0,
              mimeType: vDoc.mimeType || (vDoc.fileName?.toLowerCase().endsWith(".pdf") ? "application/pdf" : "image/jpeg"),
              uploadDate: vDoc.uploadDate || new Date().toISOString(),
              userId: userId,
              category: "Verification",
              description: "Account Verification Document",
              storagePath: "",
              isEncrypted: false
            });
          }
        }
      }
    }
  } catch (err) {
    console.warn("User verification documents sync fetch error:", err);
  }

  const list = Array.from(listMap.values());
  const sorted = list.sort((a, b) => new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime());
  setLocalItem(`files_${userId}`, sorted);
  return sorted;
}

export async function uploadFirebaseUserFile(
  userId: string,
  file: File,
  category: string = "General",
  description: string = "",
  isEncrypted: boolean = false
): Promise<UserFile> {
  const fileId = "file_" + Date.now() + "_" + Math.random().toString(36).substr(2, 6);
  const storagePath = `users/${userId}/files/${fileId}_${file.name}`;
  
  let downloadUrl = "";

  // Attempt upload to Firebase Storage
  try {
    if (!isFirestoreOffline) {
      const storageRef = ref(storage, storagePath);
      await uploadBytes(storageRef, file);
      downloadUrl = await getDownloadURL(storageRef);
    } else {
      downloadUrl = await fileToBase64(file);
    }
  } catch (storageErr) {
    console.warn("Firebase Storage upload fallback to Data URL:", storageErr);
    downloadUrl = await fileToBase64(file);
  }

  const userFile: UserFile = {
    id: fileId,
    fileName: file.name,
    fileUrl: downloadUrl,
    fileSize: file.size,
    mimeType: file.type || "application/octet-stream",
    uploadDate: new Date().toISOString(),
    userId: userId,
    category: category,
    description: description,
    storagePath: storagePath,
    isEncrypted: isEncrypted
  };

  // Save to local storage
  const currentFiles = getLocalItem(`files_${userId}`, []);
  currentFiles.unshift(userFile);
  setLocalItem(`files_${userId}`, currentFiles);

  if (isFirestoreOffline) {
    return userFile;
  }

  // Firestore Metadata (Strictly Metadata ONLY: NEVER store Base64 Data URLs in Firestore!)
  const firestoreDoc: Record<string, any> = {
    id: fileId,
    fileName: file.name,
    fileSize: file.size,
    mimeType: file.type || "application/octet-stream",
    uploadDate: new Date().toISOString(),
    userId: userId,
    category: category,
    description: description,
    storagePath: storagePath,
    isEncrypted: isEncrypted,
    storageStatus: downloadUrl && !downloadUrl.startsWith("data:") ? "persisted_cloud" : "persisted_local",
    // Only store true HTTP/HTTPS download URLs in Firestore, NEVER binary Base64 Data URLs!
    fileUrl: downloadUrl && !downloadUrl.startsWith("data:") ? downloadUrl : "",
  };

  // 1. Save metadata in top-level Firestore collection: /files/{fileId}
  try {
    const topFileDocRef = doc(db, "files", fileId);
    await setDoc(topFileDocRef, firestoreDoc);
  } catch (topErr) {
    console.warn("Firestore top-level /files save error:", topErr);
    if (isOfflineOrQuotaError(topErr)) {
      isFirestoreOffline = true;
      return userFile;
    }
  }

  // 2. Save metadata in user's private Firestore subcollection: /users/{userId}/files/{fileId}
  const fileDocRef = doc(db, "users", userId, "files", fileId);
  try {
    await setDoc(fileDocRef, firestoreDoc);
  } catch (error) {
    if (isOfflineOrQuotaError(error)) {
      isFirestoreOffline = true;
    } else {
      handleFirestoreError(error, OperationType.CREATE, `users/${userId}/files/${fileId}`);
    }
  }

  return userFile;
}

export async function deleteFirebaseUserFile(userId: string, fileId: string, storagePath?: string): Promise<void> {
  // Remove from local storage
  const currentFiles = getLocalItem(`files_${userId}`, []);
  const updatedFiles = currentFiles.filter((f: UserFile) => f.id !== fileId);
  setLocalItem(`files_${userId}`, updatedFiles);

  if (isFirestoreOffline) {
    return;
  }

  // 1. Delete from top-level /files/{fileId}
  try {
    await deleteDoc(doc(db, "files", fileId));
  } catch (e) {
    console.warn("Delete top-level file error:", e);
  }

  // 2. Delete from /users/{userId}/files/{fileId}
  const path = `users/${userId}/files/${fileId}`;
  try {
    const docRef = doc(db, "users", userId, "files", fileId);
    await deleteDoc(docRef);
  } catch (error) {
    console.warn("Delete user subcollection file warning:", error);
  }

  // 3. Sync & remove from user's profile verificationDocuments, documents & verificationInfo
  try {
    const userDocRef = doc(db, "users", userId);
    const userSnap = await getDoc(userDocRef);
    if (userSnap.exists()) {
      const userData = userSnap.data() as any;
      const isSysAdmin = userData.role === "Admin" || (userData.email && ADMIN_EMAILS.includes(userData.email.toLowerCase()));

      const currentVerDocs = Array.isArray(userData.verificationDocuments) ? userData.verificationDocuments : [];
      const currentDocs = Array.isArray(userData.documents) ? userData.documents : [];
      const currentVerInfoDocs = Array.isArray(userData.verificationInfo?.documents) ? userData.verificationInfo.documents : [];

      const remainingVerDocs = currentVerDocs.filter((d: any) => (d.documentId || d.id || d.fileName) !== fileId);
      const remainingDocs = currentDocs.filter((d: any) => (d.documentId || d.id || d.fileName) !== fileId);
      const remainingVerInfoDocs = currentVerInfoDocs.filter((d: any) => (d.id || d.documentId || d.fileName) !== fileId);

      const totalRemaining = remainingVerDocs.length + remainingVerInfoDocs.length;
      const updates: Record<string, any> = {
        verificationDocuments: remainingVerDocs,
        documents: remainingDocs,
        "verificationInfo.documents": remainingVerInfoDocs
      };

      // AUTOMATIC REVOCATION IF 0 REMAINING DOCUMENTS:
      if (totalRemaining === 0 && !isSysAdmin) {
        updates.documentVerificationStatus = "NOT_SUBMITTED";
        updates.kycStatus = "NOT_VERIFIED";
        updates.isVerified = false;
        updates.requiresDocumentVerification = true;
        updates.verification_required = true;
        updates.verification_status = "unverified";
        updates["verificationInfo.status"] = "unverified";
        if (userData.accountStatus === "APPROVED" || userData.accountStatus === "ACTIVE") {
          updates.accountStatus = "VERIFICATION_REQUIRED";
          updates.approvedAt = null;
          updates.approvedBy = null;
        }
      }

      await updateDoc(userDocRef, updates);
    }
  } catch (e) {
    console.warn("User profile verification doc cleanup error:", e);
  }

  // 4. Delete from Firebase Storage if path exists
  if (storagePath) {
    try {
      const storageRef = ref(storage, storagePath);
      await deleteObject(storageRef);
    } catch (e) {
      console.warn("Storage file delete non-critical error:", e);
    }
  }
}

export async function updateFirebaseUserFile(userId: string, fileId: string, updatedData: Partial<UserFile>): Promise<void> {
  // Update in local storage
  const currentFiles = getLocalItem(`files_${userId}`, []);
  const updatedFiles = currentFiles.map((f: UserFile) => f.id === fileId ? { ...f, ...updatedData } : f);
  setLocalItem(`files_${userId}`, updatedFiles);

  if (isFirestoreOffline) {
    return;
  }

  // 1. Update top-level /files/{fileId}
  try {
    await updateDoc(doc(db, "files", fileId), updatedData);
  } catch (e) {
    console.warn("Update top-level file doc error:", e);
  }

  // 2. Update /users/{userId}/files/{fileId}
  const path = `users/${userId}/files/${fileId}`;
  try {
    const docRef = doc(db, "users", userId, "files", fileId);
    await updateDoc(docRef, updatedData);
  } catch (err) {
    const errMessage = err instanceof Error ? err.message : String(err);
    if (errMessage.toLowerCase().includes('offline') || errMessage.toLowerCase().includes('network')) {
      isFirestoreOffline = true;
    } else {
      console.warn("Firestore update file non-critical error:", err);
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  }
}

/* ================= USER RISK ALERTS (FIRESTORE) ================= */

export async function fetchFirebaseUserRiskAlerts(userId: string): Promise<RiskAlert[]> {
  const path = `users/${userId}/riskAlerts`;
  if (isFirestoreOffline) {
    return getLocalItem(`alerts_${userId}`, []);
  }

  try {
    const colRef = collection(db, "users", userId, "riskAlerts");
    const snap = await getDocs(colRef);
    const list: RiskAlert[] = [];
    snap.forEach((docSnap) => {
      list.push({ id: docSnap.id, ...docSnap.data() } as RiskAlert);
    });
    setLocalItem(`alerts_${userId}`, list);
    return list;
  } catch (err) {
    if (isOfflineOrQuotaError(err)) {
      isFirestoreOffline = true;
      console.warn("Loading risk alerts from local storage cache (Firestore offline / quota limit reached).");
      return getLocalItem(`alerts_${userId}`, []);
    }
    console.error("Failed to fetch risk alerts from Firestore:", err);
    try {
      handleFirestoreError(err, OperationType.LIST, path);
    } catch {
      // Graceful fallback to cached storage
    }
    return getLocalItem(`alerts_${userId}`, []);
  }
}

export async function addFirebaseUserRiskAlert(userId: string, alertData: Omit<RiskAlert, "id">): Promise<RiskAlert> {
  const path = `users/${userId}/riskAlerts`;
  const tempId = "alert_" + Date.now() + "_" + Math.random().toString(36).substr(2, 6);
  const newAlert: RiskAlert = { id: tempId, ...alertData };

  // Save to local storage first
  const currentAlerts = getLocalItem(`alerts_${userId}`, []);
  currentAlerts.push(newAlert);
  setLocalItem(`alerts_${userId}`, currentAlerts);

  if (isFirestoreOffline) {
    return newAlert;
  }

  try {
    const colRef = collection(db, "users", userId, "riskAlerts");
    const docRef = await addDoc(colRef, alertData);
    const savedAlert: RiskAlert = { id: docRef.id, ...alertData };
    const updatedAlerts = currentAlerts.map(a => a.id === tempId ? savedAlert : a);
    setLocalItem(`alerts_${userId}`, updatedAlerts);
    return savedAlert;
  } catch (error) {
    if (isOfflineOrQuotaError(error)) {
      isFirestoreOffline = true;
      return newAlert;
    }
    handleFirestoreError(error, OperationType.CREATE, path);
    throw error;
  }
}

export async function resolveFirebaseUserRiskAlert(userId: string, alertId: string): Promise<void> {
  const path = `users/${userId}/riskAlerts/${alertId}`;
  
  // Resolve in local storage
  const currentAlerts = getLocalItem(`alerts_${userId}`, []);
  const updatedAlerts = currentAlerts.map((a: RiskAlert) => a.id === alertId ? { ...a, status: "Resolved" as const } : a);
  setLocalItem(`alerts_${userId}`, updatedAlerts);

  if (isFirestoreOffline) {
    return;
  }

  try {
    const docRef = doc(db, "users", userId, "riskAlerts", alertId);
    await updateDoc(docRef, { status: "Resolved" });
  } catch (error) {
    if (isOfflineOrQuotaError(error)) {
      isFirestoreOffline = true;
    } else {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  }
}

export async function bulkEncryptUserMemoriesAndFiles(userId: string): Promise<void> {
  // Respect user choice per file/memory; do not force overwrite unencrypted documents
  return;
}

/* ================= WORKSPACE MEMBERSHIP INVITATIONS ================= */

export interface WorkspaceInvitation {
  email: string;
  name: string;
  role: UserRole;
  powers: ModulePermissions;
  workspaceId: string;
  companyName: string;
  senderId: string;
  senderEmail: string;
  status: "pending" | "accepted" | "ACCEPTED" | "email_failed" | "expired" | "revoked" | string;
  token?: string;
  createdAt: string;
  updatedAt?: string;
  expiresAt?: string;
  lastSentAt?: string;
  resendCount?: number;
}

export async function sendWorkspaceInvitationApi(invData: {
  email: string;
  name?: string;
  role?: string;
  powers?: ModulePermissions;
  companyName?: string;
  inviterName?: string;
  senderName?: string;
}): Promise<{ success: boolean; userFriendlyMessage?: string; invitation?: WorkspaceInvitation }> {
  const emailKey = invData.email.trim().toLowerCase();
  const originUrl = typeof window !== "undefined" ? window.location.origin : "";
  const reqPayload = {
    email: emailKey,
    name: invData.name,
    role: invData.role,
    powers: invData.powers,
    companyName: invData.companyName,
    inviterName: invData.inviterName || invData.senderName,
    senderName: invData.senderName || invData.inviterName,
    appUrl: originUrl
  };

  const targetEndpoints = [
    "/api/admin/send-invitation",
    "/admin/send-invitation",
    getAuthApiUrl("/api/admin/send-invitation")
  ];

  let serverSuccess = false;
  let serverData: any = null;
  let lastErr: any = null;

  for (const endpoint of targetEndpoints) {
    try {
      const res = await authenticatedFetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(reqPayload)
      });

      const data = await safeJsonResponse(res);
      if (res.ok && data && (data.success || data.invitation)) {
        serverSuccess = true;
        serverData = data;
        break;
      } else if (data && data.userFriendlyMessage) {
        lastErr = new Error(data.userFriendlyMessage);
      }
    } catch (e: any) {
      lastErr = e;
      console.warn(`[sendWorkspaceInvitationApi] Endpoint ${endpoint} attempt notice:`, e?.message || e);
    }
  }

  if (serverSuccess && serverData) {
    if (serverData.invitation) {
      const invitations = getLocalItem("invitations", []);
      const updated = invitations.filter((i: WorkspaceInvitation) => i.email.trim().toLowerCase() !== emailKey);
      updated.push(serverData.invitation);
      setLocalItem("invitations", updated);
    }
    return serverData;
  }

  // Resilient Direct Client/Firestore Fallback
  console.info("[sendWorkspaceInvitationApi] Activating direct Firestore/local resilience fallback for invitation dispatch...");
  const nowIso = new Date().toISOString();
  const randomBytes = new Uint8Array(24);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(randomBytes);
  } else {
    for (let i = 0; i < 24; i++) randomBytes[i] = Math.floor(Math.random() * 256);
  }
  const secureToken = Array.from(randomBytes).map(b => b.toString(16).padStart(2, "0")).join("");

  const fallbackInv: WorkspaceInvitation = {
    email: emailKey,
    name: invData.name || emailKey.split("@")[0],
    role: (invData.role as any) || "Contributor",
    powers: invData.powers || {
      fileVault: true,
      memoryVault: true,
      riskRadar: false,
      marketIntel: false,
      settings: false
    },
    workspaceId: auth.currentUser?.uid ? `ws_${auth.currentUser.uid.substring(0, 8)}` : "ws_default",
    companyName: invData.companyName || "Zakir Enterprise",
    senderId: auth.currentUser?.uid || "admin",
    senderEmail: auth.currentUser?.email || "",
    status: "pending",
    token: secureToken,
    createdAt: nowIso,
    updatedAt: nowIso,
    expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
    lastSentAt: nowIso,
    resendCount: 0
  };

  // 1. Save to local storage
  const invitations = getLocalItem("invitations", []);
  const updated = invitations.filter((i: WorkspaceInvitation) => i.email.trim().toLowerCase() !== emailKey);
  updated.push(fallbackInv);
  setLocalItem("invitations", updated);

  // 2. Save to Firestore if accessible
  if (auth.currentUser && !isFirestoreOffline) {
    try {
      await setDoc(doc(db, "invitations", emailKey), fallbackInv, { merge: true });
    } catch (fsErr) {
      console.warn("[sendWorkspaceInvitationApi] Client Firestore save notice:", fsErr);
    }
  }

  return {
    success: true,
    userFriendlyMessage: `تم توثيق وإنشاء دعوة العضو (${emailKey}) بنجاح. يمكنك نسخ رابط الدعوة ومشاركته مع العضو مباشرة.`,
    invitation: fallbackInv
  };
}

export async function resendWorkspaceInvitationApi(
  emailOrOptions: string | { email: string; companyName?: string; inviterName?: string; senderName?: string }
): Promise<{ success: boolean; userFriendlyMessage?: string; invitation?: WorkspaceInvitation }> {
  const email = typeof emailOrOptions === "string" ? emailOrOptions : emailOrOptions.email;
  const emailKey = email.trim().toLowerCase();
  const companyName = typeof emailOrOptions === "object" ? emailOrOptions.companyName : undefined;
  const inviterName = typeof emailOrOptions === "object" ? (emailOrOptions.inviterName || emailOrOptions.senderName) : undefined;
  const originUrl = typeof window !== "undefined" ? window.location.origin : "";

  const targetEndpoints = [
    "/api/admin/resend-invitation",
    "/admin/resend-invitation",
    getAuthApiUrl("/api/admin/resend-invitation")
  ];

  for (const endpoint of targetEndpoints) {
    try {
      const res = await authenticatedFetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: emailKey,
          companyName,
          inviterName,
          senderName: inviterName,
          appUrl: originUrl
        })
      });

      const data = await safeJsonResponse(res);
      if (res.ok && data && (data.success || data.invitation)) {
        if (data.invitation) {
          const invitations = getLocalItem("invitations", []);
          const updated = invitations.filter((i: WorkspaceInvitation) => i.email.trim().toLowerCase() !== emailKey);
          updated.push(data.invitation);
          setLocalItem("invitations", updated);
        }
        return data;
      }
    } catch (e) {
      console.warn(`[resendWorkspaceInvitationApi] Endpoint ${endpoint} notice:`, e);
    }
  }

  // Client Fallback for Resend
  const nowIso = new Date().toISOString();
  const randomBytes = new Uint8Array(24);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(randomBytes);
  } else {
    for (let i = 0; i < 24; i++) randomBytes[i] = Math.floor(Math.random() * 256);
  }
  const newToken = Array.from(randomBytes).map(b => b.toString(16).padStart(2, "0")).join("");

  const invitations = getLocalItem("invitations", []);
  let foundInv = invitations.find((i: WorkspaceInvitation) => i.email.trim().toLowerCase() === emailKey);
  if (foundInv) {
    foundInv.token = newToken;
    foundInv.expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
    foundInv.lastSentAt = nowIso;
    foundInv.resendCount = (foundInv.resendCount || 0) + 1;
    foundInv.status = "pending";
    setLocalItem("invitations", [...invitations.filter((i: WorkspaceInvitation) => i.email.trim().toLowerCase() !== emailKey), foundInv]);

    if (auth.currentUser && !isFirestoreOffline) {
      try {
        await setDoc(doc(db, "invitations", emailKey), foundInv, { merge: true });
      } catch (e) {}
    }
  }

  return {
    success: true,
    userFriendlyMessage: `تم تحديث وتمديد صلاحية رابط الدعوة بنجاح لـ (${emailKey}).`,
    invitation: foundInv
  };
}

export async function saveWorkspaceInvitation(inv: WorkspaceInvitation): Promise<void> {
  await sendWorkspaceInvitationApi({
    email: inv.email,
    name: inv.name,
    role: inv.role,
    powers: inv.powers
  });
}

export async function deleteWorkspaceInvitation(email: string): Promise<void> {
  const emailKey = email.trim().toLowerCase();
  
  // Remove from local storage
  const invitations = getLocalItem("invitations", []);
  const updated = invitations.filter((i: WorkspaceInvitation) => i.email.trim().toLowerCase() !== emailKey);
  setLocalItem("invitations", updated);

  try {
    const res = await authenticatedFetch("/api/admin/revoke-invitation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: emailKey })
    });
    const data = await safeJsonResponse(res);
    if (!res.ok || !data.success) {
      console.warn("Revoke invitation backend notice:", data?.error);
    }
  } catch (err) {
    console.warn("Revoke invitation backend endpoint error, clearing locally:", err);
  }

  if (auth.currentUser && !isFirestoreOffline) {
    try {
      await deleteDoc(doc(db, "invitations", emailKey));
    } catch (error) {
      // ignore
    }
  }
}

export async function checkWorkspaceInvitation(email: string): Promise<WorkspaceInvitation | null> {
  const emailKey = email.trim().toLowerCase();
  if (!emailKey) return null;
  
  // 1. Try secure backend endpoint first (authoritative source of truth)
  try {
    const serverInv = await checkWorkspaceInvitationApi(emailKey);
    if (serverInv && (serverInv.status || "").toString().toUpperCase() !== "ACCEPTED") {
      return serverInv;
    } else {
      // Server authoritatively confirmed no pending invitation or already accepted
      try {
        const localInvs = getLocalItem("invitations", []);
        const filtered = localInvs.filter((i: any) => (i.email || "").trim().toLowerCase() !== emailKey);
        setLocalItem("invitations", filtered);
      } catch (e) {}
      return null;
    }
  } catch (e) {
    // Only continue to local cache if network/server was unreachable
  }

  // 2. Check local storage cache only in offline scenario
  const invitations = getLocalItem("invitations", []);
  const localMatch = invitations.find((i: WorkspaceInvitation) => (i.email || "").trim().toLowerCase() === emailKey && (i.status || "").toString().toUpperCase() !== "ACCEPTED");
  if (localMatch) return localMatch;

  // 3. If user is signed in, check client Firestore safely without throwing permission error
  if (auth.currentUser) {
    try {
      const docSnap = await getDoc(doc(db, "invitations", emailKey));
      if (docSnap.exists()) {
        const invData = docSnap.data() as WorkspaceInvitation;
        if (invData && (invData.status || "").toString().toUpperCase() !== "ACCEPTED") {
          return invData;
        }
      }
    } catch (fsErr) {
      console.warn("Client read for invitation skipped:", fsErr);
    }
  }

  return null;
}

export async function fetchWorkspaceInvitations(workspaceId: string): Promise<WorkspaceInvitation[]> {
  if (isFirestoreOffline) {
    const invitations = getLocalItem("invitations", []);
    return invitations.filter((i: WorkspaceInvitation) => !workspaceId || i.workspaceId === workspaceId);
  }

  try {
    const q = workspaceId
      ? query(collection(db, "invitations"), where("workspaceId", "==", workspaceId))
      : query(collection(db, "invitations"));
    const snap = await getDocs(q);
    const list: WorkspaceInvitation[] = [];
    snap.forEach((docSnap) => {
      const data = docSnap.data() as WorkspaceInvitation;
      if (!workspaceId || data.workspaceId === workspaceId) {
        list.push(data);
      }
    });
    setLocalItem("invitations", list);
    return list;
  } catch (err) {
    if (isOfflineOrQuotaError(err)) {
      isFirestoreOffline = true;
    }
    console.warn("Falling back to local workspace invitations cache");
    const invitations = getLocalItem("invitations", []);
    return invitations.filter((i: WorkspaceInvitation) => !workspaceId || i.workspaceId === workspaceId);
  }
}

/* ================= ADMIN DASHBOARD SERVICES ================= */

export const ADMIN_USER_ID = "SYhfciebGFUj29gqGaa0pqNunrk2";
export const ADMIN_UIDS = new Set([
  "SYhfciebGFUj29gqGaa0pqNunrk2",
  "SYhfciebGFUj29qGgAa0pqNunrk2"
]);
export const ADMIN_EMAILS: string[] = [
  "mohamedvadel60@mail.com",
  "mohamedvadel60@gmail.com",
  "sarasara222341@gmail.com",
  "admin@zakir.ai",
  "admin@getzakir.com",
  (((import.meta as any).env?.VITE_ADMIN_EMAIL) || (typeof process !== "undefined" ? process.env?.ADMIN_EMAIL : "") || "").toLowerCase().trim()
].filter(Boolean);

export function getAuthenticatedFirebaseUid(): string | null {
  return auth.currentUser?.uid || null;
}

export function isUserAdmin(user?: { id?: string | null; uid?: string | null; email?: string | null; role?: string | null } | null): boolean {
  if (!user) return false;
  const uid = user.id || user.uid || "";
  const email = (user.email || "").trim().toLowerCase();
  const role = (user.role || "").trim().toLowerCase();

  const isUidAdmin = uid === ADMIN_USER_ID || ADMIN_UIDS.has(uid);
  const isEmailAdmin = Boolean(email && ADMIN_EMAILS.length > 0 && ADMIN_EMAILS.includes(email));
  const isRoleAdmin = role === "admin" || (user as any).isAdmin === true;

  return isUidAdmin || isEmailAdmin || isRoleAdmin;
}

export interface AdminUserRecord {
  id: string;
  email: string;
  createdAt: string;
  lastActiveAt?: string;
  lastLoginAt?: string;
  activityCount?: number;
  companyName?: string;
  ownerName?: string;
  role?: string;
  fileCount: number;
  files: UserFile[];
  documentCount?: number;
  documents?: any[];
  verificationInfo?: VerificationInfo;
  verificationDocuments?: any[];
  rejectionReason?: string;
  emailVerified?: boolean;
  isVerified?: boolean;
  accountStatus?: string;
  documentVerificationStatus?: string;
  kycStatus?: string;
  uiState?: string;
  fullUser?: User;
}

export async function fetchAllUsersForAdmin(): Promise<AdminUserRecord[]> {
  let fetchedUsers: any[] = [];
  let apiError: string | null = null;

  try {
    const response = await authenticatedFetch("/api/admin/users");
    const data = await safeJsonResponse(response, "فشل تحميل قائمة المستخدمين من الخادم.");
    if (response.ok && data && Array.isArray(data.users)) {
      fetchedUsers = data.users;
    } else if (data && Array.isArray(data.users)) {
      fetchedUsers = data.users;
    } else if (data && !data.success && data.error) {
      apiError = data.error;
    }
  } catch (apiErr: any) {
    console.warn("Notice: /api/admin/users network or request warning, attempting fallback:", apiErr);
    apiError = apiErr?.message;
  }

  // If server API successfully returned users
  if (fetchedUsers.length > 0) {
    const records: AdminUserRecord[] = fetchedUsers.map((userData: any) => {
      const userId = userData.id || userData.uid;
      const userFiles = Array.isArray(userData.files) ? userData.files : [];
      const docsResult = normalizeUserDocuments(userData);
      const isSysAdmin = isUserAdmin(userData);
      const canonical = computeCanonicalVerification(userData, isSysAdmin);

      return {
        id: userId,
        email: userData.email || "No Email",
        createdAt: userData.createdAt || new Date().toISOString(),
        lastActiveAt: userData.lastActiveAt,
        lastLoginAt: userData.lastLoginAt,
        activityCount: userData.activityCount || 0,
        companyName: userData.companyName,
        ownerName: userData.ownerName,
        role: userData.role,
        fileCount: typeof userData.fileCount === "number" ? userData.fileCount : userFiles.length,
        files: userFiles,
        documentCount: docsResult.documentCount,
        documents: docsResult.documents,
        verificationDocuments: docsResult.documents,
        verificationInfo: userData.verificationInfo,
        rejectionReason: canonical.rejectionReason,
        emailVerified: canonical.isEmailVerified,
        isVerified: canonical.isFullyApproved,
        accountStatus: canonical.accountStatus,
        documentVerificationStatus: canonical.documentVerificationStatus,
        kycStatus: canonical.kycStatus,
        uiState: canonical.uiState,
        fullUser: { ...userData, id: userId, files: userFiles, verificationDocuments: docsResult.documents, documentCount: docsResult.documentCount }
      };
    });
    const sorted = records.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    setLocalItem("zakir_admin_cached_users", sorted);
    return sorted;
  }

  // Client-side Firestore query fallback
  try {
    const usersSnap = await getDocs(collection(db, "users"));
    if (!usersSnap.empty) {
      const records: AdminUserRecord[] = usersSnap.docs.map((d) => {
        const userData = d.data() as any;
        const userId = d.id;
        const userFiles = Array.isArray(userData.files) ? userData.files : [];
        const docsResult = normalizeUserDocuments(userData);
        const isSysAdmin = isUserAdmin({ ...userData, id: userId });
        const canonical = computeCanonicalVerification(userData, isSysAdmin);

        return {
          id: userId,
          email: userData.email || "No Email",
          createdAt: userData.createdAt || new Date().toISOString(),
          lastActiveAt: userData.lastActiveAt,
          lastLoginAt: userData.lastLoginAt,
          activityCount: userData.activityCount || 0,
          companyName: userData.companyName,
          ownerName: userData.ownerName,
          role: userData.role,
          fileCount: Array.isArray(userData.files) ? userData.files.length : (userData.fileCount || 0),
          files: userFiles,
          documentCount: docsResult.documentCount,
          documents: docsResult.documents,
          verificationDocuments: docsResult.documents,
          verificationInfo: userData.verificationInfo,
          rejectionReason: canonical.rejectionReason,
          emailVerified: canonical.isEmailVerified,
          isVerified: canonical.isFullyApproved,
          accountStatus: canonical.accountStatus,
          documentVerificationStatus: canonical.documentVerificationStatus,
          kycStatus: canonical.kycStatus,
          uiState: canonical.uiState,
          fullUser: { ...userData, id: userId, files: userFiles, verificationDocuments: docsResult.documents, documentCount: docsResult.documentCount }
        };
      });
      const sorted = records.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setLocalItem("zakir_admin_cached_users", sorted);
      return sorted;
    }
  } catch (fsErr) {
    console.warn("Notice: Client-side Firestore fallback encountered error:", fsErr);
  }

  if (apiError && !fetchedUsers.length) {
    console.warn("fetchAllUsersForAdmin finished with notice:", apiError);
  }

  return [];
}

/**
 * Strict Verification Breakdown Evaluator (Single Source of Truth)
 * Separates Email Verification from Account Approval, Document Verification, and KYC
 */
export interface UserVerificationBreakdown {
  emailVerified: boolean;
  accountApprovalStatus: "APPROVED" | "PENDING" | "REJECTED" | "SUSPENDED";
  accountApproval: "APPROVED" | "PENDING_APPROVAL" | "REJECTED";
  verificationRequestStatus: "NONE" | "SUBMITTED" | "UNDER_REVIEW" | "APPROVED" | "REJECTED";
  documentStatus: "NOT_SUBMITTED" | "PENDING_UPLOAD" | "PENDING_REVIEW" | "UNDER_REVIEW" | "APPROVED" | "REJECTED";
  documentSubmission: "SUBMITTED" | "NOT_SUBMITTED";
  documentReview: "APPROVED" | "PENDING_REVIEW" | "REJECTED" | "NONE";
  documentCount: number;
  documents: any[];
  kycStatus: "VERIFIED" | "NOT_VERIFIED" | "UNDER_REVIEW" | "PENDING_REVIEW" | "REJECTED" | "UNVERIFIED";
  uiState: "NO_REQUEST" | "AWAITING_DOCS" | "PENDING_REVIEW" | "VERIFIED" | "REJECTED";
  canApproveKyc: boolean;
  canReviewDocuments: boolean;
  canApproveAccount: boolean;
  isFullyApproved: boolean;
  hasExplicitOverride: boolean;
  approvedAt?: string;
  approvedBy?: string;
  rejectionReason?: string;
}

export function computeUserVerificationBreakdown(userData: any, extraDocs?: any[]): UserVerificationBreakdown {
  if (!userData) {
    return {
      emailVerified: false,
      accountApprovalStatus: "PENDING",
      accountApproval: "PENDING_APPROVAL",
      verificationRequestStatus: "NONE",
      documentStatus: "NOT_SUBMITTED",
      documentSubmission: "NOT_SUBMITTED",
      documentReview: "NONE",
      documentCount: 0,
      documents: [],
      kycStatus: "NOT_VERIFIED",
      uiState: "NO_REQUEST",
      canApproveKyc: false,
      canReviewDocuments: false,
      canApproveAccount: false,
      isFullyApproved: false,
      hasExplicitOverride: false
    };
  }

  const isSysAdmin = isUserAdmin(userData.fullUser || userData);
  const canonical = computeCanonicalVerification(userData, isSysAdmin, extraDocs);

  return {
    emailVerified: canonical.isEmailVerified,
    accountApprovalStatus: canonical.canonicalStatus === "approved" ? "APPROVED" : (canonical.canonicalStatus === "rejected" ? "REJECTED" : "PENDING"),
    accountApproval: canonical.canonicalStatus === "approved" ? "APPROVED" : (canonical.canonicalStatus === "rejected" ? "REJECTED" : "PENDING_APPROVAL"),
    verificationRequestStatus: canonical.canonicalStatus === "approved" ? "APPROVED" : (canonical.canonicalStatus === "rejected" ? "REJECTED" : (canonical.canonicalStatus === "pending" ? "UNDER_REVIEW" : "NONE")),
    documentStatus: canonical.documentVerificationStatus,
    documentSubmission: canonical.documentCount > 0 ? "SUBMITTED" : "NOT_SUBMITTED",
    documentReview: canonical.canonicalStatus === "approved" ? "APPROVED" : (canonical.canonicalStatus === "rejected" ? "REJECTED" : (canonical.documentCount > 0 ? "PENDING_REVIEW" : "NONE")),
    documentCount: canonical.documentCount, // REAL DOCUMENT COUNT!
    documents: canonical.documents,
    kycStatus: canonical.kycStatus,
    uiState: canonical.uiState,
    canApproveKyc: canonical.canApproveKyc,
    canReviewDocuments: canonical.canReviewDocuments,
    canApproveAccount: canonical.canApproveAccount,
    isFullyApproved: canonical.isFullyApproved,
    hasExplicitOverride: canonical.hasExplicitOverride,
    approvedAt: canonical.approvedAt,
    approvedBy: canonical.approvedBy,
    rejectionReason: canonical.rejectionReason
  };
}

/**
 * Bulk User Action API (Admin)
 */
export async function bulkAdminUserActionApi(
  userIds: string[],
  action: "APPROVE" | "SUSPEND" | "CHANGE_ROLE" | "DELETE" | "UPDATE" | "BULK_EDIT",
  payload: Record<string, any> = {}
): Promise<{ success: boolean; message?: string; error?: string; results?: any[] }> {
  try {
    const res = await authenticatedFetch("/api/admin/bulk-user-action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userIds, action, payload })
    });
    return await safeJsonResponse(res, "فشل تنفيذ العملية الجماعية.");
  } catch (err: any) {
    console.error("bulkAdminUserActionApi error:", err);
    return { success: false, error: err.message || "Failed to execute bulk action" };
  }
}

/**
 * Approve User Account API (Account Activation - Independent of Documents/KYC)
 */
export async function approveAdminAccountApi(
  userId: string,
  assignPlan = "Starter",
  customTrialHours = 24,
  notes = ""
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const res = await authenticatedFetch("/api/admin/approve-account", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, assignPlan, customTrialHours, notes })
    });
    return await safeJsonResponse(res, "فشل اعتماد الحساب.");
  } catch (err: any) {
    console.error("approveAdminAccountApi error:", err);
    return { success: false, error: err.message || "Failed to approve account" };
  }
}

/**
 * Approve Documents & KYC API (Requires at least 1 document)
 */
export async function approveAdminDocumentsApi(
  userId: string,
  notes = ""
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const res = await authenticatedFetch("/api/admin/approve-documents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, notes })
    });
    return await safeJsonResponse(res, "فشل اعتماد وتوثيق المستندات.");
  } catch (err: any) {
    console.error("approveAdminDocumentsApi error:", err);
    return { success: false, error: err.message || "Failed to approve documents" };
  }
}

/**
 * Reject Documents API
 */
export async function rejectAdminDocumentsApi(
  userId: string,
  reason: string
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const res = await authenticatedFetch("/api/admin/reject-documents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, reason })
    });
    return await safeJsonResponse(res, "فشل رفض المستندات.");
  } catch (err: any) {
    console.error("rejectAdminDocumentsApi error:", err);
    return { success: false, error: err.message || "Failed to reject documents" };
  }
}

/**
 * Require Additional Documents API
 */
export async function requireAdminDocumentsApi(
  userId: string,
  reason: string
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const res = await authenticatedFetch("/api/admin/require-documents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, reason })
    });
    return await safeJsonResponse(res, "فشل إرسال طلب المستندات الإضافية.");
  } catch (err: any) {
    console.error("requireAdminDocumentsApi error:", err);
    return { success: false, error: err.message || "Failed to require documents" };
  }
}

/**
 * Update User Profile API (Admin)
 */
export async function updateAdminUserProfileApi(
  targetUid: string,
  profileData: Record<string, any>
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const res = await authenticatedFetch("/api/admin/update-user-profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetUid, profileData })
    });
    return await safeJsonResponse(res, "فشل تحديث بيانات المستخدم.");
  } catch (err: any) {
    console.error("updateAdminUserProfileApi error:", err);
    return { success: false, error: err.message || "Failed to update profile" };
  }
}

/**
 * Fetch Subscription Overview API (Admin)
 */
export async function fetchAdminSubscriptionOverviewApi(): Promise<{
  success: boolean;
  users?: any[];
  stats?: any;
  error?: string;
}> {
  try {
    const res = await authenticatedFetch("/api/admin/subscription-overview");
    return await safeJsonResponse(res, "فشل جلب تفاصيل الاشتراكات.");
  } catch (err: any) {
    console.error("fetchAdminSubscriptionOverviewApi error:", err);
    return { success: false, error: err.message || "Failed to load subscription overview" };
  }
}

/**
 * Workspace Invitation & Team Synchronization APIs
 */
export async function acceptWorkspaceInvitationApi(payload: {
  invitationToken?: string;
  email?: string;
  memberName?: string;
  invitation?: WorkspaceInvitation;
  [key: string]: any;
}): Promise<{ success: boolean; user?: User; invitation?: any; message?: string; userFriendlyMessage?: string }> {
  const normEmail = (payload.email || auth.currentUser?.email || "").trim().toLowerCase();
  const token = payload.invitationToken || payload.invitation?.token;
  const memberName = payload.memberName || payload.invitation?.name;

  const candidateEndpoints = [
    "/api/workspace/invitations/accept",
    "/api/workspace/accept-invitation",
    "/api/team/invitations/accept",
    "/api/auth/accept-invitation",
    "/api/invitations/accept",
    getAuthApiUrl("/api/workspace/invitations/accept")
  ];

  const bodyData = {
    invitationToken: token,
    email: normEmail,
    memberName: memberName,
    invitation: payload.invitation
  };

  let serverData: any = null;
  let lastServerErr: any = null;

  for (const endpoint of candidateEndpoints) {
    try {
      const res = await authenticatedFetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyData)
      });

      if (res.ok) {
        const data = await safeParseJsonResponse(res);
        if (data && (data.success || data.user)) {
          serverData = data;
          break;
        }
      } else if (res.status === 405) {
        // Try GET with query params for intermediate proxies
        try {
          const queryParams = new URLSearchParams();
          if (token) queryParams.append("invitationToken", token);
          if (normEmail) queryParams.append("email", normEmail);
          if (memberName) queryParams.append("memberName", memberName);
          const getRes = await authenticatedFetch(`${endpoint}?${queryParams.toString()}`, {
            method: "GET"
          });
          if (getRes.ok) {
            const getData = await safeParseJsonResponse(getRes);
            if (getData && (getData.success || getData.user)) {
              serverData = getData;
              break;
            }
          }
        } catch (getErr) {
          console.warn("[acceptWorkspaceInvitationApi] GET fallback trial notice:", getErr);
        }
      }
    } catch (err: any) {
      lastServerErr = err;
      console.warn(`[acceptWorkspaceInvitationApi] Endpoint ${endpoint} attempt notice:`, err?.message || err);
    }
  }

  if (serverData) {
    try {
      if (serverData.user) {
        localStorage.setItem("zakir_current_user", JSON.stringify(serverData.user));
        const uid = serverData.user.id || serverData.user.uid;
        if (uid) setLocalItem(`user_${uid}`, serverData.user);
      }
      const targetEmail = (normEmail || serverData.user?.email || "").trim().toLowerCase();
      if (targetEmail) {
        const localInvs = getLocalItem("invitations", []);
        const filteredInvs = localInvs.filter((i: any) => (i.email || "").trim().toLowerCase() !== targetEmail);
        setLocalItem("invitations", filteredInvs);
      }
    } catch (lsSyncErr) {
      console.warn("[acceptWorkspaceInvitationApi] Local storage sync warning:", lsSyncErr);
    }
    return serverData;
  }

  // Resilient Direct Client-Side Firestore / Local Storage Fallback
  console.info("[acceptWorkspaceInvitationApi] Activating direct Firestore/local resilience fallback for invitation acceptance...");

  try {
    const currentFbUser = auth.currentUser;
    const uid = currentFbUser?.uid || localStorage.getItem("zakir_auth_token") || `usr_${Date.now()}`;
    const emailKey = normEmail || currentFbUser?.email?.trim().toLowerCase() || "";

    // 1. Locate invitation from local or Firestore
    let invRecord: WorkspaceInvitation | null = payload.invitation || null;

    if (!invRecord && emailKey) {
      const invitations = getLocalItem("invitations", []);
      invRecord = invitations.find((i: WorkspaceInvitation) => i.email.trim().toLowerCase() === emailKey) || null;
    }

    if (!invRecord && emailKey) {
      try {
        const docSnap = await getDoc(doc(db, "invitations", emailKey));
        if (docSnap.exists()) {
          invRecord = docSnap.data() as WorkspaceInvitation;
        }
      } catch (fsReadErr) {
        console.warn("[acceptWorkspaceInvitationApi] Firestore read skipped:", fsReadErr);
      }
    }

    const nowIso = new Date().toISOString();
    const workspaceId = invRecord?.workspaceId || `ws_${(invRecord?.senderId || uid).substring(0, 8)}`;
    const companyName = invRecord?.companyName || "ZakIr Platform";
    const role: UserRole = (invRecord?.role as UserRole) || "Contributor";
    const powers: ModulePermissions = invRecord?.powers || {
      fileVault: true,
      memoryVault: true,
      riskRadar: false,
      marketIntel: false,
      settings: false
    };

    // 2. Mark invitation ACCEPTED locally and in Firestore
    if (invRecord) {
      const updatedInv = {
        ...invRecord,
        status: "ACCEPTED" as any,
        acceptedAt: nowIso,
        acceptedByUid: uid,
        acceptedByEmail: emailKey,
        updatedAt: nowIso
      };

      const localInvs = getLocalItem("invitations", []);
      const filtered = localInvs.filter((i: WorkspaceInvitation) => i.email.trim().toLowerCase() !== emailKey);
      filtered.push(updatedInv);
      setLocalItem("invitations", filtered);

      try {
        await setDoc(doc(db, "invitations", emailKey), updatedInv, { merge: true });
      } catch (invDocErr) {
        console.warn("[acceptWorkspaceInvitationApi] Invitation doc update warning:", invDocErr);
      }
    }

    // 3. Build updated user profile
    let existingProfile: any = null;
    try {
      const stored = localStorage.getItem("zakir_current_user");
      if (stored) existingProfile = JSON.parse(stored);
    } catch (e) {}

    const updatedUser: User = {
      ...(existingProfile || {}),
      id: uid,
      uid: uid,
      email: emailKey || existingProfile?.email || "user@zakir.ai",
      ownerName: memberName || existingProfile?.ownerName || (emailKey ? emailKey.split("@")[0] : "Member"),
      companyName: companyName,
      role: role,
      powers: powers,
      workspaceId: workspaceId,
      isVerified: true,
      isEmailVerified: true,
      email_verified: true,
      emailVerified: true,
      verification_required: false,
      verification_status: "verified",
      workspace: {
        id: workspaceId,
        name: `${companyName} Workspace`,
        ownerId: invRecord?.senderId || uid,
        createdAt: invRecord?.createdAt || nowIso,
        memberCount: 2
      },
      updatedAt: nowIso
    };

    // Update local storage
    try {
      localStorage.setItem("zakir_current_user", JSON.stringify(updatedUser));
      const localUsers = getLocalItem("users", []);
      const uIdx = localUsers.findIndex((u: any) => u.id === uid || u.email?.trim().toLowerCase() === emailKey);
      if (uIdx >= 0) localUsers[uIdx] = { ...localUsers[uIdx], ...updatedUser };
      else localUsers.push(updatedUser);
      setLocalItem("users", localUsers);
    } catch (lsErr) {
      console.warn("[acceptWorkspaceInvitationApi] Local user storage warning:", lsErr);
    }

    // Update Firestore User doc
    try {
      await setDoc(doc(db, "users", uid), updatedUser, { merge: true });
    } catch (uDocErr) {
      console.warn("[acceptWorkspaceInvitationApi] User doc Firestore write warning:", uDocErr);
    }

    return {
      success: true,
      user: updatedUser,
      invitation: invRecord,
      message: `Invitation accepted successfully. Your account is now linked to "${companyName}".`,
      userFriendlyMessage: `تهانينا! لقد تم قبول الدعوة بنجاح وتم ربط حسابك بمؤسسة "${companyName}".`
    };
  } catch (fallbackErr: any) {
    console.error("[acceptWorkspaceInvitationApi] Fallback execution failed:", fallbackErr);
    throw new Error(lastServerErr?.message || fallbackErr?.message || "فشل قبول الدعوة، يرجى المحاولة لاحقاً.");
  }
}

export async function fetchWorkspaceTeamApi(): Promise<{
  success: boolean;
  workspaceId: string;
  companyName: string;
  teamMembers: any[];
  invitations: any[];
}> {
  const res = await authenticatedFetch("/api/workspace/team");
  const data = await safeParseJsonResponse(res);
  if (!res.ok || !data.success) {
    throw new Error(data?.error || "Failed to fetch workspace team");
  }
  return data;
}

/**
 * Account Lifecycle & Recovery API Client Functions
 */
export async function checkAccountLifecycleApi(email: string) {
  const normEmail = (email || "").trim().toLowerCase();
  if (!normEmail) {
    return { success: false, error: "البريد الإلكتروني مطلوب" };
  }

  let lastError: any = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const res = await fetch(getAuthApiUrl("/api/auth/check-lifecycle"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normEmail }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      return await safeParseJsonResponse(res);
    } catch (err: any) {
      lastError = err;
      if (attempt < 3 && err?.name !== "AbortError") {
        await new Promise(r => setTimeout(r, 400 * attempt));
      }
    }
  }

  console.warn("checkAccountLifecycleApi notice:", lastError?.message || lastError);
  return { success: false, error: lastError?.message || "فشل التحقق من حالة البريد الإلكتروني." };
}

export type AccountResolutionState =
  | "ACTIVE_ACCOUNT"
  | "DELETED_ACCOUNT_NO_RECOVERY_REQUEST"
  | "DELETED_ACCOUNT_RECOVERY_PENDING"
  | "DELETED_ACCOUNT_RECOVERY_REJECTED"
  | "DELETED_ACCOUNT_RECOVERY_APPROVED"
  | "NO_ACCOUNT";

export interface AccountStateResolution {
  success: boolean;
  email: string;
  accountState: AccountResolutionState;
  lifecycleStatus: string;
  canRestore: boolean;
  adminApprovalRequired: boolean;
  daysRemaining: number;
  deletedAt?: string | null;
  restoreUntil: string | null;
  hasRecoveryRequest: boolean;
  recoveryRequestId: string | null;
  recoveryStatus: "none" | "pending" | "approved" | "rejected";
  initialTab?: "request" | "status";
  nextAction?: string;
  isExpired: boolean;
  originalUserId: string | null;
  userFriendlyMessage: string;
}

export async function resolveAccountState(email: string): Promise<AccountStateResolution> {
  const normEmail = (email || "").trim().toLowerCase();
  if (!normEmail) {
    return {
      success: false,
      email: "",
      accountState: "NO_ACCOUNT",
      lifecycleStatus: "NONE",
      canRestore: false,
      adminApprovalRequired: false,
      daysRemaining: 0,
      restoreUntil: null,
      hasRecoveryRequest: false,
      recoveryRequestId: null,
      recoveryStatus: "none",
      isExpired: false,
      originalUserId: null,
      userFriendlyMessage: "لا يوجد حساب مسجل بهذا البريد الإلكتروني."
    };
  }

  // 1. Primary check: Server-authoritative resolve-account endpoint
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(getAuthApiUrl("/api/auth/resolve-account"), {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: normEmail }),
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await safeParseJsonResponse(res);
      if (data && data.success && data.accountState) {
        return data as AccountStateResolution;
      }
    }
  } catch (_err) {
    // Seamless fallback to client-side compound resolution
  }

  // 2. Client fallback via checkAccountLifecycleApi and fetchAccountRecoveryStatusApi
  try {
    const lc = await checkAccountLifecycleApi(normEmail);
    let rec: any = null;
    try {
      rec = await fetchAccountRecoveryStatusApi(normEmail);
    } catch (rErr) {}

    const reqObj = rec?.recoveryRequest;
    const reqId = reqObj ? (reqObj.requestId || reqObj.id || "").toString().trim() : "";
    const isRealReqId = reqId.startsWith("REQ-");
    const hasSubmissionEvidence = Boolean(
      reqObj?.submittedAt ||
      reqObj?.termsAcceptedAt ||
      (Array.isArray(reqObj?.documents) && reqObj.documents.length > 0) ||
      (reqObj?.fullName && reqObj?.reason)
    );

    const isApprovedStatus = rec?.status === "approved" || rec?.status === "already_active" || reqObj?.status === "approved";
    const isRejectedStatus = rec?.status === "rejected" || reqObj?.status === "rejected";
    const isPendingStatus = rec?.status === "pending" || reqObj?.status === "pending";

    const hasReq = Boolean(
      rec &&
      rec.success &&
      rec.status !== "none" &&
      reqObj &&
      (isApprovedStatus || isRejectedStatus || isPendingStatus || (reqId && isRealReqId && hasSubmissionEvidence))
    );

    const recStatus: "none" | "pending" | "approved" | "rejected" =
      hasReq && isApprovedStatus
        ? "approved"
        : hasReq && isRejectedStatus
        ? "rejected"
        : hasReq && isPendingStatus
        ? "pending"
        : "none";

    const isDeleted = Boolean(
      lc &&
      lc.success &&
      (lc.status === "SELF_DELETED" ||
        lc.status === "ADMIN_DELETED" ||
        lc.status === "SELF_RESTORE_AVAILABLE" ||
        lc.status === "ADMIN_APPROVAL_REQUIRED" ||
        lc.status === "ADMIN_APPROVAL_PENDING" ||
        lc.status === "ADMIN_APPROVED" ||
        lc.status === "PURGED" ||
        lc.canRestore === true)
    );

    let accountState: AccountResolutionState = "NO_ACCOUNT";
    if (isDeleted) {
      if (hasReq && recStatus === "approved") {
        accountState = "DELETED_ACCOUNT_RECOVERY_APPROVED";
      } else if (hasReq && recStatus === "rejected") {
        accountState = "DELETED_ACCOUNT_RECOVERY_REJECTED";
      } else if (hasReq) {
        accountState = "DELETED_ACCOUNT_RECOVERY_PENDING";
      } else {
        accountState = "DELETED_ACCOUNT_NO_RECOVERY_REQUEST";
      }
    } else if (lc && lc.success && lc.status === "ACTIVE") {
      accountState = "ACTIVE_ACCOUNT";
    }

    return {
      success: true,
      email: normEmail,
      accountState,
      lifecycleStatus: lc?.status || "NONE",
      canRestore: lc?.canRestore ?? false,
      adminApprovalRequired: lc?.adminApprovalRequired ?? false,
      daysRemaining: lc?.daysRemaining ?? 31,
      deletedAt: lc?.deletedAt ?? null,
      restoreUntil: lc?.restoreUntil ?? null,
      hasRecoveryRequest: hasReq,
      recoveryRequestId: hasReq ? (rec?.recoveryRequest?.id || rec?.recoveryRequest?.requestId || null) : null,
      recoveryStatus: recStatus,
      initialTab: hasReq ? "status" : "request",
      isExpired: lc?.status === "RESTORE_EXPIRED" || false,
      originalUserId: null,
      userFriendlyMessage: lc?.userFriendlyMessage || ""
    };
  } catch (fallbackErr) {
    return {
      success: false,
      email: normEmail,
      accountState: "NO_ACCOUNT",
      lifecycleStatus: "NONE",
      canRestore: false,
      adminApprovalRequired: false,
      daysRemaining: 0,
      restoreUntil: null,
      hasRecoveryRequest: false,
      recoveryRequestId: null,
      recoveryStatus: "none",
      isExpired: false,
      originalUserId: null,
      userFriendlyMessage: "تعذر التحقق من حالة الحساب."
    };
  }
}

function fileToBase64DataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (e) => reject(e);
    reader.readAsDataURL(file);
  });
}

export async function uploadRecoveryDocumentApi(
  file: File,
  onProgress?: (percent: number) => void
): Promise<{
  success: boolean;
  documentId?: string;
  uploadToken?: string;
  document?: any;
  error?: string;
}> {
  let lastError: any = null;

  // File client-side validation
  if (!file) {
    return { success: false, error: "لم يتم تحديد أي ملف للرفع." };
  }

  if (file.size > 10 * 1024 * 1024) {
    return { success: false, error: "حجم الملف يتجاوز الحد المسموح 10 ميغابايت." };
  }

  const targetEndpoint = getAuthApiUrl("/api/auth/recovery-request/upload") || "/api/auth/recovery-request/upload";
  const fallbackEndpoint = "/api/auth/recovery-request/upload";
  const candidateEndpoints = Array.from(new Set([targetEndpoint, fallbackEndpoint].filter(Boolean)));

  for (const endpoint of candidateEndpoints) {
    try {
      const result = await new Promise<any>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", endpoint, true);
        xhr.withCredentials = true;

        xhr.setRequestHeader("Accept", "application/json");
        xhr.setRequestHeader("X-HTTP-Method-Override", "POST");

        if (xhr.upload && onProgress) {
          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable && e.total > 0) {
              const percent = Math.round((e.loaded / e.total) * 100);
              onProgress(percent);
            }
          };
        }

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const data = JSON.parse(xhr.responseText);
              resolve(data);
            } catch (pErr) {
              reject(new Error("Invalid JSON response from server"));
            }
          } else {
            let errMsg = `HTTP ${xhr.status}`;
            try {
              const errData = JSON.parse(xhr.responseText);
              if (errData?.userFriendlyMessage || errData?.error || errData?.message) {
                errMsg = errData.userFriendlyMessage || errData.error || errData.message;
              }
            } catch (e) {}
            reject(new Error(errMsg));
          }
        };

        xhr.onerror = () => reject(new Error("Network connection error during upload"));
        xhr.ontimeout = () => reject(new Error("Upload timed out"));
        xhr.timeout = 30000;

        const formData = new FormData();
        formData.append("file", file);
        formData.append("fileName", file.name);
        formData.append("mimeType", file.type || "application/octet-stream");
        formData.append("size", String(file.size));

        xhr.send(formData);
      });

      if (result && (result.success || result.documentId || result.document)) {
        if (onProgress) onProgress(100);
        return {
          success: true,
          ...result,
          documentId: result.documentId || result.document?.documentId,
          uploadToken: result.uploadToken || result.document?.uploadToken
        };
      }
    } catch (err: any) {
      lastError = err;
      console.warn(`Upload attempt via FormData to ${endpoint} notice:`, err?.message || err);
    }
  }

  let errMsg = "تعذر إكمال رفع الوثيقة إلى الخادم. يرجى إعادة المحاولة.";
  if (lastError?.message) {
    errMsg = lastError.message;
  }

  return { success: false, error: errMsg };
}

export async function submitAccountRecoveryRequestApi(payload: {
  email: string;
  fullName: string;
  phone: string;
  phoneVerified?: boolean;
  organization?: string;
  previousWorkspaceInfo?: string;
  reason: string;
  termsAccepted: boolean;
  documents: Array<{
    documentId: string;
    storageReference: string;
    fileName: string;
    mimeType: string;
    size: number;
    uploadedAt: string;
    uploadToken?: string;
  }>;
}) {
  let lastError: any = null;

  const candidateEndpoints = Array.from(new Set([
    getAuthApiUrl("/api/auth/recovery-request/submit"),
    getAuthApiUrl("/auth/recovery-request/submit"),
    getAuthApiUrl("/api/recovery-request/submit"),
    "/api/auth/recovery-request/submit",
    "/auth/recovery-request/submit",
    "/api/recovery-request/submit"
  ].filter(Boolean)));

  for (const endpoint of candidateEndpoints) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000);

      const res = await fetch(endpoint, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
          "X-HTTP-Method-Override": "POST"
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const parsed = await safeParseJsonResponse(res);
        if (parsed && (parsed.success || parsed.requestId || parsed.request)) {
          return parsed;
        }
      } else {
        const errData = await res.json().catch(() => null);
        if (errData?.userFriendlyMessage || errData?.error) {
          lastError = new Error(errData.userFriendlyMessage || errData.error);
        }
      }
    } catch (err: any) {
      lastError = err;
      console.warn(`submitAccountRecoveryRequestApi attempt on ${endpoint} notice:`, err?.message || err);
    }
  }

  const errMsg = lastError?.message && !lastError.message.includes("Failed to fetch")
    ? lastError.message
    : "تعذر إرسال طلب الاستعادة إلى الخادم. يرجى التحقق من اتصالك والمحاولة مجدداً.";

  return { success: false, error: errMsg };
}

export async function fetchAccountRecoveryStatusApi(email: string) {
  const normalizedEmail = (email || "").trim().toLowerCase();
  if (!normalizedEmail) {
    return { success: true, status: "none", recoveryRequest: null };
  }

  try {
    const res = await fetch(getAuthApiUrl(`/api/auth/recovery-request/status?email=${encodeURIComponent(normalizedEmail)}`), {
      method: "GET",
      credentials: "include"
    });
    const parsed = await safeParseJsonResponse(res);
    if (parsed && (parsed.success || parsed.recoveryRequest || parsed.status)) {
      return parsed;
    }
    return parsed;
  } catch (err: any) {
    console.warn("fetchAccountRecoveryStatusApi API error:", err?.message || err);
    return { success: false, status: "none", recoveryRequest: null, error: err.message || "فشل جلب حالة الاستعادة." };
  }
}

export async function fetchAdminRecoveryRequestsApi(idToken: string) {
  try {
    const res = await fetch(getAuthApiUrl("/api/admin/recovery-requests"), {
      method: "GET",
      credentials: "include",
      headers: idToken ? { "Authorization": `Bearer ${idToken}` } : {}
    });
    return await safeParseJsonResponse(res);
  } catch (err: any) {
    console.warn("fetchAdminRecoveryRequestsApi notice:", err?.message || err);
    return { success: false, error: err.message || "فشل جلب طلبات الاستعادة." };
  }
}

export async function handleAdminRecoveryRequestDecisionApi(
  idToken: string,
  requestId: string,
  email: string,
  action: "approve" | "reject",
  rejectionReason?: string,
  notes?: string
) {
  try {
    const res = await fetch(getAuthApiUrl("/api/admin/handle-recovery-request"), {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(idToken ? { "Authorization": `Bearer ${idToken}` } : {})
      },
      body: JSON.stringify({ requestId, email, action, rejectionReason, notes })
    });
    return await safeParseJsonResponse(res);
  } catch (err: any) {
    console.warn("handleAdminRecoveryRequestDecisionApi notice:", err?.message || err);
    return { success: false, error: err.message || "فشل اتخاذ القرار." };
  }
}

export async function sendRecoveryApprovalOtpApi(email: string) {
  try {
    const res = await fetch(getAuthApiUrl("/api/auth/recovery-request/send-approval-otp"), {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim().toLowerCase() })
    });
    return await safeParseJsonResponse(res);
  } catch (err: any) {
    console.warn("sendRecoveryApprovalOtpApi notice:", err?.message || err);
    return { success: false, error: err.message || "فشل إرسال رمز التحقق." };
  }
}

export async function verifyRecoveryApprovalOtpAndRestoreApi(email: string, code: string) {
  try {
    const res = await fetch(getAuthApiUrl("/api/auth/recovery-request/verify-otp-and-restore"), {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim().toLowerCase(), code: code.trim() })
    });
    return await safeParseJsonResponse(res);
  } catch (err: any) {
    console.warn("verifyRecoveryApprovalOtpAndRestoreApi notice:", err?.message || err);
    return { success: false, error: err.message || "فشل التحقق من الرمز واستعادة الحساب." };
  }
}

export async function requestAccountReactivationApi(email: string, reason?: string) {
  try {
    const res = await fetch(getAuthApiUrl("/api/auth/request-reactivation"), {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, reason })
    });
    return await safeParseJsonResponse(res);
  } catch (err: any) {
    console.error("requestAccountReactivationApi error:", err);
    return { success: false, error: err.message || "فشل تقديم طلب إعادة تفعيل الحساب." };
  }
}

export async function sendAccountRecoveryOtpApi(email: string) {
  try {
    const res = await fetch(getAuthApiUrl("/api/auth/send-verification-code"), {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim().toLowerCase(), type: "account_recovery" })
    });
    return await safeParseJsonResponse(res);
  } catch (err: any) {
    console.error("sendAccountRecoveryOtpApi error:", err);
    return { success: false, error: err.message || "فشل إرسال رمز التحقق للاستعادة." };
  }
}

export async function restoreAccountApi(email: string, code: string, password?: string) {
  try {
    const res = await fetch(getAuthApiUrl("/api/auth/restore-account"), {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        email: email.trim().toLowerCase(), 
        code: code.trim(),
        verificationCode: code.trim(),
        password: password ? password.trim() : undefined 
      })
    });
    return await safeParseJsonResponse(res);
  } catch (err: any) {
    console.error("restoreAccountApi error:", err);
    return { success: false, error: err.message || "فشل استعادة الحساب." };
  }
}

export async function loginWithCustomToken(customToken: string): Promise<User | null> {
  if (!customToken) return null;
  try {
    const userCredential = await signInWithCustomToken(auth, customToken);
    const uid = userCredential.user.uid;
    const userDocRef = doc(db, "users", uid);
    const userSnap = await getDoc(userDocRef);
    if (userSnap.exists()) {
      return userSnap.data() as User;
    }
  } catch (err) {
    console.warn("Client signInWithCustomToken warning:", err);
  }
  return null;
}

export async function checkWorkspaceInvitationApi(param: string | { email?: string; token?: string }) {
  try {
    let url = "/api/auth/check-invitation?";
    if (typeof param === "string") {
      url += `email=${encodeURIComponent(param.trim().toLowerCase())}`;
    } else {
      const searchParams = new URLSearchParams();
      if (param.email) searchParams.append("email", param.email.trim().toLowerCase());
      if (param.token) searchParams.append("token", param.token.trim());
      url += searchParams.toString();
    }
    const res = await fetch(url);
    const data = await safeJsonResponse(res);
    const inv = data?.invitation || null;
    if (inv && (inv.status || "").toString().toUpperCase() === "ACCEPTED") {
      return null;
    }
    return inv;
  } catch (err) {
    return null;
  }
}

/**
 * Delete a user account and clean up all associated user documents and files in Firestore
 */
export async function deleteFirebaseUserAccount(userId: string): Promise<void> {
  if (!userId) return;

  // Clean local storage
  clearUserLocalCache(userId);

  if (isFirestoreOffline) {
    return;
  }

  // 1. Mark user in /deletedUsers/{userId} collection
  try {
    await setDoc(doc(db, "deletedUsers", userId), {
      deletedAt: new Date().toISOString()
    });
  } catch (e) {
    console.warn("Write deletedUsers marker error:", e);
  }

  // 2. Delete user profile document /users/{userId}
  try {
    await deleteDoc(doc(db, "users", userId));
  } catch (e) {
    console.warn("Delete user profile doc error:", e);
  }

  // 2. Query and delete subcollection files /users/{userId}/files
  try {
    const userFilesSnap = await getDocs(collection(db, "users", userId, "files"));
    for (const fileDoc of userFilesSnap.docs) {
      await deleteDoc(fileDoc.ref);
    }
  } catch (e) {
    console.warn("Delete user subcollection files error:", e);
  }

  // 3. Query and delete top-level files where userId matches
  try {
    const q = query(collection(db, "files"), where("userId", "==", userId));
    const filesSnap = await getDocs(q);
    for (const fileDoc of filesSnap.docs) {
      await deleteDoc(fileDoc.ref);
    }
  } catch (e) {
    console.warn("Delete user top-level files error:", e);
  }

  // 4. Delete user memories /users/{userId}/memories
  try {
    const userMemoriesSnap = await getDocs(collection(db, "users", userId, "memories"));
    for (const memDoc of userMemoriesSnap.docs) {
      await deleteDoc(memDoc.ref);
    }
  } catch (e) {
    console.warn("Delete user memories error:", e);
  }

  // 5. Delete user risk alerts /users/{userId}/riskAlerts
  try {
    const userAlertsSnap = await getDocs(collection(db, "users", userId, "riskAlerts"));
    for (const alertDoc of userAlertsSnap.docs) {
      await deleteDoc(alertDoc.ref);
    }
  } catch (e) {
    console.warn("Delete user risk alerts error:", e);
  }
}

/**
 * Resilient Admin deletion helper that delegates authoritatively to backend endpoints,
 * preserves account recovery architecture, and ensures atomic Firestore & Auth synchronization.
 */
export async function deleteAdminUserAccountApi(userId: string, userEmail?: string): Promise<{ success: boolean; message?: string }> {
  if (!userId) {
    throw new Error("معرّف المستخدم مطلوب لإتمام عملية الحذف.");
  }

  const encodedId = encodeURIComponent(userId);
  const emailParam = userEmail ? `?userEmail=${encodeURIComponent(userEmail)}&userId=${encodedId}` : `?userId=${encodedId}`;

  const endpoints = [
    { url: `/api/admin/delete-user/${encodedId}${emailParam}`, method: "DELETE" },
    { url: `/api/admin/delete-user`, method: "POST" },
    { url: `/api/admin/delete-user/${encodedId}`, method: "POST" },
    { url: `/admin/delete-user/${encodedId}${emailParam}`, method: "DELETE" },
    { url: `/admin/delete-user`, method: "POST" },
    { url: `/api/admin/users/${encodedId}${emailParam}`, method: "DELETE" }
  ];

  let lastError: any = null;
  let backendSucceeded = false;

  for (const ep of endpoints) {
    try {
      const options: RequestInit = {
        method: ep.method,
        headers: {
          "Content-Type": "application/json"
        }
      };

      if (ep.method === "POST") {
        options.body = JSON.stringify({
          uid: userId,
          userId: userId,
          userEmail: userEmail || ""
        });
      }

      const response = await authenticatedFetch(ep.url, options);
      if (response.ok) {
        const data = await safeJsonResponse(response);
        backendSucceeded = true;
        clearUserLocalCache(userId);
        return {
          success: true,
          message: data?.userFriendlyMessage || data?.message || "تم حذف حساب المستخدم وأرشفة بياناته وفقًا لسياسة استعادة الحساب."
        };
      } else {
        const errData = await safeJsonResponse(response).catch(() => ({}));
        const serverErrMsg = errData?.userFriendlyMessage || errData?.error || `HTTP ${response.status}: ${response.statusText}`;
        lastError = new Error(serverErrMsg);
      }
    } catch (reqErr: any) {
      lastError = reqErr;
    }
  }

  if (backendSucceeded) {
    return { success: true };
  }

  throw lastError || new Error("فشل حذف حساب المستخدم من الخادم.");
}

/**
 * Real-time listener for single user profile updates in Firestore
 */
export function subscribeToFirebaseUserProfile(userId: string, callback: (user: User | null) => void) {
  if (!userId) return () => {};
  const userDocRef = doc(db, "users", userId);
  return onSnapshot(userDocRef, (docSnap) => {
    if (docSnap.exists()) {
      let uData = docSnap.data() as User;
      uData = normalizeStrictUserVerification(uData);
      setLocalItem(`user_${userId}`, uData);
      callback(uData);
    } else {
      callback(null);
    }
  }, (err) => {
    console.warn("User profile live snapshot listener error:", err);
    // Use local storage values
    let localUser = getLocalItem(`user_${userId}`, null);
    if (localUser) {
      localUser = normalizeStrictUserVerification(localUser);
      callback(localUser);
    }
  });
}

/**
 * Reset Firebase User Password via Email link
 */
export async function resetFirebaseUserPassword(email: string): Promise<void> {
  if (!email || !email.trim()) {
    throw new Error("Email address is required for password reset.");
  }
  const cleanEmail = email.trim().toLowerCase();
  
  try {
    const actionCodeSettings = {
      url: window.location.origin,
      handleCodeInApp: false
    };
    await sendPasswordResetEmail(auth, cleanEmail, actionCodeSettings);
  } catch (err: any) {
    // If custom actionCodeSettings URL origin is not authorized in Firebase Console, fallback to standard sendPasswordResetEmail
    await sendPasswordResetEmail(auth, cleanEmail);
  }
}

// ================= USER VERIFICATION & SUPPORT SERVICES =================

export const API_BASE_URL = typeof process !== 'undefined' && process.env?.NODE_ENV === 'production'
  ? ''
  : sanitizeBaseUrl((import.meta as any).env?.VITE_API_BASE_URL || (import.meta as any).env?.VITE_BACKEND_URL);

export const getAuthApiUrl = (endpoint: string) => {
  const formattedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;

  if (typeof window !== "undefined") {
    // Always use relative paths in the browser to ensure requests are routed to the current running origin
    return formattedEndpoint;
  }

  const rawBase = (import.meta as any).env?.VITE_API_BASE_URL || (import.meta as any).env?.VITE_BACKEND_URL || (typeof process !== "undefined" ? process.env?.VITE_API_BASE_URL || process.env?.VITE_BACKEND_URL : "");
  const customBase = sanitizeBaseUrl(rawBase);
  if (customBase) {
    return `${customBase}${formattedEndpoint}`;
  }

  return API_BASE_URL ? `${API_BASE_URL}${formattedEndpoint}` : `http://localhost:3000${formattedEndpoint}`;
};

/**
 * Safely parse JSON response with Content-Type validation and comprehensive HTTP status handling
 */
export async function safeParseJsonResponse(res: Response) {
  if (res.status === 413) {
    throw new Error(
      "The uploaded document is too large. Please select a file up to 5MB."
    );
  }
  if (res.status === 429) {
    throw new Error(
      "Too many requests. Please wait a moment before trying again."
    );
  }
  if (res.status === 503) {
    throw new Error(
      "The recovery service is temporarily unavailable. Please try again shortly."
    );
  }

  let text = "";
  let data: any = null;
  try {
    text = await res.text();
    if (text) {
      data = JSON.parse(text);
    }
  } catch (e) {
    // Response body is not valid JSON
  }

  if (data !== null) {
    if (!res.ok) {
      const errMsg = data.userFriendlyMessage || data.error || data.message || `Request failed with status ${res.status}`;
      console.warn("API Error Response:", res.status, errMsg);
      throw new Error(errMsg);
    }
    return data;
  }

  if (text.includes("<!DOCTYPE") || text.includes("<html")) {
    if (res.status === 404) {
      throw new Error("The requested service endpoint was not found (404).");
    }
    throw new Error(`Server returned unexpected format (${res.status}). Please try again.`);
  }

  if (text.includes("FUNCTION_INVOCATION_FAILED") || text.includes("FUNCTION_INVOCATION_TIMEOUT")) {
    throw new Error(`Server temporarily unavailable during processing (${res.status}). Please retry.`);
  }

  if (!res.ok) {
    if (res.status === 400) throw new Error("Invalid request data submitted.");
    if (res.status === 401) throw new Error("Authentication required.");
    if (res.status === 403) throw new Error("Access denied for this action.");
    if (res.status === 404) throw new Error("Requested resource was not found.");
    if (res.status === 405) throw new Error("لم يقبل الخادم طريقة الطلب الحالية (405 Method Not Allowed). يرجى إعادة المحاولة.");
    if (res.status >= 500) throw new Error(`Server error (${res.status}). Please try again.`);
    throw new Error(`Response error (${res.status}): ${text.slice(0, 100) || 'Invalid response'}`);
  }

  return { success: true };
}

/**
 * Send dynamic verification code (6 digits)
 */
export async function sendVerificationCodeApi(email: string, phone?: string, type = "account_registration", userId?: string, name?: string, lang?: string, isInitial = false) {
  const token = auth.currentUser ? await auth.currentUser.getIdToken() : "";
  try {
    const res = await fetch(getAuthApiUrl("/api/auth/send-verification-code"), {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        ...(token ? { "Authorization": `Bearer ${token}` } : {})
      },
      body: JSON.stringify({ email, emailOrPhone: email, phone, type, userId, name, lang, isInitial })
    });
    
    return await safeParseJsonResponse(res);
  } catch (err: any) {
    console.error("sendVerificationCodeApi error:", err);
    throw err;
  }
}

/**
 * Verify 6-digit code
 */
export async function verifyCodeApi(email: string, code: string, type = "account_registration", phone?: string, userId?: string) {
  const token = auth.currentUser ? await auth.currentUser.getIdToken() : "";
  try {
    const res = await fetch(getAuthApiUrl("/api/auth/verify-code"), {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { "Authorization": `Bearer ${token}` } : {}) },
      body: JSON.stringify({ email, emailOrPhone: email, phone, code, type, userId })
    });

    return await safeParseJsonResponse(res);
  } catch (err: any) {
    console.error("verifyCodeApi error:", err);
    throw err;
  }
}

/**
 * Request Password Reset Verification Code
 */
export async function requestPasswordResetCodeApi(emailOrPhone: string, name?: string, lang?: string) {
  const token = auth.currentUser ? await auth.currentUser.getIdToken() : "";
  try {
    const res = await fetch(getAuthApiUrl("/api/auth/send-verification-code"), {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { "Authorization": `Bearer ${token}` } : {}) },
      body: JSON.stringify({ email: emailOrPhone, emailOrPhone, type: "password_reset", name, lang })
    });

    return await safeParseJsonResponse(res);
  } catch (err: any) {
    console.error("requestPasswordResetCodeApi error:", err);
    throw err;
  }
}

/**
 * Reset Password with Code
 */
export async function resetPasswordWithCodeApi(emailOrPhone: string, code: string, newPassword: string) {
  const token = auth.currentUser ? await auth.currentUser.getIdToken() : "";
  try {
    const res = await fetch(getAuthApiUrl("/api/auth/reset-password"), {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { "Authorization": `Bearer ${token}` } : {}) },
      body: JSON.stringify({ emailOrPhone, code, newPassword })
    });

    return await safeParseJsonResponse(res);
  } catch (err: any) {
    console.error("resetPasswordWithCodeApi error:", err);
    throw err;
  }
}

/**
 * Create Customer Support Ticket (Firestore + Server sync)
 */
export async function createSupportTicketApi(ticketData: {
  userId: string;
  userEmail: string;
  userName: string;
  userPhone?: string;
  companyName?: string;
  category: string;
  subject: string;
  message: string;
  priority?: string;
}) {
  try {
    // 1. Post to Express API (Primary Server Persistence)
    const res = await authenticatedFetch("/api/support/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(ticketData)
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("Server error response:", text);
      let errorMsg = "حدث خطأ في الاتصال بالسيرفر";
      try {
        const json = JSON.parse(text);
        if (json.error) errorMsg = json.error;
      } catch (e) {
        if (text.includes("<!DOCTYPE") || text.includes("<html")) {
          errorMsg = "خطأ في الاتصال بالخادم (الخادم عاد بصفحة خطأ HTML بدلاً من JSON)";
        } else if (text.trim()) {
          errorMsg = text;
        }
      }
      throw new Error(errorMsg);
    }

    const data = await safeJsonResponse(res, "فشل إنشاء تذكرة الدعم.");
    const ticket = data.ticket;

    // 2. Secondary Sync to Firestore collection support_tickets (Non-blocking fallback)
    try {
      if (ticket && ticket.id) {
        await setDoc(doc(db, "support_tickets", ticket.id), ticket);
      }
    } catch (fsErr) {
      console.warn("Client Firestore write for support ticket warning (proceeding via server):", fsErr);
    }

    return ticket;
  } catch (err: any) {
    console.error("createSupportTicketApi error:", err);
    throw err;
  }
}

/**
 * Fetch Support Tickets
 */
export async function fetchSupportTicketsApi(userId?: string, userEmail?: string, isAdmin = false) {
  let token = "";
  try {
    if (auth.currentUser) {
      token = await auth.currentUser.getIdToken().catch(() => "");
    }
  } catch (e) {}

  try {
    let tickets: any[] = [];

    // 1. Fetch from Firestore if possible without throwing fatal errors
    try {
      let q;
      if (isAdmin) {
        q = query(collection(db, "support_tickets"), orderBy("createdAt", "desc"));
      } else if (userId) {
        q = query(collection(db, "support_tickets"), where("userId", "==", userId));
      } else if (userEmail) {
        q = query(collection(db, "support_tickets"), where("userEmail", "==", userEmail));
      }
      if (q) {
        const snap = await getDocs(q);
        tickets = snap.docs.map(doc => doc.data());
      }
    } catch (fsErr) {
      // Ignore Firestore permission errors when unauthenticated
    }

    // 2. Fallback to Express API endpoint
    if (!tickets || tickets.length === 0) {
      const queryParams = new URLSearchParams();
      if (userId) queryParams.append("userId", userId);
      if (userEmail) queryParams.append("userEmail", userEmail);
      if (isAdmin) queryParams.append("isAdmin", "true");

      try {
        const res = await fetch(`/api/support/tickets?${queryParams.toString()}`, {
          headers: token ? { "Authorization": `Bearer ${token}` } : {}
        });
        if (res.ok) {
          const data = await safeJsonResponse(res);
          tickets = data.tickets || [];
        } else if (res.status === 401) {
          return [];
        }
      } catch (apiErr) {
        // network or server error, return empty array gracefully
      }
    }

    return tickets || [];
  } catch (err: any) {
    return [];
  }
}

/**
 * Add Reply to Support Ticket Thread
 */
export async function addSupportTicketMessageApi(ticketId: string, messageData: {
  senderType: "user" | "admin";
  senderName: string;
  senderEmail: string;
  message: string;
}) {
  const token = auth.currentUser ? await auth.currentUser.getIdToken() : "";
  try {
    // 1. Post to Express API
    const res = await fetch(`/api/support/tickets/${ticketId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { "Authorization": `Bearer ${token}` } : {}) },
      body: JSON.stringify(messageData)
    });
    const data = await safeJsonResponse(res, "فشل إضافة الرسالة");
    if (!res.ok || !data.success) {
      throw new Error(data.userFriendlyMessage || data.error || "Failed to add message");
    }

    const updatedTicket = data.ticket;

    // 2. Sync to Firestore (Non-blocking)
    try {
      if (updatedTicket) {
        await setDoc(doc(db, "support_tickets", ticketId), updatedTicket, { merge: true });
      }
    } catch (fsErr) {
      console.warn("Client Firestore ticket message update notice:", fsErr);
    }

    return data;
  } catch (err: any) {
    console.error("addSupportTicketMessageApi error:", err);
    throw err;
  }
}

/**
 * Update Support Ticket Status/Priority/Notes (Admin)
 */
export async function updateSupportTicketStatusApi(ticketId: string, updateData: {
  status?: string;
  priority?: string;
  adminNotes?: string;
}) {
  const token = auth.currentUser ? await auth.currentUser.getIdToken() : "";
  try {
    const res = await fetch(`/api/support/tickets/${ticketId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...(token ? { "Authorization": `Bearer ${token}` } : {}) },
      body: JSON.stringify(updateData)
    });
    const data = await safeJsonResponse(res, "فشل تحديث حالة التذكرة");
    if (!res.ok || !data.success) {
      throw new Error(data.userFriendlyMessage || data.error || "Failed to update ticket status");
    }

    const updatedTicket = data.ticket;

    // Sync to Firestore
    try {
      if (updatedTicket) {
        await setDoc(doc(db, "support_tickets", ticketId), updatedTicket, { merge: true });
      }
    } catch (fsErr) {
      console.warn("Client Firestore ticket patch notice:", fsErr);
    }

    return data;
  } catch (err: any) {
    console.error("updateSupportTicketStatusApi error:", err);
    throw err;
  }
}

/**
 * Real-time listener for support tickets (Firestore Live Updates)
 */
export function subscribeToSupportTickets(userId: string, isAdmin: boolean, callback: (tickets: any[]) => void) {
  try {
    let q;
    if (isAdmin) {
      q = query(collection(db, "support_tickets"), orderBy("createdAt", "desc"));
    } else if (userId) {
      q = query(collection(db, "support_tickets"), where("userId", "==", userId));
    }
    if (!q) return () => {};

    return onSnapshot(q, (snap) => {
      const tickets = snap.docs.map(d => d.data());
      callback(tickets);
    }, (err) => {
      console.warn("Support tickets live listener notice:", err);
      // Fallback polling fetch
      fetchSupportTicketsApi(userId, undefined, isAdmin).then(callback);
    });
  } catch (err) {
    console.warn("subscribeToSupportTickets setup notice:", err);
    return () => {};
  }
}

/**
 * Real-time listener for Platform Events (Firestore Live Updates)
 */
export function subscribeToPlatformEvents(callback: (events: any[]) => void) {
  try {
    const q = query(collection(db, "platform_events"), orderBy("timestamp", "desc"), limit(100));
    return onSnapshot(
      q,
      (snap) => {
        const events = snap.docs.map((d) => ({ ...d.data(), id: d.id }));
        callback(events);
      },
      async (err) => {
        console.warn("Platform events live listener notice:", err);
        try {
          const res = await authenticatedFetch("/api/admin/platform-events?limit=100");
          const data = await safeJsonResponse(res);
          if (data.events) callback(data.events);
        } catch (e) {}
      }
    );
  } catch (err) {
    console.warn("subscribeToPlatformEvents error:", err);
    return () => {};
  }
}

/**
 * Real-time listener for Platform Incidents (Firestore Live Updates)
 */
export function subscribeToPlatformIncidents(callback: (incidents: any[]) => void) {
  try {
    const q = query(collection(db, "platform_incidents"), orderBy("createdAt", "desc"), limit(50));
    return onSnapshot(
      q,
      (snap) => {
        const incidents = snap.docs.map((d) => ({ ...d.data(), id: d.id }));
        callback(incidents);
      },
      async (err) => {
        console.warn("Platform incidents live listener notice:", err);
        try {
          const res = await authenticatedFetch("/api/admin/incidents?limit=50");
          const data = await safeJsonResponse(res);
          if (data.incidents) callback(data.incidents);
        } catch (e) {}
      }
    );
  } catch (err) {
    console.warn("subscribeToPlatformIncidents error:", err);
    return () => {};
  }
}

/**
 * Real-time listener for Admin Notifications (Firestore Live Updates)
 */
export function subscribeToAdminNotifications(callback: (notifications: any[], unreadCount: number) => void) {
  try {
    const q = query(collection(db, "admin_notifications"), orderBy("createdAt", "desc"), limit(50));
    return onSnapshot(
      q,
      (snap) => {
        const notifs = snap.docs.map((d) => ({ ...d.data(), id: d.id }));
        const unreadCount = notifs.filter((n: any) => !n.read).length;
        callback(notifs, unreadCount);
      },
      async (err) => {
        console.warn("Admin notifications live listener notice:", err);
        try {
          const res = await authenticatedFetch("/api/admin/notifications?limit=50");
          const data = await safeJsonResponse(res);
          if (data.notifications) {
            callback(data.notifications, data.unreadCount || 0);
          }
        } catch (e) {}
      }
    );
  } catch (err) {
    console.warn("subscribeToAdminNotifications error:", err);
    return () => {};
  }
}


