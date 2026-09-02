import crypto from "crypto";
import path from "path";
import fs from "fs";
import os from "os";
import { 
  adminDb, 
  adminAuth, 
  isFirebaseAdminAvailable, 
  isFirebaseAuthAvailable, 
  getSafeBucket 
} from "./firebase-admin.js";
import { 
  sendSystemMail, 
  buildOtpEmailHtml, 
  buildRecoveryApprovalEmailHtml, 
  buildRecoveryRejectionEmailHtml 
} from "./mailer.js";
import "./env.js";

const isServerless = Boolean(
  process.env.VERCEL ||
  process.env.VERCEL_ENV ||
  process.env.NOW_REGION ||
  process.env.AWS_LAMBDA_FUNCTION_NAME ||
  process.env.LAMBDA_TASK_ROOT
);

const CHUNK_BYTE_SIZE = 300 * 1024; // 300KB chunks for Firestore
const RECOVERY_DOC_RETENTION_MS = 14 * 24 * 60 * 60 * 1000; // 14 days maximum retention
const DB_FILE = path.join(process.cwd(), "src", "db_store.json");

function readDb(): any {
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, "utf-8");
      if (raw && raw.trim()) {
        return JSON.parse(raw);
      }
    }
  } catch (e) {}
  return {
    account_recovery_requests: [],
    pending_recovery_uploads: [],
    recovery_documents_store: {},
    verification_codes: [],
    account_lifecycle: [],
    users: []
  };
}

function writeDb(data: any): void {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch (e) {}
}

export function validateFileSignature(buffer: Buffer, mimeType: string): boolean {
  if (!buffer || buffer.length < 2) return false;

  const hex = buffer.toString("hex", 0, Math.min(buffer.length, 12)).toLowerCase();
  const mime = (mimeType || "").toLowerCase();

  // PDF signature: %PDF (25 50 44 46)
  if (mime.includes("pdf") || hex.startsWith("25504446")) {
    return hex.startsWith("25504446");
  }

  // PNG signature: 89 50 4e 47
  if (mime.includes("png") || hex.startsWith("89504e47")) {
    return hex.startsWith("89504e47");
  }

  // JPEG / JPG signature: ff d8 ff
  if (mime.includes("jpeg") || mime.includes("jpg") || hex.startsWith("ffd8ff")) {
    return hex.startsWith("ffd8ff");
  }

  // WEBP signature: RIFF ... WEBP (52 49 46 46)
  if (mime.includes("webp") || hex.startsWith("52494646")) {
    return hex.startsWith("52494646");
  }

  // Word DOCX / ZIP: 50 4b 03 04
  if (mime.includes("officedocument") || mime.includes("zip") || hex.startsWith("504b0304")) {
    return hex.startsWith("504b0304");
  }

  // Word DOC (Legacy OLE format): d0 cf 11 e0
  if (mime.includes("msword") || hex.startsWith("d0cf11e0")) {
    return hex.startsWith("d0cf11e0");
  }

  // Plain text / UTF-8
  if (mime.includes("text")) {
    return true;
  }

  // Fallback: if buffer is valid non-empty binary/document
  return buffer.length >= 4;
}

function getLocalUploadsDir(): string {
  const base = isServerless ? os.tmpdir() : process.cwd();
  return path.join(base, "secure_uploads");
}

function saveToLocalDiskCache(documentId: string, buffer: Buffer): void {
  try {
    const dir = getLocalUploadsDir();
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(path.join(dir, documentId), buffer);
  } catch (err) {}
}

function getFromLocalDiskCache(documentId: string): Buffer | null {
  try {
    const candidatePaths = [
      path.join(getLocalUploadsDir(), documentId),
      path.join(os.tmpdir(), "secure_uploads", documentId),
      path.join(process.cwd(), "secure_uploads", documentId)
    ];
    for (const p of candidatePaths) {
      if (fs.existsSync(p)) {
        return fs.readFileSync(p);
      }
    }
  } catch (err) {}
  return null;
}

export async function saveDocumentToPersistentStorage(
  documentId: string,
  buffer: Buffer,
  mimeType: string,
  meta?: { fileName?: string; size?: number; fileHash?: string }
): Promise<void> {
  saveToLocalDiskCache(documentId, buffer);

  const totalChunks = Math.ceil(buffer.length / CHUNK_BYTE_SIZE);
  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();
  const expiresAtIso = new Date(nowMs + RECOVERY_DOC_RETENTION_MS).toISOString();

  // Save to DB store immediately
  const db = readDb();
  if (!db.recovery_documents_store) {
    db.recovery_documents_store = {};
  }
  db.recovery_documents_store[documentId] = {
    documentId,
    mimeType,
    size: buffer.length,
    fileName: meta?.fileName || "document",
    fileHash: meta?.fileHash || "",
    storageStatus: "pending",
    syncAttempts: 0,
    createdAt: nowIso,
    expiresAt: expiresAtIso
  };
  writeDb(db);

  if (isFirebaseAdminAvailable && adminDb) {
    try {
      const persistPromise = (async () => {
        await adminDb.collection("recoveryDocuments").doc(documentId).set({
          documentId,
          mimeType,
          size: buffer.length,
          totalChunks,
          fileName: meta?.fileName || "document",
          fileHash: meta?.fileHash || "",
          storageStatus: "pending",
          syncAttempts: 0,
          createdAt: nowIso,
          updatedAt: nowIso,
          expiresAt: expiresAtIso
        });

        const chunkPromises: Promise<any>[] = [];
        for (let i = 0; i < totalChunks; i++) {
          const start = i * CHUNK_BYTE_SIZE;
          const end = Math.min(start + CHUNK_BYTE_SIZE, buffer.length);
          const chunkData = buffer.subarray(start, end).toString("base64");
          chunkPromises.push(
            adminDb
              .collection("recoveryDocuments")
              .doc(documentId)
              .collection("chunks")
              .doc(String(i))
              .set({
                chunkIndex: i,
                data: chunkData,
                size: end - start,
                createdAt: nowIso,
                expiresAt: expiresAtIso
              })
          );
        }
        await Promise.all(chunkPromises);
      })();

      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Firestore persistence timeout")), 5000));
      await Promise.race([persistPromise, timeoutPromise]);
    } catch (fsErr: any) {
      console.warn("[RecoveryService] Firestore chunk persistence notice (cached in db_store):", fsErr?.message || fsErr);
    }
  }
}

export async function getDocumentFromPersistentStorage(documentId: string): Promise<Buffer> {
  const cached = getFromLocalDiskCache(documentId);
  if (cached) {
    return cached;
  }

  if (isFirebaseAdminAvailable && adminDb) {
    const docSnap = await adminDb.collection("recoveryDocuments").doc(documentId).get();
    if (docSnap.exists) {
      const meta = docSnap.data();
      const totalChunks = meta?.totalChunks || 1;
      const chunksSnap = await adminDb
        .collection("recoveryDocuments")
        .doc(documentId)
        .collection("chunks")
        .get();

      if (!chunksSnap.empty) {
        const sortedDocs = chunksSnap.docs.sort((a: any, b: any) => {
          const idxA = a.data().chunkIndex ?? parseInt(a.id, 10);
          const idxB = b.data().chunkIndex ?? parseInt(b.id, 10);
          return idxA - idxB;
        });

        const buffers: Buffer[] = [];
        for (const cDoc of sortedDocs) {
          const chunkData = cDoc.data().data;
          if (chunkData) {
            buffers.push(Buffer.from(chunkData, "base64"));
          }
        }
        if (buffers.length > 0) {
          const fullBuffer = Buffer.concat(buffers);
          saveToLocalDiskCache(documentId, fullBuffer);
          return fullBuffer;
        }
      }
    }
  }

  const bucket = getSafeBucket();
  if (bucket) {
    try {
      const file = bucket.file(`secure_uploads/${documentId}`);
      const [exists] = await file.exists();
      if (exists) {
        const [downloaded] = await file.download();
        saveToLocalDiskCache(documentId, downloaded);
        return downloaded;
      }
    } catch (e) {}
  }

  throw new Error(`Document ${documentId} could not be retrieved from persistent storage.`);
}

export async function deleteDocumentFromPersistentStorage(documentId: string): Promise<void> {
  try {
    const dir = getLocalUploadsDir();
    const filePath = path.join(dir, documentId);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (e) {}

  if (isFirebaseAdminAvailable && adminDb) {
    try {
      const chunksSnap = await adminDb
        .collection("recoveryDocuments")
        .doc(documentId)
        .collection("chunks")
        .get();
      for (const cDoc of chunksSnap.docs) {
        await cDoc.ref.delete();
      }
      await adminDb.collection("recoveryDocuments").doc(documentId).delete();
    } catch (e) {}
  }

  const bucket = getSafeBucket();
  if (bucket) {
    try {
      await bucket.file(`secure_uploads/${documentId}`).delete({ ignoreNotFound: true });
    } catch (e) {}
  }

  const db = readDb();
  if (db.recovery_documents_store?.[documentId]) {
    delete db.recovery_documents_store[documentId];
  }
  if (db.pending_recovery_uploads) {
    db.pending_recovery_uploads = db.pending_recovery_uploads.filter((u: any) => u.documentId !== documentId);
  }
  writeDb(db);
}

export async function registerPendingUpload(documentId: string, uploadToken: string, docMeta: any): Promise<void> {
  const record = {
    documentId,
    uploadToken,
    ...docMeta,
    associated: false,
    uploadedAt: docMeta.uploadedAt || new Date().toISOString()
  };

  if (isFirebaseAdminAvailable && adminDb) {
    try {
      await adminDb.collection("pendingRecoveryUploads").doc(documentId).set(record);
    } catch (e) {}
  }

  const db = readDb();
  if (!db.pending_recovery_uploads) db.pending_recovery_uploads = [];
  db.pending_recovery_uploads.push(record);
  writeDb(db);
}

export async function verifyPendingUpload(documentId: string, uploadToken: string): Promise<boolean> {
  if (!documentId || !uploadToken) return false;

  if (isFirebaseAdminAvailable && adminDb) {
    try {
      const snap = await adminDb.collection("pendingRecoveryUploads").doc(documentId).get();
      if (snap.exists) {
        const data = snap.data();
        if (data?.uploadToken === uploadToken) return true;
      }
    } catch (e) {}
  }

  const db = readDb();
  const found = (db.pending_recovery_uploads || []).find(
    (u: any) => u.documentId === documentId && u.uploadToken === uploadToken
  );
  return Boolean(found);
}

export async function markUploadAssociated(documentId: string, requestId: string): Promise<void> {
  if (isFirebaseAdminAvailable && adminDb) {
    try {
      await adminDb.collection("pendingRecoveryUploads").doc(documentId).set(
        { associated: true, associatedRequestId: requestId, associatedAt: new Date().toISOString() },
        { merge: true }
      );
    } catch (e) {}
  }

  const db = readDb();
  if (db.pending_recovery_uploads) {
    const item = db.pending_recovery_uploads.find((u: any) => u.documentId === documentId);
    if (item) {
      item.associated = true;
      item.associatedRequestId = requestId;
      writeDb(db);
    }
  }
}

export function hashVerificationCode(code: string): string {
  return crypto.createHash("sha256").update(String(code).trim()).digest("hex");
}

export async function getAccountLifecycleRecord(email: string): Promise<any | null> {
  const normalizedEmail = (email || "").trim().toLowerCase();
  if (!normalizedEmail) return null;

  if (isFirebaseAdminAvailable && adminDb) {
    try {
      const snap = await adminDb.collection("accountLifecycle").doc(normalizedEmail).get();
      if (snap.exists) return snap.data();
    } catch (e) {}
  }

  const db = readDb();
  return db.account_lifecycle?.find((r: any) => (r.emailNormalized || r.email) === normalizedEmail) || null;
}

export async function setAccountLifecycleRecord(record: any): Promise<void> {
  const normalizedEmail = (record.email || record.emailNormalized || "").trim().toLowerCase();
  if (!normalizedEmail) return;

  if (isFirebaseAdminAvailable && adminDb) {
    try {
      await adminDb.collection("accountLifecycle").doc(normalizedEmail).set(record, { merge: true });
    } catch (e) {}
  }

  const db = readDb();
  if (!db.account_lifecycle) db.account_lifecycle = [];
  const idx = db.account_lifecycle.findIndex((r: any) => (r.emailNormalized || r.email) === normalizedEmail);
  if (idx >= 0) {
    db.account_lifecycle[idx] = { ...db.account_lifecycle[idx], ...record };
  } else {
    db.account_lifecycle.push(record);
  }
  writeDb(db);
}

/**
 * Check recovery status for a given email address
 */
export async function getRecoveryStatus(email: string): Promise<{
  success: boolean;
  recoverable: boolean;
  status: "none" | "pending" | "under_review" | "approved" | "rejected";
  remainingDays?: number;
  recoveryRequest: any | null;
  error?: string;
}> {
  if (!email || typeof email !== "string" || !email.trim()) {
    return {
      success: false,
      recoverable: false,
      status: "none",
      recoveryRequest: null,
      error: "Email parameter is required."
    };
  }

  const normalizedEmail = email.trim().toLowerCase();
  let requestData: any = null;

  // 1. Check accountRecoveryRequests_by_email in Firestore
  if (isFirebaseAdminAvailable && adminDb) {
    try {
      const emailSnap = await adminDb.collection("accountRecoveryRequests_by_email").doc(normalizedEmail).get();
      if (emailSnap.exists) {
        requestData = emailSnap.data();
      }
    } catch (e) {}
  }

  // 2. Check local fallback database
  if (!requestData) {
    const db = readDb();
    requestData = db.account_recovery_requests?.find((r: any) => r.email === normalizedEmail) || null;
  }

  if (requestData) {
    const responseStatus = requestData.status || "pending";
    return {
      success: true,
      recoverable: true,
      status: responseStatus,
      remainingDays: 30,
      recoveryRequest: {
        id: requestData.id || requestData.requestId,
        requestId: requestData.requestId || requestData.id,
        status: responseStatus,
        fullName: requestData.fullName,
        submittedAt: requestData.submittedAt,
        rejectionReason: responseStatus === "rejected" ? (requestData.rejectionReason || requestData.notes || "Request was declined by an administrator.") : null
      }
    };
  }

  // Check lifecycle record to see if account is deleted and recoverable
  const lifecycle = await getAccountLifecycleRecord(normalizedEmail);
  const isDeleted = lifecycle && (lifecycle.status === "DELETED" || lifecycle.status === "ADMIN_APPROVAL_PENDING" || lifecycle.status === "ADMIN_APPROVED" || lifecycle.status === "ADMIN_REJECTED");

  return {
    success: true,
    recoverable: Boolean(isDeleted),
    status: "none",
    remainingDays: 30,
    recoveryRequest: null
  };
}

/**
 * Submit Account Recovery Request
 */
export async function submitRecoveryRequest(payload: {
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
    uploadToken?: string;
    storageReference?: string;
    fileName?: string;
    mimeType?: string;
    size?: number;
    uploadedAt?: string;
  }>;
}): Promise<{
  success: boolean;
  requestId?: string;
  message?: string;
  error?: string;
  request?: any;
}> {
  const {
    email,
    fullName,
    phone,
    phoneVerified,
    organization,
    previousWorkspaceInfo,
    reason,
    termsAccepted,
    documents
  } = payload;

  if (!email || !email.trim()) {
    return { success: false, error: "Email is required." };
  }
  if (!fullName || !fullName.trim()) {
    return { success: false, error: "Full name is required." };
  }
  if (!phone || !phone.trim()) {
    return { success: false, error: "Phone number is required." };
  }
  if (!reason || !reason.trim()) {
    return { success: false, error: "Reason for recovery is required." };
  }
  if (!termsAccepted) {
    return { success: false, error: "Terms of Service acceptance is required." };
  }
  if (!documents || !Array.isArray(documents) || documents.length === 0) {
    return { success: false, error: "At least one identity verification document is required." };
  }
  if (documents.length > 2) {
    return { success: false, error: "Maximum 2 identity verification documents allowed." };
  }

  for (const doc of documents) {
    if (!doc.documentId) {
      return { success: false, error: "Missing document reference ID." };
    }
    if (!/^[a-zA-Z0-9_]+$/.test(doc.documentId)) {
      return { success: false, error: "Invalid document ID format." };
    }
    if (doc.uploadToken) {
      const validToken = await verifyPendingUpload(doc.documentId, doc.uploadToken);
      if (!validToken) {
        return { success: false, error: "Document verification integrity check failed." };
      }
    }
  }

  const normalizedEmail = email.trim().toLowerCase();
  const nowIso = new Date().toISOString();
  const requestId = `REQ-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  const requestDoc = {
    id: requestId,
    requestId,
    email: normalizedEmail,
    fullName: fullName.trim(),
    phone: phone.trim(),
    phoneVerified: Boolean(phoneVerified),
    organization: (organization || "").trim(),
    previousWorkspaceInfo: (previousWorkspaceInfo || "").trim(),
    reason: reason.trim(),
    termsAccepted: true,
    termsAcceptedAt: nowIso,
    documents: documents.map(d => ({
      documentId: d.documentId,
      storageReference: d.storageReference || `secure_uploads/${d.documentId}`,
      fileName: d.fileName || "document",
      mimeType: d.mimeType || "application/octet-stream",
      size: d.size || 0,
      uploadedAt: d.uploadedAt || nowIso
    })),
    status: "pending",
    submittedAt: nowIso,
    updatedAt: nowIso
  };

  for (const doc of documents) {
    await markUploadAssociated(doc.documentId, requestId);
  }

  if (isFirebaseAdminAvailable && adminDb) {
    try {
      await adminDb.collection("accountRecoveryRequests").doc(requestId).set(requestDoc);
      await adminDb.collection("accountRecoveryRequests_by_email").doc(normalizedEmail).set(requestDoc);
    } catch (fsErr) {
      console.warn("[RecoveryService] Firestore request write warning:", fsErr);
    }
  }

  const db = readDb();
  if (!db.account_recovery_requests) db.account_recovery_requests = [];
  db.account_recovery_requests = db.account_recovery_requests.filter((r: any) => r.email !== normalizedEmail);
  db.account_recovery_requests.push(requestDoc);
  writeDb(db);

  const lifecycle = await getAccountLifecycleRecord(normalizedEmail);
  if (lifecycle) {
    await setAccountLifecycleRecord({
      ...lifecycle,
      status: "ADMIN_APPROVAL_PENDING",
      reactivationStatus: "pending",
      recoveryRequestId: requestId,
      updatedAt: nowIso
    });
  }

  return {
    success: true,
    requestId,
    request: requestDoc,
    message: "Your account recovery request has been submitted for administrative review."
  };
}

/**
 * Send Recovery Approval OTP
 */
export async function sendApprovalOtp(email: string): Promise<{
  success: boolean;
  message?: string;
  expiresAt?: string;
  emailSent?: boolean;
  devCode?: string;
  error?: string;
}> {
  if (!email || !email.trim()) {
    return { success: false, error: "Email is required." };
  }
  const normalizedEmail = email.trim().toLowerCase();

  let reqStatus = "";
  if (isFirebaseAdminAvailable && adminDb) {
    try {
      const emailSnap = await adminDb.collection("accountRecoveryRequests_by_email").doc(normalizedEmail).get();
      if (emailSnap.exists) {
        reqStatus = emailSnap.data()?.status || "";
      }
    } catch (e) {}
  }

  if (!reqStatus) {
    const db = readDb();
    const localReq = db.account_recovery_requests?.find((r: any) => r.email === normalizedEmail);
    reqStatus = localReq?.status || "";
  }

  if (reqStatus !== "approved") {
    const lifecycle = await getAccountLifecycleRecord(normalizedEmail);
    if (lifecycle?.status !== "ADMIN_APPROVED" && lifecycle?.reactivationStatus !== "approved") {
      return {
        success: false,
        error: "Your recovery request has not yet been approved by an administrator."
      };
    }
  }

  const otpCode = crypto.randomInt(100000, 1000000).toString();
  const codeHash = hashVerificationCode(otpCode);
  const nowMs = Date.now();
  const expiresAt = new Date(nowMs + 10 * 60 * 1000).toISOString();
  const docId = `recovery_otp_${normalizedEmail.replace(/[^a-zA-Z0-9]/g, '_')}`;

  const record = {
    id: docId,
    email: normalizedEmail,
    codeHash: codeHash,
    type: "account_recovery",
    expiresAt: expiresAt,
    attempts: 0,
    used: false,
    createdAt: new Date().toISOString()
  };

  if (isFirebaseAdminAvailable && adminDb) {
    try {
      await adminDb.collection("verification_codes").doc(docId).set(record);
      await adminDb.collection("verification_codes").doc(normalizedEmail).set(record);
    } catch (e) {}
  }

  const db = readDb();
  if (!db.verification_codes) db.verification_codes = [];
  db.verification_codes = db.verification_codes.filter((vc: any) => vc.id !== docId && vc.id !== normalizedEmail);
  db.verification_codes.push(record);
  writeDb(db);

  const emailObj = buildOtpEmailHtml({
    email: normalizedEmail,
    otpCode: otpCode,
    type: "account_recovery"
  });

  const mailResult = await sendSystemMail(normalizedEmail, emailObj.subject, emailObj.text, emailObj.html);

  return {
    success: true,
    message: `Verification code sent to ${normalizedEmail}`,
    expiresAt,
    emailSent: !mailResult.simulated,
    devCode: mailResult.simulated ? otpCode : undefined
  };
}

/**
 * Verify Approval OTP and Restore User Account
 */
export async function verifyOtpAndRestore(email: string, code: string, newPassword?: string): Promise<{
  success: boolean;
  user?: any;
  customToken?: string;
  error?: string;
}> {
  if (!email || !code) {
    return { success: false, error: "Email and verification code are required." };
  }
  const normalizedEmail = email.trim().toLowerCase();
  const inputCode = String(code).trim();
  const docId = `recovery_otp_${normalizedEmail.replace(/[^a-zA-Z0-9]/g, '_')}`;

  let otpRecord: any = null;
  if (isFirebaseAdminAvailable && adminDb) {
    try {
      const snap = await adminDb.collection("verification_codes").doc(docId).get();
      if (snap.exists && !snap.data()?.used) {
        otpRecord = snap.data();
      }
      if (!otpRecord) {
        const emSnap = await adminDb.collection("verification_codes").doc(normalizedEmail).get();
        if (emSnap.exists && !emSnap.data()?.used) {
          otpRecord = emSnap.data();
        }
      }
    } catch (e) {}
  }

  if (!otpRecord) {
    const db = readDb();
    otpRecord = db.verification_codes?.find((vc: any) => (vc.id === docId || vc.email === normalizedEmail) && !vc.used);
  }

  if (!otpRecord) {
    return { success: false, error: "Verification code not found or already used." };
  }

  if (new Date(otpRecord.expiresAt).getTime() < Date.now()) {
    return { success: false, error: "Verification code has expired. Please request a new code." };
  }

  const inputHash = hashVerificationCode(inputCode);
  if (otpRecord.codeHash !== inputHash && otpRecord.code !== inputCode) {
    return { success: false, error: "Invalid verification code." };
  }

  // Mark code as used
  otpRecord.used = true;
  if (isFirebaseAdminAvailable && adminDb) {
    try {
      await adminDb.collection("verification_codes").doc(docId).set({ used: true, usedAt: new Date().toISOString() }, { merge: true });
      await adminDb.collection("verification_codes").doc(normalizedEmail).set({ used: true, usedAt: new Date().toISOString() }, { merge: true });
    } catch (e) {}
  }

  // Mark account restored in Firestore users collection & remove deletedUser markers
  let targetUid = `usr_${normalizedEmail.replace(/[^a-zA-Z0-9]/g, '_')}`;
  let restoredUserData: any = null;

  if (isFirebaseAdminAvailable && adminDb) {
    try {
      const usersSnap = await adminDb.collection("users").where("email", "==", normalizedEmail).limit(1).get();
      if (!usersSnap.empty) {
        targetUid = usersSnap.docs[0].id;
        restoredUserData = usersSnap.docs[0].data();
      }
    } catch (e) {}
  }

  if (!restoredUserData) {
    const db = readDb();
    restoredUserData = db.users?.find((u: any) => u.email === normalizedEmail);
    if (restoredUserData?.id) targetUid = restoredUserData.id;
  }

  const nowIso = new Date().toISOString();
  const updatedUser = {
    ...(restoredUserData || {}),
    id: targetUid,
    email: normalizedEmail,
    companyName: restoredUserData?.companyName || "Restored Workspace",
    ownerName: restoredUserData?.ownerName || cleanNameFromEmail(normalizedEmail),
    role: restoredUserData?.role || "CEO",
    isVerified: true,
    isEmailVerified: true,
    isPhoneVerified: true,
    verification_status: "verified",
    verification_required: false,
    subscriptionStatus: "Active",
    restoredAt: nowIso,
    lastActiveAt: nowIso,
    lastLoginAt: nowIso
  };

  // Remove deleted markers
  if (isFirebaseAdminAvailable && adminDb) {
    try {
      await adminDb.collection("users").doc(targetUid).set(updatedUser, { merge: true });
      await adminDb.collection("deletedUsers").doc(targetUid).delete();
      const delEmailSnap = await adminDb.collection("deletedUsers").where("email", "==", normalizedEmail).get();
      for (const d of delEmailSnap.docs) {
        await d.ref.delete();
      }
    } catch (e) {}
  }

  const db = readDb();
  if (!db.users) db.users = [];
  const uIdx = db.users.findIndex((u: any) => u.email === normalizedEmail || u.id === targetUid);
  if (uIdx >= 0) db.users[uIdx] = updatedUser;
  else db.users.push(updatedUser);

  if (db.deleted_users) {
    db.deleted_users = db.deleted_users.filter((d: any) => d.email !== normalizedEmail && d.id !== targetUid);
  }
  writeDb(db);

  let customToken: string | undefined;
  if (isFirebaseAuthAvailable && adminAuth) {
    try {
      customToken = await adminAuth.createCustomToken(targetUid, { role: updatedUser.role });
    } catch (e) {}
  }

  return {
    success: true,
    user: updatedUser,
    customToken
  };
}

export async function getAdminRecoveryRequests(): Promise<{
  success: boolean;
  requests: any[];
}> {
  let requests: any[] = [];
  if (isFirebaseAdminAvailable && adminDb) {
    try {
      const snap = await adminDb.collection("accountRecoveryRequests").orderBy("submittedAt", "desc").get();
      requests = snap.docs.map((d: any) => ({ ...d.data(), id: d.id }));
    } catch (e) {
      try {
        const snap = await adminDb.collection("accountRecoveryRequests").get();
        requests = snap.docs.map((d: any) => ({ ...d.data(), id: d.id }));
      } catch (e2) {}
    }
  }

  if (requests.length === 0) {
    const db = readDb();
    requests = db.account_recovery_requests || [];
  }

  return { success: true, requests };
}

export async function handleAdminRecoveryDecision(params: {
  requestId: string;
  email: string;
  action: "approve" | "reject";
  rejectionReason?: string;
  notes?: string;
  callerUid?: string;
}): Promise<{
  success: boolean;
  message?: string;
  error?: string;
}> {
  const { requestId, email, action, rejectionReason, notes, callerUid } = params;
  if (!requestId || !email || !action) {
    return { success: false, error: "Missing required decision parameters." };
  }

  const normalizedEmail = email.trim().toLowerCase();
  const nowIso = new Date().toISOString();
  const newStatus = action === "approve" ? "approved" : "rejected";

  const updateData: any = {
    status: newStatus,
    updatedAt: nowIso,
    reviewedAt: nowIso,
    reviewedBy: callerUid || "admin",
    notes: notes || undefined
  };

  if (action === "reject" && rejectionReason) {
    updateData.rejectionReason = rejectionReason;
  }

  if (isFirebaseAdminAvailable && adminDb) {
    try {
      await adminDb.collection("accountRecoveryRequests").doc(requestId).set(updateData, { merge: true });
      await adminDb.collection("accountRecoveryRequests_by_email").doc(normalizedEmail).set(updateData, { merge: true });
    } catch (e) {}
  }

  const db = readDb();
  if (db.account_recovery_requests) {
    const idx = db.account_recovery_requests.findIndex((r: any) => r.id === requestId || r.requestId === requestId || r.email === normalizedEmail);
    if (idx >= 0) {
      db.account_recovery_requests[idx] = {
        ...db.account_recovery_requests[idx],
        ...updateData
      };
      writeDb(db);
    }
  }

  const lifecycle = await getAccountLifecycleRecord(normalizedEmail);
  if (lifecycle) {
    await setAccountLifecycleRecord({
      ...lifecycle,
      status: action === "approve" ? "ADMIN_APPROVED" : "ADMIN_REJECTED",
      reactivationStatus: action === "approve" ? "approved" : "rejected",
      updatedAt: nowIso
    });
  }

  // Send notification email
  try {
    if (action === "approve") {
      const emailObj = buildRecoveryApprovalEmailHtml({
        userName: cleanNameFromEmail(normalizedEmail),
        email: normalizedEmail
      });
      await sendSystemMail(normalizedEmail, emailObj.subject, emailObj.text, emailObj.html);
    } else {
      const emailObj = buildRecoveryRejectionEmailHtml({
        userName: cleanNameFromEmail(normalizedEmail),
        email: normalizedEmail,
        rejectionReason: rejectionReason
      });
      await sendSystemMail(normalizedEmail, emailObj.subject, emailObj.text, emailObj.html);
      
      // If rejected, clean up uploaded documents to respect privacy
      if (db.account_recovery_requests) {
        const req = db.account_recovery_requests.find((r: any) => r.id === requestId || r.requestId === requestId);
        if (req?.documents) {
          for (const d of req.documents) {
            if (d.documentId) {
              await deleteDocumentFromPersistentStorage(d.documentId);
            }
          }
        }
      }
    }
  } catch (mailErr) {
    console.warn("Failed to dispatch decision notification email:", mailErr);
  }

  return {
    success: true,
    message: `Account recovery request has been ${newStatus}.`
  };
}

function cleanNameFromEmail(email: string): string {
  const local = email.split("@")[0] || "User";
  return local.charAt(0).toUpperCase() + local.slice(1);
}
