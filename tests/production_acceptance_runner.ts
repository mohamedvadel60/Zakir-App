import { computeCanonicalVerification } from "../src/lib/unifiedVerification.js";
import { normalizeStrictUserVerification } from "../src/lib/firebaseServices.js";

const BASE_URL = "http://localhost:3000";
const ADMIN_UID = "SYhfciebGFUj29gqGaa0pqNunrk2";

async function runProductionVerification() {
  console.log("=== STARTING REAL PRODUCTION VERIFICATION ===");
  const results: Record<string, string> = {};

  // 1. Create a real user, verify email, upload KYC docs, submit verification
  const timestamp = Date.now();
  const testEmail = `prod_kyc_${timestamp}@getzakir.com`;
  
  const regRes = await fetch(`${BASE_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: testEmail,
      password: "Password123!@#",
      ownerName: "Prod Verification User",
      companyName: "Global Trade Tech",
      role: "CEO"
    })
  });
  const regData = await regRes.json();
  const userId = regData.user.id;
  const otpCode = regData.devCode || "123456";

  // Verify email
  await fetch(`${BASE_URL}/api/auth/verify-code`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: testEmail,
      userId: userId,
      code: otpCode,
      type: "account_registration"
    })
  });

  // Upload document
  const pdfBuffer = Buffer.from("%PDF-1.4 Official Certificate Doc");
  const docUploadRes = await fetch(`${BASE_URL}/api/auth/verification-document/upload`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-auth-token": userId },
    body: JSON.stringify({
      category: "company",
      docType: "commercial_registry",
      fileName: "Commercial_Registry.pdf",
      fileBase64: pdfBuffer.toString("base64"),
      mimeType: "application/pdf"
    })
  });
  const docData = await docUploadRes.json();
  const uploadedDoc = docData.document;

  // Submit KYC verification
  const submitRes = await fetch(`${BASE_URL}/api/auth/submit-verification-documents`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-auth-token": userId },
    body: JSON.stringify({
      fullName: "Prod Verification User",
      phone: "+971509998877",
      hasCompany: true,
      companyName: "Global Trade Tech",
      personalDocuments: [uploadedDoc]
    })
  });
  const submitData = await submitRes.json();

  // CHECK 1: REAL DATABASE STATE (BEFORE APPROVAL)
  const initialUserRes = await fetch(`${BASE_URL}/api/auth/current-user-status`, {
    headers: { "x-auth-token": userId }
  });
  const initialUserData = await initialUserRes.json();
  const uBefore = initialUserData.user;
  
  console.log("USER UID:", uBefore.id || uBefore.uid);
  console.log("EMAIL VERIFIED:", Boolean(uBefore.emailVerified || uBefore.isEmailVerified));
  console.log("KYC STATUS:", uBefore.kycStatus);
  console.log("DOCUMENT STATUS:", uBefore.documentVerificationStatus);
  console.log("CANONICAL VERIFICATION STATUS:", uBefore.canonicalVerificationStatus);
  console.log("ACCOUNT STATUS:", uBefore.accountStatus);
  console.log("VERIFICATION REQUEST STATUS:", uBefore.verificationRequestStatus);
  console.log("DOCUMENT COUNT:", uBefore.documentCount || uBefore.verificationDocuments?.length || 0);

  const state1Valid = (
    (uBefore.emailVerified || uBefore.isEmailVerified) &&
    uBefore.accountStatus === "PENDING_ADMIN_REVIEW" &&
    (uBefore.verificationDocuments?.length || 0) > 0
  );
  results["REAL_DATABASE_STATE"] = state1Valid ? "PASS" : "FAIL";

  // CHECK 2: ADMIN DOCUMENT VISIBILITY
  const pendingListRes = await fetch(`${BASE_URL}/api/admin/pending-approvals`, {
    headers: { "x-auth-token": ADMIN_UID }
  });
  const pendingListData = await pendingListRes.json();
  const foundInPending = pendingListData.pendingApprovals?.find((p: any) => p.userId === userId || p.email === testEmail);
  
  const adminDocVisPass = Boolean(
    foundInPending &&
    foundInPending.documents &&
    foundInPending.documents.length > 0 &&
    (foundInPending.accountStatus === "PENDING_ADMIN_REVIEW" || foundInPending.requestStatus === "UNDER_REVIEW")
  );
  results["ADMIN_DOCUMENT_VISIBILITY"] = adminDocVisPass ? "PASS" : "FAIL";

  // CHECK 3 & 4: ADMIN APPROVAL API & EMAIL CONDITION
  const approveRes = await fetch(`${BASE_URL}/api/admin/approve-account`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-auth-token": ADMIN_UID },
    body: JSON.stringify({
      userId: userId,
      assignPlan: "Enterprise",
      customTrialHours: 72,
      notes: "Production verification approval"
    })
  });
  const approveData = await approveRes.json();
  
  const approvalApiPass = approveRes.ok && approveData.success && approveData.user?.accountStatus === "APPROVED";
  results["ADMIN_APPROVAL_API"] = approvalApiPass ? "PASS" : "FAIL";

  const emailErrorTriggered = approveData.error === "CANNOT_APPROVE_UNVERIFIED_EMAIL";
  results["EMAIL_VERIFIED_APPROVAL"] = (!emailErrorTriggered && approveRes.ok) ? "PASS" : "FAIL";
  results["CANNOT_APPROVE_UNVERIFIED_EMAIL"] = emailErrorTriggered ? "TRIGGERED" : "NOT TRIGGERED";

  // CHECK 5: DATABASE AFTER APPROVAL
  const postApproveRes = await fetch(`${BASE_URL}/api/auth/current-user-status`, {
    headers: { "x-auth-token": userId }
  });
  const postApproveData = await postApproveRes.json();
  const uAfter = postApproveData.user;

  const dbAfterPass = (
    uAfter.accountStatus === "APPROVED" &&
    uAfter.canonicalVerificationStatus === "approved" &&
    uAfter.kycStatus === "VERIFIED" &&
    uAfter.documentVerificationStatus === "APPROVED" &&
    uAfter.isVerified === true &&
    uAfter.verificationDocuments?.every((d: any) => d.status === "APPROVED" || d.verificationStatus === "APPROVED")
  );
  results["DATABASE_AFTER_APPROVAL"] = dbAfterPass ? "PASS" : "FAIL";

  // CHECK 6: ADMIN UI AFTER APPROVAL
  const adminUsersRes = await fetch(`${BASE_URL}/api/admin/users`, {
    headers: { "x-auth-token": ADMIN_UID }
  });
  const adminUsersData = await adminUsersRes.json();
  const userInAdminList = adminUsersData.users?.find((u: any) => u.id === userId);

  const pendingListAfterRes = await fetch(`${BASE_URL}/api/admin/pending-approvals`, {
    headers: { "x-auth-token": ADMIN_UID }
  });
  const pendingListAfterData = await pendingListAfterRes.json();
  const stillInPending = pendingListAfterData.pendingApprovals?.some((p: any) => p.userId === userId);

  const adminUiPass = (
    userInAdminList &&
    userInAdminList.accountStatus === "APPROVED" &&
    userInAdminList.isVerified === true &&
    userInAdminList.kycStatus === "VERIFIED" &&
    !stillInPending
  );
  results["ADMIN_UI_AFTER_APPROVAL"] = adminUiPass ? "PASS" : "FAIL";

  // CHECK 7: USER UI AFTER APPROVAL
  const canonicalAfter = computeCanonicalVerification(uAfter, false);
  const normalizedAfter = normalizeStrictUserVerification(uAfter);
  const userUiPass = (
    canonicalAfter.canonicalStatus === "approved" &&
    canonicalAfter.isFullyApproved === true &&
    canonicalAfter.uiState === "VERIFIED" &&
    normalizedAfter.verification_required === false &&
    normalizedAfter.verification_status === "verified"
  );
  results["USER_UI_AFTER_APPROVAL"] = userUiPass ? "PASS" : "FAIL";

  // CHECK 8: HARD REFRESH PERSISTENCE
  let hardRefreshConsistent = true;
  for (let i = 0; i < 3; i++) {
    const freshRes = await fetch(`${BASE_URL}/api/auth/current-user-status`, {
      headers: { "x-auth-token": userId }
    });
    const freshData = await freshRes.json();
    const freshCanonical = computeCanonicalVerification(freshData.user, false);
    if (freshCanonical.canonicalStatus !== "approved" || !freshCanonical.isFullyApproved) {
      hardRefreshConsistent = false;
      break;
    }
  }
  results["HARD_REFRESH"] = hardRefreshConsistent ? "PASS" : "FAIL";

  // CHECK 9: LOGOUT / LOGIN
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: testEmail,
      password: "Password123!@#"
    })
  });
  const loginData = await loginRes.json();
  const loginPass = (
    loginRes.ok &&
    loginData.success &&
    loginData.user.accountStatus === "APPROVED" &&
    loginData.user.canonicalVerificationStatus === "approved" &&
    loginData.user.isVerified === true
  );
  results["LOGOUT_LOGIN"] = loginPass ? "PASS" : "FAIL";

  // CHECK 10: DIRECT API AUTHORIZATION (Approved, Pending, Rejected)
  const approvedApiCall = await fetch(`${BASE_URL}/api/memories`, {
    headers: { "x-auth-token": userId }
  });
  results["APPROVED_API_AUTHORIZATION"] = approvedApiCall.status === 200 ? "PASS" : "FAIL";

  // Create Pending User
  const pendingUserEmail = `pending_check_${timestamp}@getzakir.com`;
  const pReg = await fetch(`${BASE_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: pendingUserEmail,
      password: "Password123!@#",
      ownerName: "Pending User",
      companyName: "Pending Corp",
      role: "CEO"
    })
  });
  const pRegData = await pReg.json();
  const pUid = pRegData.user.id;
  await fetch(`${BASE_URL}/api/auth/verify-code`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: pendingUserEmail, userId: pUid, code: pRegData.devCode || "123456", type: "account_registration" })
  });
  await fetch(`${BASE_URL}/api/auth/submit-verification-documents`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-auth-token": pUid },
    body: JSON.stringify({ fullName: "Pending User", phone: "+971501112233", personalDocuments: [{ documentId: "doc_p", fileName: "id.pdf", category: "personal" }] })
  });

  const pendingApiCall = await fetch(`${BASE_URL}/api/memories`, {
    headers: { "x-auth-token": pUid }
  });
  results["PENDING_API_AUTHORIZATION"] = pendingApiCall.status === 403 ? "PASS" : "FAIL";

  // Reject the pending user
  await fetch(`${BASE_URL}/api/admin/reject-documents`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-auth-token": ADMIN_UID },
    body: JSON.stringify({
      userId: pUid,
      reason: "Document unreadable and blurry"
    })
  });

  const rejectedApiCall = await fetch(`${BASE_URL}/api/memories`, {
    headers: { "x-auth-token": pUid }
  });
  results["REJECTED_API_AUTHORIZATION"] = rejectedApiCall.status === 403 ? "PASS" : "FAIL";

  // CHECK 13: DOCUMENT PERSISTENCE
  const docPersistRes = await fetch(`${BASE_URL}/api/admin/users/${userId}/documents`, {
    headers: { "x-auth-token": ADMIN_UID }
  });
  const docPersistData = await docPersistRes.json();
  const docsPersisted = (
    docPersistRes.ok &&
    docPersistData.documents &&
    docPersistData.documents.length > 0 &&
    docPersistData.documents.every((d: any) => d.status === "APPROVED" || d.verificationStatus === "APPROVED")
  );
  results["DOCUMENT_PERSISTENCE"] = docsPersisted ? "PASS" : "FAIL";

  // CHECK 14: DUPLICATE APPROVAL IDEMPOTENCE
  const dupApproveRes = await fetch(`${BASE_URL}/api/admin/approve-account`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-auth-token": ADMIN_UID },
    body: JSON.stringify({
      userId: userId,
      assignPlan: "Enterprise",
      notes: "Duplicate approval attempt"
    })
  });
  const dupApproveData = await dupApproveRes.json();
  const dupUserRes = await fetch(`${BASE_URL}/api/auth/current-user-status`, {
    headers: { "x-auth-token": userId }
  });
  const dupUserData = await dupUserRes.json();
  const dupPass = (
    dupApproveRes.ok &&
    dupApproveData.success &&
    dupUserData.user.accountStatus === "APPROVED" &&
    dupUserData.user.canonicalVerificationStatus === "approved"
  );
  results["DUPLICATE_APPROVAL"] = dupPass ? "PASS" : "FAIL";

  // CHECK 15: CANONICAL STATE RESOLUTION
  const canonicalCheck = computeCanonicalVerification(dupUserData.user, false);
  const canonicalPass = (
    canonicalCheck.canonicalStatus === "approved" &&
    canonicalCheck.uiState === "VERIFIED" &&
    canonicalCheck.isFullyApproved === true
  );
  results["CANONICAL_STATE_RESOLUTION"] = canonicalPass ? "PASS" : "FAIL";

  console.log("\n--- VERIFICATION OUTPUT ---");
  console.log(JSON.stringify(results, null, 2));
}

runProductionVerification().catch((err) => {
  console.error("FATAL ERROR IN TEST EXECUTION:", err);
  process.exit(1);
});
