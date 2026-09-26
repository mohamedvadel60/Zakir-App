import { User, UploadedVerificationDoc, AccountStatus, VerificationStatus } from "../types.js";

export interface UnifiedDocument {
  documentId: string;
  id: string;
  fileName: string;
  name: string;
  mimeType: string;
  size: number;
  category: "personal" | "company" | "other";
  docType?: string;
  storageReference?: string;
  storagePath?: string;
  fileUrl?: string;
  downloadUrl?: string;
  previewUrl: string;
  uploadedAt: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "UNDER_REVIEW";
  verificationStatus: "PENDING" | "APPROVED" | "REJECTED" | "UNDER_REVIEW";
  isAccessible: boolean;
  isMissing: boolean;
  userId?: string;
  userEmail?: string;
  workspaceId?: string;
  rejectionReason?: string;
  reviewedAt?: string;
  reviewedBy?: string;
}

export interface UnifiedDocumentsResult {
  documents: UnifiedDocument[];
  documentCount: number; // TOTAL real non-deleted documents in the system
  uploadedDocuments: UnifiedDocument[];
  accessibleDocuments: UnifiedDocument[];
  accessibleCount: number;
  missingDocuments: UnifiedDocument[];
  missingCount: number;
  personalDocuments: UnifiedDocument[];
  companyDocuments: UnifiedDocument[];
  requiredDocuments: {
    personalRequired: boolean;
    personalSatisfied: boolean;
    companyRequired: boolean;
    companySatisfied: boolean;
    isFullySatisfied: boolean;
  };
}

export type CanonicalVerificationState = "not_started" | "pending" | "rejected" | "approved";

export interface CanonicalVerificationDetails {
  canonicalStatus: CanonicalVerificationState;
  accountStatus: AccountStatus;
  documentVerificationStatus: "NOT_SUBMITTED" | "PENDING_UPLOAD" | "PENDING_REVIEW" | "UNDER_REVIEW" | "APPROVED" | "REJECTED";
  kycStatus: "VERIFIED" | "NOT_VERIFIED" | "UNDER_REVIEW" | "PENDING_REVIEW" | "REJECTED" | "UNVERIFIED";
  uiState: "NO_REQUEST" | "AWAITING_DOCS" | "PENDING_REVIEW" | "VERIFIED" | "REJECTED";
  isEmailVerified: boolean;
  isFullyApproved: boolean;
  hasExplicitOverride: boolean;
  documentCount: number;
  documents: UnifiedDocument[];
  rejectionReason?: string;
  canApproveKyc: boolean;
  canReviewDocuments: boolean;
  canApproveAccount: boolean;
  approvedAt?: string;
  approvedBy?: string;
  userFriendlyMessage: string;
}

/**
 * Normalizes all documents across legacy and modern schemas into a single canonical list.
 * CRITICAL RULE: Physical storage check or isMissing flag MUST NEVER reduce documentCount to 0
 * if a document record was actually submitted/uploaded. Missing files are flagged, not erased.
 */
export function normalizeUserDocuments(userData: any, extraDocs?: any[]): UnifiedDocumentsResult {
  if (!userData) {
    return {
      documents: [],
      documentCount: 0,
      uploadedDocuments: [],
      accessibleDocuments: [],
      accessibleCount: 0,
      missingDocuments: [],
      missingCount: 0,
      personalDocuments: [],
      companyDocuments: [],
      requiredDocuments: {
        personalRequired: true,
        personalSatisfied: false,
        companyRequired: false,
        companySatisfied: true,
        isFullySatisfied: false,
      }
    };
  }

  const full = userData.fullUser || userData;
  const userId = full.id || full.uid || userData.id || userData.uid || "";
  const userEmail = (full.email || userData.email || "").toLowerCase().trim();

  const rawDocs: any[] = [
    ...(Array.isArray(full.verificationDocuments) ? full.verificationDocuments : []),
    ...(Array.isArray(full.verificationInfo?.documents) ? full.verificationInfo.documents : []),
    ...(Array.isArray(full.documents) ? full.documents : []),
    ...(Array.isArray(full.files) ? full.files.filter((f: any) => f && (f.category === "Verification" || f.category === "Identity" || f.isVerificationDoc)) : []),
    ...(Array.isArray(userData.files) ? userData.files.filter((f: any) => f && (f.category === "Verification" || f.category === "Identity" || f.isVerificationDoc)) : []),
    ...(Array.isArray(userData.verificationDocuments) ? userData.verificationDocuments : []),
    ...(Array.isArray(userData.verificationInfo?.documents) ? userData.verificationInfo.documents : []),
    ...(Array.isArray(userData.documents) ? userData.documents : []),
    ...(Array.isArray(extraDocs) ? extraDocs : [])
  ];

  // Legacy single document fields
  if (full.identityDocument) {
    rawDocs.push(
      typeof full.identityDocument === "string"
        ? { documentId: full.identityDocument, fileName: "National_ID_Card.pdf", category: "personal", docType: "national_id" }
        : { category: "personal", docType: "national_id", ...full.identityDocument }
    );
  }
  if (full.commercialRegisterDoc) {
    rawDocs.push(
      typeof full.commercialRegisterDoc === "string"
        ? { documentId: full.commercialRegisterDoc, fileName: "Commercial_Register.pdf", category: "company", docType: "commercial_register" }
        : { category: "company", docType: "commercial_register", ...full.commercialRegisterDoc }
    );
  }
  if (full.licenseDoc) {
    rawDocs.push(
      typeof full.licenseDoc === "string"
        ? { documentId: full.licenseDoc, fileName: "Trade_License.pdf", category: "company", docType: "commercial_register" }
        : { category: "company", docType: "commercial_register", ...full.licenseDoc }
    );
  }
  if (full.taxCardDoc) {
    rawDocs.push(
      typeof full.taxCardDoc === "string"
        ? { documentId: full.taxCardDoc, fileName: "Tax_Certificate.pdf", category: "company", docType: "tax_card" }
        : { category: "company", docType: "tax_card", ...full.taxCardDoc }
    );
  }

  const seenIds = new Set<string>();
  const normalizedDocs: UnifiedDocument[] = [];

  for (const doc of rawDocs) {
    if (!doc || doc.deleted === true || doc.isDeleted === true) continue;

    const docId = String(doc.documentId || doc.id || doc.fileId || "").trim();
    const storageRef = String(doc.storageReference || doc.storagePath || doc.fileUrl || "").trim();
    const fileName = String(doc.fileName || doc.name || "").trim();
    const sizeStr = doc.size ? String(doc.size) : (doc.fileSize ? String(doc.fileSize) : "");

    // Check multiple duplicate key signatures so documents don't duplicate across different array sources
    const key1 = docId ? `id_${docId}` : "";
    const key2 = storageRef ? `ref_${storageRef}` : "";
    const key3 = fileName ? `fn_${fileName.toLowerCase()}_${sizeStr}` : "";

    if ((key1 && seenIds.has(key1)) || (key2 && seenIds.has(key2)) || (key3 && seenIds.has(key3))) {
      continue;
    }
    if (key1) seenIds.add(key1);
    if (key2) seenIds.add(key2);
    if (key3) seenIds.add(key3);

    const documentId = docId || (storageRef ? storageRef.split("/").pop() : "") || (fileName ? fileName : `doc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`);
    const displayFileName = fileName || "Verification_Document";
    const category: "personal" | "company" | "other" =
      doc.category === "company" ? "company" : (doc.category === "personal" ? "personal" : (doc.category === "other" ? "other" : "personal"));

    const rawStatus = String(doc.status || doc.verificationStatus || full.documentVerificationStatus || "PENDING").toUpperCase();
    const status: "PENDING" | "APPROVED" | "REJECTED" | "UNDER_REVIEW" =
      rawStatus === "APPROVED" || rawStatus === "VERIFIED"
        ? "APPROVED"
        : rawStatus === "REJECTED"
        ? "REJECTED"
        : rawStatus === "UNDER_REVIEW"
        ? "UNDER_REVIEW"
        : "PENDING";

    const isExplicitlyMissing = doc.isMissing === true;
    const isAccessible = !isExplicitlyMissing;

    const previewUrl = doc.previewUrl || doc.fileUrl || doc.downloadUrl || `/api/auth/verification-document/${encodeURIComponent(documentId)}`;
    const downloadUrl = doc.downloadUrl || doc.fileUrl || `/api/auth/verification-document/${encodeURIComponent(documentId)}?download=true`;

    const uDoc: UnifiedDocument = {
      documentId,
      id: documentId,
      fileName: displayFileName,
      name: displayFileName,
      mimeType: doc.mimeType || "application/pdf",
      size: typeof doc.size === "number" ? doc.size : (typeof doc.fileSize === "number" ? doc.fileSize : 0),
      category,
      docType: doc.docType || (category === "company" ? "commercial_register" : "national_id"),
      storageReference: doc.storageReference || doc.storagePath,
      storagePath: doc.storagePath || doc.storageReference,
      fileUrl: doc.fileUrl,
      downloadUrl,
      previewUrl,
      uploadedAt: doc.uploadedAt || doc.uploadDate || doc.createdAt || new Date().toISOString(),
      status,
      verificationStatus: status,
      isAccessible,
      isMissing: isExplicitlyMissing,
      userId: doc.userId || userId,
      userEmail: doc.userEmail || userEmail,
      workspaceId: doc.workspaceId || full.workspaceId,
      rejectionReason: doc.rejectionReason,
      reviewedAt: doc.reviewedAt,
      reviewedBy: doc.reviewedBy,
    };

    normalizedDocs.push(uDoc);
  }

  const documentCount = normalizedDocs.length;
  const accessibleDocuments = normalizedDocs.filter((d) => d.isAccessible);
  const missingDocuments = normalizedDocs.filter((d) => d.isMissing);
  const personalDocuments = normalizedDocs.filter((d) => d.category === "personal");
  const companyDocuments = normalizedDocs.filter((d) => d.category === "company");

  const hasCompany = Boolean(
    full.hasCompany ||
    (full.institutionalProfile && (full.institutionalProfile.hasCompany || full.institutionalProfile.companyName))
  );

  const personalRequired = true;
  const personalSatisfied = personalDocuments.length > 0;
  const companyRequired = hasCompany;
  const companySatisfied = !hasCompany || companyDocuments.length > 0;
  const isFullySatisfied = personalSatisfied && companySatisfied;

  return {
    documents: normalizedDocs,
    documentCount,
    uploadedDocuments: normalizedDocs,
    accessibleDocuments,
    accessibleCount: accessibleDocuments.length,
    missingDocuments,
    missingCount: missingDocuments.length,
    personalDocuments,
    companyDocuments,
    requiredDocuments: {
      personalRequired,
      personalSatisfied,
      companyRequired,
      companySatisfied,
      isFullySatisfied,
    }
  };
}

/**
 * Computes canonical verification state strictly:
 * - not_started: No request or documents uploaded yet -> forced DocumentVerificationView
 * - pending: User submitted request -> forced PendingApprovalView (cannot enter app)
 * - rejected: Admin rejected request -> forced AccountRejectedView (must resubmit)
 * - approved: Admin approved request -> allowed to enter Dashboard
 */
export function computeCanonicalVerification(
  userData: any,
  isSysAdmin: boolean = false,
  extraDocs?: any[]
): CanonicalVerificationDetails {
  if (!userData) {
    return {
      canonicalStatus: "not_started",
      accountStatus: "VERIFICATION_REQUIRED",
      documentVerificationStatus: "NOT_SUBMITTED",
      kycStatus: "NOT_VERIFIED",
      uiState: "NO_REQUEST",
      isEmailVerified: false,
      isFullyApproved: false,
      hasExplicitOverride: false,
      documentCount: 0,
      documents: [],
      canApproveKyc: false,
      canReviewDocuments: false,
      canApproveAccount: false,
      userFriendlyMessage: "يرجى تسجيل الدخول وإكمال إجراءات اعتماد الحساب."
    };
  }

  const full = userData.fullUser || userData;
  const docsResult = normalizeUserDocuments(userData, extraDocs);
  const documentCount = docsResult.documentCount;
  const documents = docsResult.documents;

  const adminRequestedReverification = Boolean(
    full.adminRequestedEmailReverification === true ||
    userData.adminRequestedEmailReverification === true ||
    full.adminRequestedReverification === true ||
    userData.adminRequestedReverification === true
  );

  const rawEmailVerified = Boolean(
    full.emailVerified === true ||
    full.isEmailVerified === true ||
    full.email_verified === true ||
    full.email_verified === "true" ||
    full.emailVerified === "true" ||
    full.isEmailVerified === "true" ||
    userData.emailVerified === true ||
    userData.isEmailVerified === true ||
    userData.email_verified === true ||
    userData.email_verified === "true" ||
    userData.emailVerified === "true" ||
    userData.isEmailVerified === "true" ||
    Boolean(full.emailVerifiedAt) ||
    Boolean(userData.emailVerifiedAt) ||
    Boolean(full.verificationInfo?.emailVerifiedAt) ||
    Boolean(userData.verificationInfo?.emailVerifiedAt) ||
    Boolean(full.accountStatus && full.accountStatus !== "PENDING_EMAIL_VERIFICATION") ||
    Boolean(userData.accountStatus && userData.accountStatus !== "PENDING_EMAIL_VERIFICATION") ||
    (Array.isArray(full.verificationDocuments) && full.verificationDocuments.length > 0) ||
    (Array.isArray(userData.verificationDocuments) && userData.verificationDocuments.length > 0) ||
    documentCount > 0
  );

  const isEmailVer = rawEmailVerified && !adminRequestedReverification;

  if (isEmailVer) {
    full.emailVerified = true;
    full.isEmailVerified = true;
    full.email_verified = true;
    userData.emailVerified = true;
    userData.isEmailVerified = true;
    userData.email_verified = true;
  }

  const hasExplicitOverride = Boolean(
    full.adminVerificationOverride === true ||
    userData.adminVerificationOverride === true
  );

  // System Administrators bypass
  if (isSysAdmin) {
    return {
      canonicalStatus: "approved",
      accountStatus: "APPROVED",
      documentVerificationStatus: "APPROVED",
      kycStatus: "VERIFIED",
      uiState: "VERIFIED",
      isEmailVerified: true,
      isFullyApproved: true,
      hasExplicitOverride: true,
      documentCount,
      documents,
      canApproveKyc: false,
      canReviewDocuments: false,
      canApproveAccount: false,
      approvedAt: full.approvedAt || new Date().toISOString(),
      approvedBy: full.approvedBy || "system_admin",
      userFriendlyMessage: "حساب إداري معتمد بصلاحيات كاملة."
    };
  }

  const rawAccStatus = String(full.accountStatus || userData.accountStatus || "").toUpperCase();
  const rawDocStatus = String(full.documentVerificationStatus || userData.documentVerificationStatus || full.verificationInfo?.status || "").toUpperCase();
  const rawReqStatus = String(full.verificationRequestStatus || full.verificationRequest || userData.verificationRequestStatus || userData.verificationRequest || "").toUpperCase();
  const rejectionReason = full.rejectionReason || userData.rejectionReason || full.verificationInfo?.adminNote || undefined;

  const hasRejectedDoc = documents.some((d) => d.status === "REJECTED");
  const isExplicitlyAdminApproved = Boolean(
    (full.approvedBy && full.approvedAt) || (userData.approvedBy && userData.approvedAt) || full.approvedAt || userData.approvedAt
  );

  let canonicalStatus: CanonicalVerificationState = "not_started";
  let accountStatus: AccountStatus = "VERIFICATION_REQUIRED";
  let documentVerificationStatus: "NOT_SUBMITTED" | "PENDING_UPLOAD" | "PENDING_REVIEW" | "UNDER_REVIEW" | "APPROVED" | "REJECTED" = "NOT_SUBMITTED";
  let kycStatus: "VERIFIED" | "NOT_VERIFIED" | "UNDER_REVIEW" | "PENDING_REVIEW" | "REJECTED" | "UNVERIFIED" = "NOT_VERIFIED";
  let uiState: "NO_REQUEST" | "AWAITING_DOCS" | "PENDING_REVIEW" | "VERIFIED" | "REJECTED" = "NO_REQUEST";
  let isFullyApproved = false;
  let userFriendlyMessage = "";

  // 1. PENDING STATE (State B) - User submitted documents/request and waiting for admin review (takes precedence over stale rejection flags)
  if (
    rawAccStatus === "PENDING_ADMIN_REVIEW" ||
    rawAccStatus === "PENDING_APPROVAL" ||
    full.canonicalVerificationStatus === "pending" ||
    userData.canonicalVerificationStatus === "pending" ||
    rawDocStatus === "UNDER_REVIEW" ||
    rawDocStatus === "PENDING_REVIEW" ||
    rawReqStatus === "UNDER_REVIEW" ||
    rawReqStatus === "PENDING" ||
    rawReqStatus === "SUBMITTED" ||
    rawReqStatus === "DOCUMENTS_SUBMITTED"
  ) {
    canonicalStatus = "pending";
    accountStatus = "PENDING_ADMIN_REVIEW";
    documentVerificationStatus = "UNDER_REVIEW";
    kycStatus = "UNDER_REVIEW";
    uiState = "PENDING_REVIEW";
    userFriendlyMessage = "طلب اعتماد الحساب قيد المراجعة والتدقيق الإداري.";
  }
  // 2. REJECTED STATE (State C) - Active rejection without active pending resubmission
  else if (rawAccStatus === "REJECTED" || rawDocStatus === "REJECTED" || rawReqStatus === "REJECTED" || hasRejectedDoc) {
    canonicalStatus = "rejected";
    accountStatus = "REJECTED";
    documentVerificationStatus = "REJECTED";
    kycStatus = "REJECTED";
    uiState = "REJECTED";
    userFriendlyMessage = rejectionReason
      ? `تم رفض طلب اعتماد الحساب: ${rejectionReason}`
      : "تم رفض طلب الاعتماد. يرجى مراجعة البيانات وإعادة تقديم المستندات المطلوبة.";
  }
  // 3. APPROVED STATE (State D)
  else if (rawAccStatus === "APPROVED" || rawAccStatus === "ACTIVE") {
    canonicalStatus = "approved";
    accountStatus = "APPROVED";

    const hasPendingDoc = documents.some((d) => d.status === "PENDING" || d.status === "UNDER_REVIEW");
    const allApprovedDocs = documentCount > 0 && documents.every((d) => d.status === "APPROVED" || d.verificationStatus === "APPROVED");

    if (hasExplicitOverride || (documentCount > 0 && allApprovedDocs)) {
      documentVerificationStatus = "APPROVED";
      kycStatus = "VERIFIED";
      uiState = "VERIFIED";
      isFullyApproved = true;
      userFriendlyMessage = "تم اعتماد وتوثيق الحساب رسمياً.";
    } else if (documentCount > 0 && (hasPendingDoc || rawDocStatus === "UNDER_REVIEW" || rawReqStatus === "UNDER_REVIEW")) {
      documentVerificationStatus = "UNDER_REVIEW";
      kycStatus = "UNDER_REVIEW";
      uiState = "PENDING_REVIEW";
      isFullyApproved = false;
      userFriendlyMessage = "الحساب معتمد، ووثائق التوثيق المؤسسي قيد المراجعة.";
    } else {
      documentVerificationStatus = "NOT_SUBMITTED";
      kycStatus = "NOT_VERIFIED";
      uiState = "NO_REQUEST";
      isFullyApproved = false;
      userFriendlyMessage = "الحساب معتمد ومفعل بالكامل.";
    }
  }
  // 4. NOT STARTED STATE (State A) - User has not started or not finished uploading documents
  else {
    canonicalStatus = "not_started";
    accountStatus = isEmailVer 
      ? (rawAccStatus === "PENDING_INSTITUTIONAL_DATA" ? "PENDING_INSTITUTIONAL_DATA" : (rawAccStatus === "VERIFICATION_REQUIRED" ? "VERIFICATION_REQUIRED" : "PENDING_DOCUMENT_VERIFICATION")) 
      : "PENDING_EMAIL_VERIFICATION";
    documentVerificationStatus = rawDocStatus === "PENDING_UPLOAD" ? "PENDING_UPLOAD" : "NOT_SUBMITTED";
    kycStatus = "NOT_VERIFIED";
    uiState = "NO_REQUEST";
    userFriendlyMessage = isEmailVer
      ? "الحساب غير معتمد بعد. يرجى إتمام خطوات التوثيق ورفع المستندات الرسمية."
      : "يرجى تأكيد البريد الإلكتروني للبدء في إجراءات اعتماد الحساب.";
  }

  const canApproveKyc = isEmailVer && documentCount > 0 && kycStatus !== "VERIFIED";
  const canReviewDocuments = documentCount > 0;
  const canApproveAccount = isEmailVer && documentCount > 0 && canonicalStatus !== "approved";

  return {
    canonicalStatus,
    accountStatus,
    documentVerificationStatus,
    kycStatus,
    uiState,
    isEmailVerified: isEmailVer,
    isFullyApproved,
    hasExplicitOverride,
    documentCount,
    documents,
    rejectionReason,
    canApproveKyc,
    canReviewDocuments,
    canApproveAccount,
    approvedAt: full.approvedAt,
    approvedBy: full.approvedBy,
    userFriendlyMessage,
  };
}
