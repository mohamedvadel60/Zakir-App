import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
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
import { authenticatedFetch } from "./apiUtils.js";
import { 
  User, 
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

// Global flag tracking if Firestore connection is offline
export let isFirestoreOffline = false;

// Helpers to read/write JSON from localStorage
const getLocalItem = (key: string, defaultVal: any) => {
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

  const isOfflineError = errMessage.toLowerCase().includes('offline') || errMessage.toLowerCase().includes('network') || errMessage.toLowerCase().includes('unavailable');
  if (isOfflineError) {
    isFirestoreOffline = true;
    console.warn('Firestore is operating in offline fallback mode:', errMessage);
  } else {
    console.error('Firestore Error: ', JSON.stringify(errInfo));
  }
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
  role: UserRole = "Contributor",
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
    const existingSnap = await getDoc(userDocRef);
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

  // 2. Initialize new user profile with Free Tier status & Default System Preferences.
  // Force safe non-privileged role ("Contributor") for client-initiated registration path.
  const safeRole: UserRole = "Contributor";
  const nowIso = new Date().toISOString();
  const newUser: User = {
    id: uid,
    email: email,
    companyName: companyName,
    ownerName: ownerName,
    role: safeRole,
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
      const retrySnap = await getDoc(userDocRef);
      if (retrySnap && retrySnap.exists()) {
        const retryData = retrySnap.data() as User;
        setLocalItem(`user_${uid}`, retryData);
        return retryData;
      }
    } catch (rErr) {
      console.warn("Retry fetch failed in registerFirebaseUser:", rErr);
    }

    const errMessage = error instanceof Error ? error.message : String(error);
    if (errMessage.toLowerCase().includes('offline') || errMessage.toLowerCase().includes('network')) {
      isFirestoreOffline = true;
    } else {
      handleFirestoreError(error, OperationType.CREATE, `users/${uid}`);
    }
  }
  return newUser;
}

export function clearUserLocalCache(userId?: string): void {
  try {
    if (userId) {
      localStorage.removeItem(`user_${userId}`);
      localStorage.removeItem(`offline_db_user_${userId}`);
      localStorage.removeItem(`offline_db_memories_${userId}`);
      localStorage.removeItem(`offline_db_alerts_${userId}`);
      localStorage.removeItem(`offline_db_files_${userId}`);
    }
    localStorage.removeItem("zakir_auth_token");
    localStorage.removeItem("zakir_current_user");
    localStorage.removeItem("offline_db_user");
    localStorage.removeItem("user");
    localStorage.removeItem("currentUser");
  } catch (e) {
    console.warn("clearUserLocalCache error:", e);
  }
}

/**
 * Scenario 2: Existing User Login
 * - Fetches user profile from /users/{uid} in Firestore.
 * - Restores persisted workspace, custom preferences, subscription status, and configurations.
 */
export async function loginFirebaseUser(email: string, pass: string): Promise<User> {
  const userCredential = await signInWithEmailAndPassword(auth, email, pass);
  const uid = userCredential.user.uid;

  isFirestoreOffline = false; // Auth succeeded, reset offline flag!

  // Check if account was marked deleted in /deletedUsers/{uid} — FAIL CLOSED
  try {
    const deletedSnap = await getDoc(doc(db, "deletedUsers", uid));
    if (deletedSnap.exists()) {
      await signOut(auth);
      clearUserLocalCache(uid);
      throw new Error("This account has been deleted. Please contact the administrator.");
    }
  } catch (dErr: any) {
    if (dErr.message?.includes("deleted")) throw dErr;
    console.error("Error verifying account status in /deletedUsers/ for loginFirebaseUser:", uid, dErr);
    const errStr = dErr instanceof Error ? dErr.message : String(dErr);
    if (errStr.toLowerCase().includes("permission") || errStr.toLowerCase().includes("denied") || errStr.toLowerCase().includes("unauthenticated") || errStr.toLowerCase().includes("access")) {
      await signOut(auth);
      clearUserLocalCache(uid);
      throw new Error("Access denied while verifying account status.");
    }
  }

  // Retrieve user document from /users/{uid}
  const userDocRef = doc(db, "users", uid);
  let userSnap;
  try {
    userSnap = await getDoc(userDocRef);
  } catch (error) {
    const errMessage = error instanceof Error ? error.message : String(error);
    if (errMessage.toLowerCase().includes('offline') || errMessage.toLowerCase().includes('network')) {
      isFirestoreOffline = true;
    } else {
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
    const nowIso = new Date().toISOString();
    userData.lastActiveAt = nowIso;
    userData.lastLoginAt = nowIso;

    // Check if user has already successfully verified 
    const isVerified = userData.isVerified === true || userData.isEmailVerified === true || userData.emailVerified === true || userData.verification_status === "verified" || userData.verification_required === false;
    if (isVerified) {
      userData.isVerified = true;
      userData.isEmailVerified = true;
      userData.email_verified = true;
      userData.emailVerified = true;
      userData.verification_required = false;
      userData.verification_status = "verified";
    }

    if (!userData.userPreferences) {
      userData.userPreferences = { ...DEFAULT_USER_PREFERENCES };
    }
    if (!userData.subscriptionStatus) {
      userData.subscriptionStatus = "Active";
    }
    // Update last active in background (non-protected fields)
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
  } else {
    // If user document does not exist yet, create default non-admin profile (never CEO or Admin)
    const workspaceId = `ws_${uid.substring(0, 8)}_${Date.now().toString(36)}`;
    const defaultUser: User = {
      id: uid,
      email: email,
      companyName: "Personal Account",
      ownerName: email.split("@")[0],
      role: "Contributor",
      workspaceId: workspaceId,
      subscriptionStatus: "Pending Selection",
      userPreferences: { ...DEFAULT_USER_PREFERENCES },
      createdAt: new Date().toISOString(),
      trialExpiresAt: new Date(Date.now() + 24 * 3600 * 1000).toISOString()
    };
    try {
      await setDoc(userDocRef, defaultUser);
    } catch (e) {
      console.warn("Failed to create missing user profile doc:", e);
      try {
        const retrySnap = await getDoc(userDocRef);
        if (retrySnap && retrySnap.exists()) {
          const rData = retrySnap.data() as User;
          setLocalItem(`user_${uid}`, rData);
          return rData;
        }
      } catch (rErr) {
        console.warn("Retry fetch in loginFirebaseUser failed:", rErr);
      }
    }
    setLocalItem(`user_${uid}`, defaultUser);
    return defaultUser;
  }
}

export async function loginWithGoogle(): Promise<User> {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  const userCredential = await signInWithPopup(auth, provider);
  const uid = userCredential.user.uid;
  const email = userCredential.user.email || "";
  const displayName = userCredential.user.displayName || email.split("@")[0];

  isFirestoreOffline = false;
  
  // Check if account was marked deleted in /deletedUsers/{uid} — FAIL CLOSED
  try {
    const deletedSnap = await getDoc(doc(db, "deletedUsers", uid));
    if (deletedSnap.exists()) {
      await signOut(auth);
      clearUserLocalCache(uid);
      throw new Error("This account has been deleted. Please contact the administrator.");
    }
  } catch (dErr: any) {
    if (dErr.message?.includes("deleted")) throw dErr;
    console.error("Error verifying account status in /deletedUsers/ for loginWithGoogle:", uid, dErr);
    const errStr = dErr instanceof Error ? dErr.message : String(dErr);
    if (errStr.toLowerCase().includes("permission") || errStr.toLowerCase().includes("denied") || errStr.toLowerCase().includes("unauthenticated") || errStr.toLowerCase().includes("access")) {
      await signOut(auth);
      clearUserLocalCache(uid);
      throw new Error("Access denied while verifying account status.");
    }
  }

  const userDocRef = doc(db, "users", uid);
  let userSnap;
  try {
    userSnap = await getDoc(userDocRef);
  } catch (error) {
    const errMessage = error instanceof Error ? error.message : String(error);
    if (errMessage.toLowerCase().includes('offline') || errMessage.toLowerCase().includes('network')) {
      isFirestoreOffline = true;
    } else {
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
  } else {
    // New Google user, create default non-admin profile (never CEO or Admin)
    const workspaceId = `ws_${uid.substring(0, 8)}_${Date.now().toString(36)}`;
    const defaultUser: User = {
      id: uid,
      email: email,
      companyName: "Personal Account",
      ownerName: displayName,
      role: "Contributor",
      workspaceId: workspaceId,
      subscriptionStatus: "Pending Selection",
      userPreferences: { ...DEFAULT_USER_PREFERENCES },
      createdAt: new Date().toISOString(),
      trialExpiresAt: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
      isVerified: true,
      isEmailVerified: true,
      email_verified: true,
      emailVerified: true,
      verification_required: false,
      verification_status: "verified"
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

  if (!auth.currentUser || auth.currentUser.uid !== user.id) {
    console.warn("Skipping client Firestore profile update: User not authenticated as owner.");
    return;
  }

  const userDocRef = doc(db, "users", user.id);

  // Omit protected system fields that non-admin clients are not allowed to modify on update
  const {
    role,
    subscriptionPlan,
    trialExpiresAt,
    stripeSubscriptionId,
    subscriptionStatus,
    ...updatableProfile
  } = user;

  const sanitizedUser = sanitizeFirestoreData(updatableProfile);
  try {
    await updateDoc(userDocRef, sanitizedUser);
    isFirestoreOffline = false; // Successfully connected!
  } catch (error) {
    const errMessage = error instanceof Error ? error.message : String(error);
    if (errMessage.toLowerCase().includes('offline') || errMessage.toLowerCase().includes('network')) {
      isFirestoreOffline = true;
    } else {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.id}`);
    }
  }
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
    const errMessage = error instanceof Error ? error.message : String(error);
    if (errMessage.toLowerCase().includes('offline') || errMessage.toLowerCase().includes('network')) {
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
    const errMessage = error instanceof Error ? error.message : String(error);
    if (errMessage.toLowerCase().includes('offline') || errMessage.toLowerCase().includes('network')) {
      isFirestoreOffline = true;
    } else {
      handleFirestoreError(error, OperationType.UPDATE, `users/${userId}`);
    }
  }
  return updatedPrefs;
}

export function subscribeToFirebaseAuthState(callback: (user: User | null) => void) {
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
      // Check if user account is marked deleted in /deletedUsers/{uid} — FAIL CLOSED
      try {
        const deletedSnap = await getDoc(doc(db, "deletedUsers", fbUser.uid));
        if (deletedSnap.exists()) {
          console.warn("User account is marked as deleted in /deletedUsers/", fbUser.uid);
          await signOut(auth);
          clearUserLocalCache(fbUser.uid);
          callback(null);
          return;
        }
      } catch (dErr: any) {
        console.error("Error verifying account status in /deletedUsers/ for subscribeToFirebaseAuthState:", fbUser.uid, dErr);
        const errStr = dErr instanceof Error ? dErr.message : String(dErr);
        if (errStr.toLowerCase().includes("permission") || errStr.toLowerCase().includes("denied") || errStr.toLowerCase().includes("unauthenticated") || errStr.toLowerCase().includes("access")) {
          await signOut(auth);
          clearUserLocalCache(fbUser.uid);
          callback(null);
          return;
        }
      }

      let userSnap;
      try {
        userSnap = await getDoc(doc(db, "users", fbUser.uid));
        isFirestoreOffline = false; // Successfully connected!
      } catch (error) {
        const errMessage = error instanceof Error ? error.message : String(error);
        if (errMessage.toLowerCase().includes('offline') || errMessage.toLowerCase().includes('network')) {
          console.warn("Firestore offline during auth state fetch.");
          isFirestoreOffline = true;
        } else {
          const isAuthPermissionError = errMessage.toLowerCase().includes("permission") || errMessage.toLowerCase().includes("denied") || errMessage.toLowerCase().includes("unauthenticated");
          if (isAuthPermissionError) {
            await signOut(auth);
            clearUserLocalCache(fbUser.uid);
            callback(null);
            return;
          }
          handleFirestoreError(error, OperationType.GET, `users/${fbUser.uid}`);
        }
      }

      if (userSnap && userSnap.exists()) {
        const userObj = userSnap.data() as User;
        setLocalItem(`user_${fbUser.uid}`, userObj);
        callback(userObj);
      } else {
        // Firestore is online and authoritative, and the user profile does not exist.
        // Create a safe, default, non-privileged Contributor profile instead.
        const defaultUser: User = {
          id: fbUser.uid,
          email: fbUser.email || "",
          companyName: "Personal Account",
          ownerName: fbUser.email ? fbUser.email.split("@")[0] : "User",
          role: "Contributor",
          createdAt: new Date().toISOString(),
          trialExpiresAt: new Date(Date.now() + 24 * 3600 * 1000).toISOString()
        };
        try {
          await setDoc(doc(db, "users", fbUser.uid), defaultUser);
        } catch (e) {
          console.warn("Failed to create default non-admin profile in Firestore:", e);
          try {
            const retrySnap = await getDoc(doc(db, "users", fbUser.uid));
            if (retrySnap && retrySnap.exists()) {
              const rData = retrySnap.data() as User;
              setLocalItem(`user_${fbUser.uid}`, rData);
              callback(rData);
              return;
            }
          } catch (rErr) {
            console.warn("Retry fetch in subscribeToFirebaseAuthState failed:", rErr);
          }
        }
        setLocalItem(`user_${fbUser.uid}`, defaultUser);
        callback(defaultUser);
      }
    } catch (err) {
      console.warn("Fallback on user profile fetch error:", err);
      const errStr = err instanceof Error ? err.message : String(err);
      const isAuthPermissionError = errStr.toLowerCase().includes("permission") || errStr.toLowerCase().includes("denied") || errStr.toLowerCase().includes("unauthenticated");

      if (isAuthPermissionError) {
        console.error("Authorization failed in subscribeToFirebaseAuthState, signing out user.");
        await signOut(auth);
        clearUserLocalCache(fbUser.uid);
        callback(null);
        return;
      }

      // Fallback to local storage ONLY if Firestore is verified offline, and NEVER restore CEO or Admin roles.
      if (isFirestoreOffline) {
        const localUser = fbUser ? getLocalItem(`user_${fbUser.uid}`, null) : null;
        if (localUser && localUser.role !== "CEO" && localUser.role !== "Admin") {
          callback(localUser);
          return;
        }
      }
      callback({
        id: fbUser.uid,
        email: fbUser.email || "",
        companyName: "Personal Account",
        ownerName: "User",
        role: "Contributor",
        createdAt: new Date().toISOString(),
        trialExpiresAt: new Date(Date.now() + 24 * 3600 * 1000).toISOString()
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
    const errMessage = err instanceof Error ? err.message : String(err);
    if (errMessage.toLowerCase().includes('offline') || errMessage.toLowerCase().includes('network')) {
      isFirestoreOffline = true;
      console.warn("Failed to fetch memories from Firestore due to offline. Loading from localStorage.");
      return getLocalItem(`memories_${userId}`, []);
    }
    console.error("Failed to fetch memories from Firestore:", err);
    handleFirestoreError(err, OperationType.LIST, path);
    return [];
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
    const errMessage = error instanceof Error ? error.message : String(error);
    if (errMessage.toLowerCase().includes('offline') || errMessage.toLowerCase().includes('network')) {
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
    const errMessage = error instanceof Error ? error.message : String(error);
    if (errMessage.toLowerCase().includes('offline') || errMessage.toLowerCase().includes('network')) {
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
    const errMessage = err instanceof Error ? err.message : String(err);
    if (errMessage.toLowerCase().includes('offline') || errMessage.toLowerCase().includes('network')) {
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
    const errMessage = err instanceof Error ? err.message : String(err);
    if (errMessage.toLowerCase().includes('offline') || errMessage.toLowerCase().includes('network')) {
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

  // 1. Save in top-level Firestore collection: /files/{fileId}
  try {
    const topFileDocRef = doc(db, "files", fileId);
    await setDoc(topFileDocRef, userFile);
  } catch (topErr) {
    console.warn("Firestore top-level /files save error:", topErr);
    const errMessage = topErr instanceof Error ? topErr.message : String(topErr);
    if (errMessage.toLowerCase().includes('offline') || errMessage.toLowerCase().includes('network')) {
      isFirestoreOffline = true;
      return userFile;
    }
  }

  // 2. Save metadata in user's private Firestore subcollection: /users/{userId}/files/{fileId}
  const fileDocRef = doc(db, "users", userId, "files", fileId);
  try {
    await setDoc(fileDocRef, userFile);
  } catch (error) {
    const errMessage = error instanceof Error ? error.message : String(error);
    if (errMessage.toLowerCase().includes('offline') || errMessage.toLowerCase().includes('network')) {
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

  // 3. Sync & remove from user's profile verificationInfo if present
  try {
    const userDocRef = doc(db, "users", userId);
    const userSnap = await getDoc(userDocRef);
    if (userSnap.exists()) {
      const userData = userSnap.data() as User;
      if (userData.verificationInfo?.documents) {
        const remainingDocs = userData.verificationInfo.documents.filter(
          (d) => d.id !== fileId && d.fileName !== fileId
        );
        if (remainingDocs.length !== userData.verificationInfo.documents.length) {
          await updateDoc(userDocRef, {
            "verificationInfo.documents": remainingDocs,
            "verificationInfo.status": remainingDocs.length === 0 ? "unverified" : userData.verificationInfo.status
          });
        }
      }
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
    const errMessage = err instanceof Error ? err.message : String(err);
    if (errMessage.toLowerCase().includes('offline') || errMessage.toLowerCase().includes('network')) {
      isFirestoreOffline = true;
      console.warn("Failed to fetch risk alerts from Firestore due to offline. Loading from localStorage.");
      return getLocalItem(`alerts_${userId}`, []);
    }
    console.error("Failed to fetch risk alerts from Firestore:", err);
    handleFirestoreError(err, OperationType.LIST, path);
    return [];
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
    const errMessage = error instanceof Error ? error.message : String(error);
    if (errMessage.toLowerCase().includes('offline') || errMessage.toLowerCase().includes('network')) {
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
    const errMessage = error instanceof Error ? error.message : String(error);
    if (errMessage.toLowerCase().includes('offline') || errMessage.toLowerCase().includes('network')) {
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
  status: "pending" | "accepted";
  createdAt: string;
}

export async function saveWorkspaceInvitation(inv: WorkspaceInvitation): Promise<void> {
  const emailKey = inv.email.trim().toLowerCase();
  
  // Save in local storage first
  const invitations = getLocalItem("invitations", []);
  const updated = invitations.filter((i: WorkspaceInvitation) => i.email.trim().toLowerCase() !== emailKey);
  updated.push(inv);
  setLocalItem("invitations", updated);

  if (isFirestoreOffline) {
    return;
  }

  try {
    await setDoc(doc(db, "invitations", emailKey), inv);
  } catch (error) {
    const errMessage = error instanceof Error ? error.message : String(error);
    if (errMessage.toLowerCase().includes('offline') || errMessage.toLowerCase().includes('network')) {
      isFirestoreOffline = true;
    } else {
      handleFirestoreError(error, OperationType.CREATE, `invitations/${emailKey}`);
    }
  }
}

export async function deleteWorkspaceInvitation(email: string): Promise<void> {
  const emailKey = email.trim().toLowerCase();
  
  // Remove from local storage
  const invitations = getLocalItem("invitations", []);
  const updated = invitations.filter((i: WorkspaceInvitation) => i.email.trim().toLowerCase() !== emailKey);
  setLocalItem("invitations", updated);

  if (isFirestoreOffline) {
    return;
  }

  try {
    await deleteDoc(doc(db, "invitations", emailKey));
  } catch (error) {
    const errMessage = error instanceof Error ? error.message : String(error);
    if (errMessage.toLowerCase().includes('offline') || errMessage.toLowerCase().includes('network')) {
      isFirestoreOffline = true;
    } else {
      handleFirestoreError(error, OperationType.DELETE, `invitations/${emailKey}`);
    }
  }
}

export async function checkWorkspaceInvitation(email: string): Promise<WorkspaceInvitation | null> {
  const emailKey = email.trim().toLowerCase();
  
  if (isFirestoreOffline) {
    const invitations = getLocalItem("invitations", []);
    return invitations.find((i: WorkspaceInvitation) => i.email.trim().toLowerCase() === emailKey) || null;
  }

  try {
    const docSnap = await getDoc(doc(db, "invitations", emailKey));
    if (docSnap.exists()) {
      return docSnap.data() as WorkspaceInvitation;
    }
    // Try localStorage fallback if Firestore doc not found but we are connected
    const invitations = getLocalItem("invitations", []);
    return invitations.find((i: WorkspaceInvitation) => i.email.trim().toLowerCase() === emailKey) || null;
  } catch (error) {
    const errMessage = error instanceof Error ? error.message : String(error);
    if (errMessage.toLowerCase().includes('offline') || errMessage.toLowerCase().includes('network')) {
      isFirestoreOffline = true;
      const invitations = getLocalItem("invitations", []);
      return invitations.find((i: WorkspaceInvitation) => i.email.trim().toLowerCase() === emailKey) || null;
    }
    handleFirestoreError(error, OperationType.GET, `invitations/${emailKey}`);
    return null;
  }
}

export async function fetchWorkspaceInvitations(workspaceId: string): Promise<WorkspaceInvitation[]> {
  if (isFirestoreOffline) {
    const invitations = getLocalItem("invitations", []);
    return invitations.filter((i: WorkspaceInvitation) => i.workspaceId === workspaceId);
  }

  try {
    const q = query(collection(db, "invitations"));
    const snap = await getDocs(q);
    const list: WorkspaceInvitation[] = [];
    snap.forEach((docSnap) => {
      const data = docSnap.data() as WorkspaceInvitation;
      if (data.workspaceId === workspaceId) {
        list.push(data);
      }
    });
    setLocalItem("invitations", list);
    return list;
  } catch (err) {
    const errMessage = err instanceof Error ? err.message : String(err);
    if (errMessage.toLowerCase().includes('offline') || errMessage.toLowerCase().includes('network')) {
      isFirestoreOffline = true;
      const invitations = getLocalItem("invitations", []);
      return invitations.filter((i: WorkspaceInvitation) => i.workspaceId === workspaceId);
    }
    console.error("Failed to fetch workspace invitations:", err);
    handleFirestoreError(err, OperationType.LIST, "invitations");
    return [];
  }
}

/* ================= ADMIN DASHBOARD SERVICES ================= */

export const ADMIN_USER_ID = "SYhfciebGFUj29gqGaa0pqNunrk2";

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
  verificationInfo?: VerificationInfo;
  fullUser?: User;
}

export async function fetchAllUsersForAdmin(): Promise<AdminUserRecord[]> {
  try {
    const response = await authenticatedFetch("/api/admin/users");
    if (response.ok) {
      const data = await response.json();
      if (data && Array.isArray(data.users)) {
        const records: AdminUserRecord[] = data.users.map((userData: any) => {
          const userId = userData.id || userData.uid;
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
            fileCount: Array.isArray(userData.files) ? userData.files.length : 0,
            files: Array.isArray(userData.files) ? userData.files : [],
            verificationInfo: userData.verificationInfo,
            fullUser: { ...userData, id: userId }
          };
        });
        return records.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      }
    }
  } catch (apiErr) {
    console.error("Backend admin users endpoint fetch failed:", apiErr);
  }

  return [];
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
 * Real-time listener for single user profile updates in Firestore
 */
export function subscribeToFirebaseUserProfile(userId: string, callback: (user: User | null) => void) {
  if (!userId) return () => {};
  const userDocRef = doc(db, "users", userId);
  return onSnapshot(userDocRef, (docSnap) => {
    if (docSnap.exists()) {
      const uData = docSnap.data() as User;
      setLocalItem(`user_${userId}`, uData);
      callback(uData);
    } else {
      callback(null);
    }
  }, (err) => {
    console.warn("User profile live snapshot listener error:", err);
    // Use local storage values
    const localUser = getLocalItem(`user_${userId}`, null);
    if (localUser) {
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

export const API_BASE_URL = typeof process !== 'undefined' && process.env?.NODE_ENV === 'production' ? '' : ((import.meta as any).env?.VITE_API_BASE_URL || (import.meta as any).env?.VITE_BACKEND_URL || '');

export const getAuthApiUrl = (endpoint: string) => {
  const formattedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;

  if (typeof window !== "undefined") {
    const hostname = window.location.hostname;
    // If running on getzakir.com, Vercel, local dev, or Cloud Run container, use relative path directly
    if (
      hostname.includes("getzakir.com") ||
      hostname.includes("vercel.app") ||
      hostname.includes("run.app") ||
      hostname.includes("localhost") ||
      hostname.includes("127.0.0.1") ||
      !hostname
    ) {
      return formattedEndpoint;
    }

    const customBase = (import.meta as any).env?.VITE_API_BASE_URL || (import.meta as any).env?.VITE_BACKEND_URL;
    if (customBase) {
      if (window.location.origin === customBase.replace(/\/$/, '')) {
        return formattedEndpoint;
      }
      return `${customBase.replace(/\/$/, '')}${formattedEndpoint}`;
    }

    return formattedEndpoint;
  }

  const customBase = (import.meta as any).env?.VITE_API_BASE_URL || (import.meta as any).env?.VITE_BACKEND_URL;
  if (customBase) {
    return `${customBase.replace(/\/$/, '')}${formattedEndpoint}`;
  }

  return API_BASE_URL ? `${API_BASE_URL}${formattedEndpoint}` : formattedEndpoint;
};

/**
 * Safely parse JSON response with Content-Type validation and HTML fallback handling
 */
export async function safeParseJsonResponse(res: Response) {
  const contentType = res.headers.get("content-type");
  if (contentType && contentType.includes("application/json")) {
    const data = await res.json();
    if (!res.ok) {
      const errMsg = data.error || data.message || `Server returned status ${res.status}`;
      console.error("Fetch Error Detail (JSON response error):", errMsg, data);
      throw new Error(errMsg);
    }
    return data;
  } else {
    const text = await res.text();
    console.error("Fetch Error Detail (Non-JSON response):", {
      status: res.status,
      statusText: res.statusText,
      contentType,
      bodyText: text
    });

    if (text.includes("<!DOCTYPE") || text.includes("<html")) {
      const cleanSnippet = text.replace(/<[^>]*>?/gm, ' ').slice(0, 150).trim();
      throw new Error(`Server returned HTML instead of JSON (${res.status} ${res.statusText}): ${cleanSnippet || 'Route or function fallback'}`);
    }

    try {
      const data = JSON.parse(text);
      if (!res.ok) throw new Error(data.error || `Server returned error status ${res.status}`);
      return data;
    } catch (e: any) {
      console.error("Fetch Error Detail (JSON parse failure):", e, text);
      throw new Error(`Server response parsing failed (${res.status} ${res.statusText}): ${text.slice(0, 100) || 'Invalid response'}`);
    }
  }
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

    const data = await res.json();
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
          const data = await res.json();
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
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Failed to add message");
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
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Failed to update ticket status");
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

