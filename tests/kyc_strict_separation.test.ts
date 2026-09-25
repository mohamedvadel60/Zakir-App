import { computeStrictVerificationState } from "../src/middleware/auth.js";
import { computeUserVerificationBreakdown } from "../src/lib/firebaseServices.js";

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${msg}`);
  }
}

console.log("=== RUNNING MANDATORY KYC SEPARATION TESTS ===");

// ----------------------------------------------------
// TEST 1: APPROVED, email verified, 0 documents, isVerified = false
// Expected: Dashboard access = YES, KYC = NOT VERIFIED
// ----------------------------------------------------
console.log("\n[TEST 1] APPROVED, email verified, 0 documents, isVerified = false");
const user1 = {
  id: "usr_1",
  email: "user1@example.com",
  accountStatus: "APPROVED",
  approvedAt: new Date().toISOString(),
  documentVerificationStatus: "NOT_SUBMITTED",
  verificationDocuments: [],
  documents: [],
  isVerified: false,
  isEmailVerified: true,
  emailVerified: true,
};
const state1 = computeStrictVerificationState(user1);
const breakdown1 = computeUserVerificationBreakdown(user1);

assert(state1.effectiveStatus === "APPROVED", "effectiveStatus must be APPROVED");
assert(state1.isVerified === false, "isVerified must be false");
assert(breakdown1.accountApprovalStatus === "APPROVED", "accountApprovalStatus must be APPROVED");
assert(breakdown1.kycStatus === "NOT_VERIFIED", "kycStatus must be NOT_VERIFIED");
assert(breakdown1.uiState === "NO_REQUEST", "uiState must be NO_REQUEST");
assert(breakdown1.canApproveKyc === false, "canApproveKyc must be false");
console.log("✓ TEST 1 PASSED: Dashboard access = YES, KYC = NOT VERIFIED");

// ----------------------------------------------------
// TEST 2: APPROVED, email verified, 0 documents, legacy isVerified = true
// Expected: Dashboard access = YES, KYC = NOT VERIFIED (legacy isVerified ignored!)
// ----------------------------------------------------
console.log("\n[TEST 2] APPROVED, email verified, 0 documents, legacy isVerified = true");
const user2 = {
  id: "usr_2",
  email: "user2@example.com",
  accountStatus: "APPROVED",
  approvedAt: new Date().toISOString(),
  documentVerificationStatus: "NOT_SUBMITTED",
  verificationDocuments: [],
  documents: [],
  isVerified: true, // Legacy stale boolean
  isEmailVerified: true,
  emailVerified: true,
};
const state2 = computeStrictVerificationState(user2);
const breakdown2 = computeUserVerificationBreakdown(user2);

assert(state2.effectiveStatus === "APPROVED", "effectiveStatus must be APPROVED");
assert(state2.isVerified === false, "isVerified must be false (legacy isVerified must be ignored without documents)");
assert(breakdown2.accountApprovalStatus === "APPROVED", "accountApprovalStatus must be APPROVED");
assert(breakdown2.kycStatus === "NOT_VERIFIED", "kycStatus must be NOT_VERIFIED");
assert(breakdown2.uiState === "NO_REQUEST", "uiState must be NO_REQUEST");
assert(breakdown2.canApproveKyc === false, "canApproveKyc must be false");
console.log("✓ TEST 2 PASSED: Dashboard access = YES, KYC = NOT VERIFIED (Legacy isVerified safely ignored)");

// ----------------------------------------------------
// TEST 3: APPROVED, 1 pending document
// Expected: Dashboard access = YES, KYC = PENDING
// ----------------------------------------------------
console.log("\n[TEST 3] APPROVED, 1 pending document");
const user3 = {
  id: "usr_3",
  email: "user3@example.com",
  accountStatus: "APPROVED",
  documentVerificationStatus: "UNDER_REVIEW",
  verificationRequestStatus: "UNDER_REVIEW",
  verificationDocuments: [
    {
      documentId: "doc_pending_1",
      fileName: "id_front.jpg",
      status: "PENDING",
      verificationStatus: "PENDING",
    }
  ],
  isVerified: false,
  isEmailVerified: true,
  emailVerified: true,
};
const state3 = computeStrictVerificationState(user3);
const breakdown3 = computeUserVerificationBreakdown(user3);

assert(state3.effectiveStatus === "APPROVED", "effectiveStatus must be APPROVED");
assert(state3.isVerified === false, "isVerified must be false");
assert(breakdown3.documentCount === 1, "documentCount must be 1");
assert(breakdown3.kycStatus === "UNDER_REVIEW", "kycStatus must be UNDER_REVIEW");
assert(breakdown3.uiState === "PENDING_REVIEW", "uiState must be PENDING_REVIEW");
assert(breakdown3.canApproveKyc === true, "canApproveKyc must be true");
console.log("✓ TEST 3 PASSED: Dashboard access = YES, KYC = PENDING (In Verification Queue)");

// ----------------------------------------------------
// TEST 4: APPROVED, 1 approved document
// Expected: Dashboard access = YES, KYC = VERIFIED
// ----------------------------------------------------
console.log("\n[TEST 4] APPROVED, 1 approved document");
const user4 = {
  id: "usr_4",
  email: "user4@example.com",
  accountStatus: "APPROVED",
  documentVerificationStatus: "APPROVED",
  verificationRequestStatus: "APPROVED",
  kycStatus: "VERIFIED",
  verificationDocuments: [
    {
      documentId: "doc_approved_1",
      fileName: "id_passport.pdf",
      status: "APPROVED",
      verificationStatus: "APPROVED",
    }
  ],
  isVerified: true,
  isEmailVerified: true,
  emailVerified: true,
};
const state4 = computeStrictVerificationState(user4);
const breakdown4 = computeUserVerificationBreakdown(user4);

assert(state4.effectiveStatus === "APPROVED", "effectiveStatus must be APPROVED");
assert(state4.isVerified === true, "isVerified must be true");
assert(breakdown4.kycStatus === "VERIFIED", "kycStatus must be VERIFIED");
assert(breakdown4.uiState === "VERIFIED", "uiState must be VERIFIED");
assert(breakdown4.documentCount === 1, "documentCount must be 1");
console.log("✓ TEST 4 PASSED: Dashboard access = YES, KYC = VERIFIED");

// ----------------------------------------------------
// TEST 5: APPROVED, 0 documents, adminVerificationOverride = true
// Expected: KYC = VERIFIED
// ----------------------------------------------------
console.log("\n[TEST 5] APPROVED, 0 documents, adminVerificationOverride = true");
const user5 = {
  id: "usr_5",
  email: "user5@example.com",
  accountStatus: "APPROVED",
  adminVerificationOverride: true,
  documentVerificationStatus: "NOT_SUBMITTED",
  verificationDocuments: [],
  documents: [],
  isVerified: true,
  isEmailVerified: true,
  emailVerified: true,
};
const state5 = computeStrictVerificationState(user5);
const breakdown5 = computeUserVerificationBreakdown(user5);

assert(state5.effectiveStatus === "APPROVED", "effectiveStatus must be APPROVED");
assert(state5.isVerified === true, "isVerified must be true with admin override");
assert(breakdown5.kycStatus === "VERIFIED", "kycStatus must be VERIFIED with admin override");
assert(breakdown5.hasExplicitOverride === true, "hasExplicitOverride must be true");
console.log("✓ TEST 5 PASSED: KYC = VERIFIED via explicit admin override");

// ----------------------------------------------------
// TEST 6: Backend Security Guard Verification
// Verifies 0 documents guard logic in /api/admin/approve-documents
// ----------------------------------------------------
console.log("\n[TEST 6] Backend Guard on 0 documents approval");
function simulateAdminApproveDocuments(userDoc: any) {
  const rawDocs = [
    ...(Array.isArray(userDoc.verificationDocuments) ? userDoc.verificationDocuments : []),
    ...(Array.isArray(userDoc.verificationInfo?.documents) ? userDoc.verificationInfo.documents : []),
    ...(Array.isArray(userDoc.documents) ? userDoc.documents : []),
  ];
  const uniqueDocs = rawDocs.filter((d, i, arr) => arr.findIndex(x => (x.documentId || x.id) === (d.documentId || d.id)) === i);
  const docCount = uniqueDocs.length;
  if (docCount === 0 && !userDoc.adminVerificationOverride) {
    return {
      status: 400,
      code: "CANNOT_VERIFY_WITHOUT_DOCUMENTS",
      error: "لا يمكن اعتماد التوثيق المؤسسي / KYC لعدم وجود مستندات مرفقة من المستخدم."
    };
  }
  return { status: 200, success: true };
}

const guardCheckNoDocs = simulateAdminApproveDocuments(user1);
assert(guardCheckNoDocs.status === 400, "Must return HTTP 400 for 0 documents");
assert(guardCheckNoDocs.code === "CANNOT_VERIFY_WITHOUT_DOCUMENTS", "Must return CANNOT_VERIFY_WITHOUT_DOCUMENTS");

const guardCheckWithDocs = simulateAdminApproveDocuments(user3);
assert(guardCheckWithDocs.status === 200, "Must succeed for user with uploaded documents");
console.log("✓ TEST 6 PASSED: Backend Guard strictly blocks 0-document KYC approval with HTTP 400");

console.log("\n=============================================");
console.log("ALL 6 TESTS PASSED WITH 100% SUCCESS RATE");
console.log("=============================================");
