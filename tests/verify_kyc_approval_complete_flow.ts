import { computeCanonicalVerification } from "../src/lib/unifiedVerification.js";
import { computeStrictVerificationState, verifyUserAccess } from "../src/middleware/auth.js";
import { normalizeStrictUserVerification } from "../src/lib/firebaseServices.js";

const BASE_URL = "http://localhost:3000";
const ADMIN_UID = "SYhfciebGFUj29gqGaa0pqNunrk2";
const ADMIN_EMAIL = "admin@zakir.ai";

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`[ASSERTION FAILED]: ${msg}`);
  }
}

async function runAllMandatoryTests() {
  console.log("==========================================================================");
  console.log("    COMPREHENSIVE KYC & ACCOUNT APPROVAL LIFECYCLE VERIFICATION SUITE     ");
  console.log("==========================================================================");

  const testResults: Record<string, "PASS" | "FAIL"> = {};

  // --------------------------------------------------------------------------
  // TEST 1: New Pending User Flow
  // --------------------------------------------------------------------------
  console.log("\n[TEST 1] New User submits KYC with documents -> Admin sees user & documents");
  const testEmail1 = `kyc_user_${Date.now()}@getzakir.com`;
  const regRes = await fetch(`${BASE_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: testEmail1,
      password: "Password123!@#",
      ownerName: "KYC Test Applicant",
      companyName: "Zakir Institutional Ltd",
      role: "CEO"
    })
  });
  const regData = await regRes.json();
  assert(regRes.ok && regData.success, `Registration failed: ${JSON.stringify(regData)}`);
  const user1Uid = regData.user.id || regData.user.uid;

  // Verify email with OTP
  const otpCode = regData.devCode || "123456";
  const verifyRes = await fetch(`${BASE_URL}/api/auth/verify-code`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: testEmail1,
      userId: user1Uid,
      code: otpCode,
      type: "account_registration"
    })
  });
  assert(verifyRes.ok, "Email verification failed");

  // Upload document
  const pdfBuffer = Buffer.from("%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n%%EOF");
  const docUpRes = await fetch(`${BASE_URL}/api/auth/verification-document/upload`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-auth-token": user1Uid },
    body: JSON.stringify({
      category: "personal",
      docType: "national_id",
      fileName: "Government_ID.pdf",
      fileBase64: pdfBuffer.toString("base64"),
      mimeType: "application/pdf"
    })
  });
  const docUpData = await docUpRes.json();
  assert(docUpRes.ok && docUpData.success, `Document upload failed: ${JSON.stringify(docUpData)}`);
  const uploadedDoc = docUpData.document;

  // Submit KYC verification
  const submitRes = await fetch(`${BASE_URL}/api/auth/submit-verification-documents`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-auth-token": user1Uid },
    body: JSON.stringify({
      fullName: "KYC Test Applicant",
      phone: "+971501234567",
      hasCompany: true,
      companyName: "Zakir Institutional Ltd",
      personalDocuments: [uploadedDoc]
    })
  });
  const submitData = await submitRes.json();
  assert(submitRes.ok && submitData.success, `KYC submit failed: ${JSON.stringify(submitData)}`);
  assert(submitData.accountStatus === "PENDING_ADMIN_REVIEW", "Account must be PENDING_ADMIN_REVIEW");

  // Admin checks pending list
  const pendingRes = await fetch(`${BASE_URL}/api/admin/pending-approvals`, {
    headers: { "x-auth-token": ADMIN_UID }
  });
  const pendingData = await pendingRes.json();
  assert(pendingRes.ok && pendingData.success, `Pending approvals query failed: ${JSON.stringify(pendingData)}`);
  
  const foundInPending = pendingData.pendingApprovals.find((p: any) => p.userId === user1Uid || p.email === testEmail1);
  assert(Boolean(foundInPending), "User must appear in Admin pending approvals list");
  assert(foundInPending.documents && foundInPending.documents.length > 0, "Admin must see user's attached documents");
  assert(foundInPending.accountStatus === "PENDING_ADMIN_REVIEW" || foundInPending.requestStatus === "UNDER_REVIEW", "Status must be PENDING/UNDER_REVIEW");
  
  testResults["TEST 1"] = "PASS";
  console.log("✓ TEST 1: PASS - User is PENDING_ADMIN_REVIEW and documents are visible to Admin.");

  // --------------------------------------------------------------------------
  // TEST 2: Admin Approves Account & Documents
  // --------------------------------------------------------------------------
  console.log("\n[TEST 2] Admin clicks Approve -> Database & state updated to APPROVED");
  const approveRes = await fetch(`${BASE_URL}/api/admin/approve-account`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-auth-token": ADMIN_UID },
    body: JSON.stringify({
      userId: user1Uid,
      assignPlan: "Enterprise",
      customTrialHours: 48,
      notes: "Approved KYC & full verification"
    })
  });
  const approveData = await approveRes.json();
  assert(approveRes.ok && approveData.success, `Approve account failed: ${JSON.stringify(approveData)}`);
  assert(approveData.user.accountStatus === "APPROVED", "User accountStatus must be APPROVED");
  assert(approveData.user.canonicalVerificationStatus === "approved", "canonicalVerificationStatus must be approved");
  assert(approveData.user.kycStatus === "VERIFIED", "kycStatus must be VERIFIED");
  assert(approveData.user.documentVerificationStatus === "APPROVED", "documentVerificationStatus must be APPROVED");

  // Verify documents are marked APPROVED
  const userDocs = approveData.user.verificationDocuments || [];
  assert(userDocs.length > 0, "Approved documents must be present");
  assert(userDocs.every((d: any) => d.status === "APPROVED" || d.verificationStatus === "APPROVED"), "All documents must be APPROVED");

  testResults["TEST 2"] = "PASS";
  console.log("✓ TEST 2: PASS - Account and documents successfully APPROVED in backend and database.");

  // --------------------------------------------------------------------------
  // TEST 3: No False CANNOT_APPROVE_UNVERIFIED_EMAIL Error for Verified Users
  // --------------------------------------------------------------------------
  console.log("\n[TEST 3] No false email verification error on approval");
  assert(approveData.error !== "CANNOT_APPROVE_UNVERIFIED_EMAIL", "Must not trigger false email error");
  
  // Also test unverified user is still blocked (security rule retained)
  const unverifiedEmail = `unverified_${Date.now()}@getzakir.com`;
  const unverifiedReg = await fetch(`${BASE_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: unverifiedEmail,
      password: "Password123!@#",
      ownerName: "Unverified User",
      companyName: "Unverified Corp",
      role: "CEO"
    })
  });
  const unverifiedData = await unverifiedReg.json();
  const unverifiedUid = unverifiedData.user.id;

  const tryApproveUnverified = await fetch(`${BASE_URL}/api/admin/approve-account`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-auth-token": ADMIN_UID },
    body: JSON.stringify({
      userId: unverifiedUid,
      assignPlan: "Starter"
    })
  });
  const unverifiedApproveRes = await tryApproveUnverified.json();
  assert(tryApproveUnverified.status === 400 && unverifiedApproveRes.error === "CANNOT_APPROVE_UNVERIFIED_EMAIL", "Unverified email must remain protected and rejected with 400 CANNOT_APPROVE_UNVERIFIED_EMAIL");

  testResults["TEST 3"] = "PASS";
  console.log("✓ TEST 3: PASS - Verified email approves cleanly; genuinely unverified email remains strictly protected.");

  // --------------------------------------------------------------------------
  // TEST 4: User Sees Approval & Verification Gate Disappears
  // --------------------------------------------------------------------------
  console.log("\n[TEST 4] User fetches profile -> Gate disappears and user has access");
  const userProfileRes = await fetch(`${BASE_URL}/api/auth/current-user-status`, {
    headers: { "x-auth-token": user1Uid }
  });
  const userProfileData = await userProfileRes.json();
  assert(userProfileRes.ok && userProfileData.success, "Failed to fetch user profile");
  
  const liveUser = userProfileData.user;
  const canonicalLive = computeCanonicalVerification(liveUser, false);
  const normalizedLive = normalizeStrictUserVerification(liveUser);

  assert(canonicalLive.canonicalStatus === "approved", "Canonical status must be approved");
  assert(canonicalLive.isFullyApproved === true, "isFullyApproved must be true");
  assert(canonicalLive.uiState === "VERIFIED", "uiState must be VERIFIED (gate disappears)");
  assert(normalizedLive.accountStatus === "APPROVED", "Account status must be APPROVED");

  testResults["TEST 4"] = "PASS";
  console.log("✓ TEST 4: PASS - User profile reflects APPROVED state; verification gate disappears.");

  // --------------------------------------------------------------------------
  // TEST 5: Logout and Login preserves APPROVED state
  // --------------------------------------------------------------------------
  console.log("\n[TEST 5] Logout -> Login preserves APPROVED state");
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: testEmail1,
      password: "Password123!@#"
    })
  });
  const loginData = await loginRes.json();
  assert(loginRes.ok && loginData.success, `Login failed: ${JSON.stringify(loginData)}`);
  assert(loginData.user.accountStatus === "APPROVED", "Account status after login must remain APPROVED");
  assert(loginData.user.canonicalVerificationStatus === "approved", "canonicalVerificationStatus must remain approved");
  assert(loginData.user.isVerified === true, "isVerified after login must be true");

  testResults["TEST 5"] = "PASS";
  console.log("✓ TEST 5: PASS - Login preserves APPROVED and verified status.");

  // --------------------------------------------------------------------------
  // TEST 6: Direct API Authorization (Pending = 403, Approved = 200)
  // --------------------------------------------------------------------------
  console.log("\n[TEST 6] Direct Protected API Authorization");
  // Test Approved User on protected API
  const approvedApiRes = await fetch(`${BASE_URL}/api/memories`, {
    headers: { "x-auth-token": user1Uid }
  });
  assert(approvedApiRes.status === 200, `Approved user must receive 200 OK on protected API, got: ${approvedApiRes.status}`);

  // Test Pending User on protected API
  const pendingEmail = `pending_only_${Date.now()}@getzakir.com`;
  const pendingReg = await fetch(`${BASE_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: pendingEmail,
      password: "Password123!@#",
      ownerName: "Pending Only",
      companyName: "Pending Co",
      role: "CEO"
    })
  });
  const pRegData = await pendingReg.json();
  const pUid = pRegData.user.id;
  await fetch(`${BASE_URL}/api/auth/verify-code`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: pendingEmail, userId: pUid, code: pRegData.devCode || "123456", type: "account_registration" })
  });
  // Submit docs so in PENDING review
  await fetch(`${BASE_URL}/api/auth/submit-verification-documents`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-auth-token": pUid },
    body: JSON.stringify({ fullName: "Pending Only", phone: "+971501112233", personalDocuments: [{ documentId: "doc_p_1", fileName: "id.pdf", category: "personal" }] })
  });

  const pendingApiRes = await fetch(`${BASE_URL}/api/memories`, {
    headers: { "x-auth-token": pUid }
  });
  assert(pendingApiRes.status === 403, `Pending user must receive 403 Forbidden on protected API, got: ${pendingApiRes.status}`);

  testResults["TEST 6"] = "PASS";
  console.log("✓ TEST 6: PASS - Protected APIs return 200 for Approved and 403 for Pending users.");

  // --------------------------------------------------------------------------
  // TEST 7: Rejected Safety (Rejected user must NOT become Approved)
  // --------------------------------------------------------------------------
  console.log("\n[TEST 7] Rejected User Safety");
  const rejectRes = await fetch(`${BASE_URL}/api/admin/reject-documents`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-auth-token": ADMIN_UID },
    body: JSON.stringify({
      userId: pUid,
      reason: "Document illegible"
    })
  });
  assert(rejectRes.ok, "Reject documents failed");

  const pUserStatusRes = await fetch(`${BASE_URL}/api/auth/current-user-status`, {
    headers: { "x-auth-token": pUid }
  });
  const pUserData = await pUserStatusRes.json();
  const pUser = pUserData.user;
  const canonicalRejected = computeCanonicalVerification(pUser, false);
  assert(canonicalRejected.canonicalStatus === "rejected", "Status must remain REJECTED");
  assert(canonicalRejected.isFullyApproved === false, "isFullyApproved must be false");
  assert(canonicalRejected.uiState === "REJECTED", "uiState must be REJECTED");

  // Rejected user calling protected API must get 403
  const rejectedApiRes = await fetch(`${BASE_URL}/api/memories`, {
    headers: { "x-auth-token": pUid }
  });
  assert(rejectedApiRes.status === 403, `Rejected user must receive 403, got ${rejectedApiRes.status}`);

  testResults["TEST 7"] = "PASS";
  console.log("✓ TEST 7: PASS - Rejected user strictly blocked and cannot bypass verification.");

  // --------------------------------------------------------------------------
  // TEST 8: Refresh Persistence for Admin and User
  // --------------------------------------------------------------------------
  console.log("\n[TEST 8] Refresh Persistence in Admin Dashboard and User App");
  // Admin query after refresh
  const adminUsersRes = await fetch(`${BASE_URL}/api/admin/users`, {
    headers: { "x-auth-token": ADMIN_UID }
  });
  const adminUsersData = await adminUsersRes.json();
  const user1InAdmin = adminUsersData.users.find((u: any) => u.id === user1Uid);
  assert(Boolean(user1InAdmin), "Approved user must appear in Admin users list");
  assert(user1InAdmin.accountStatus === "APPROVED", "User in Admin list must be APPROVED");
  assert(user1InAdmin.isVerified === true, "User in Admin list must have isVerified=true");
  assert(user1InAdmin.kycStatus === "VERIFIED", "User in Admin list must have kycStatus=VERIFIED");

  // User query after multiple refreshes
  for (let i = 0; i < 3; i++) {
    const refreshRes = await fetch(`${BASE_URL}/api/auth/current-user-status`, {
      headers: { "x-auth-token": user1Uid }
    });
    const refData = await refreshRes.json();
    const refUser = refData.user;
    const refCanonical = computeCanonicalVerification(refUser, false);
    assert(refCanonical.canonicalStatus === "approved", "Must remain APPROVED on refresh");
    assert(refCanonical.isFullyApproved === true, "isFullyApproved must remain true on refresh");
  }

  testResults["TEST 8"] = "PASS";
  console.log("✓ TEST 8: PASS - Approved status is fully persistent across refreshes and queries.");

  console.log("\n==========================================================================");
  console.log("                       FINAL VERIFICATION SUMMARY                         ");
  console.log("==========================================================================");
  Object.entries(testResults).forEach(([test, status]) => {
    console.log(`${test}: ${status}`);
  });
  console.log("==========================================================================");
}

runAllMandatoryTests().catch((err) => {
  console.error("Test Suite Failed:", err);
  process.exit(1);
});
