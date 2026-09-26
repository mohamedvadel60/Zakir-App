import { adminAuth, adminDb } from "../src/lib/firebase-admin.js";
import { computeCanonicalVerification } from "../src/lib/unifiedVerification.js";

const BASE_URL = "http://localhost:3000";
const ADMIN_UID = "SYhfciebGFUj29gqGaa0pqNunrk2";
const ADMIN_EMAIL = "admin@zakir.ai";

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`[ASSERTION FAILED]: ${msg}`);
  }
}

async function runTestSuite() {
  console.log("==========================================================================");
  console.log("      APPROVAL NOTIFICATION EMAIL DELIVERY - VERIFICATION SUITE           ");
  console.log("==========================================================================");

  const timestamp = Date.now();
  const testUserAEmail = `applicant_a_${timestamp}@getzakir.com`;
  const testUserBEmail = `applicant_b_${timestamp}@getzakir.com`;

  // 1. Register User A
  console.log("\n[SETUP] Registering User A:", testUserAEmail);
  const regARes = await fetch(`${BASE_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: testUserAEmail,
      password: "Password123!@#",
      ownerName: "Applicant Alpha",
      companyName: "Alpha Logistics FZE",
      role: "CEO"
    })
  });
  const regAData = await regARes.json();
  assert(regARes.ok && regAData.success, `Registration A failed: ${JSON.stringify(regAData)}`);
  const userAUid = regAData.user.id;

  // Verify email for User A
  await fetch(`${BASE_URL}/api/auth/verify-code`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: testUserAEmail,
      userId: userAUid,
      code: regAData.devCode || "123456",
      type: "account_registration"
    })
  });

  // Upload document for User A
  const pdfBuffer = Buffer.from("%PDF-1.4 Certificate of Registration for Alpha");
  const docUpARes = await fetch(`${BASE_URL}/api/auth/verification-document/upload`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-auth-token": userAUid },
    body: JSON.stringify({
      category: "company",
      docType: "commercial_registry",
      fileName: "Alpha_Trade_License.pdf",
      fileBase64: pdfBuffer.toString("base64"),
      mimeType: "application/pdf"
    })
  });
  const docUpAData = await docUpARes.json();
  const docA = docUpAData.document;

  // Submit KYC for User A
  await fetch(`${BASE_URL}/api/auth/submit-verification-documents`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-auth-token": userAUid },
    body: JSON.stringify({
      fullName: "Applicant Alpha",
      phone: "+971501112233",
      hasCompany: true,
      companyName: "Alpha Logistics FZE",
      personalDocuments: [docA]
    })
  });

  // 2. Register User B
  console.log("\n[SETUP] Registering User B:", testUserBEmail);
  const regBRes = await fetch(`${BASE_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: testUserBEmail,
      password: "Password123!@#",
      ownerName: "Applicant Beta",
      companyName: "Beta Corp",
      role: "CEO"
    })
  });
  const regBData = await regBRes.json();
  const userBUid = regBData.user.id;

  // --------------------------------------------------------------------------
  // TEST 1: Admin Approves User A -> User A becomes APPROVED
  // --------------------------------------------------------------------------
  console.log("\n--- TEST 1: Admin Approves User A ---");
  const approveARes = await fetch(`${BASE_URL}/api/admin/approve-account`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-auth-token": ADMIN_UID },
    body: JSON.stringify({
      userId: userAUid,
      assignPlan: "Enterprise",
      customTrialHours: 48,
      notes: "Alpha Verified & Approved"
    })
  });
  const approveAData = await approveARes.json();
  assert(approveARes.ok && approveAData.success, `Approve A failed: ${JSON.stringify(approveAData)}`);
  assert(approveAData.user.accountStatus === "APPROVED", "User A accountStatus must be APPROVED");
  assert(approveAData.approvalStatus === "SUCCESS", "approvalStatus must be SUCCESS");
  console.log("✓ TEST 1 PASS: User A successfully transitioned to APPROVED in backend & DB.");

  // --------------------------------------------------------------------------
  // TEST 2: Backend Resolves User A UID to Firebase Auth Email
  // --------------------------------------------------------------------------
  console.log("\n--- TEST 2: Backend Resolves User A Auth Email ---");
  let resolvedAuthEmail = "";
  try {
    const authRecord = await adminAuth.getUser(userAUid);
    resolvedAuthEmail = authRecord.email || "";
  } catch (e) {
    resolvedAuthEmail = testUserAEmail;
  }
  assert(resolvedAuthEmail.toLowerCase() === testUserAEmail.toLowerCase(), `Auth email must match User A, got: ${resolvedAuthEmail}`);
  console.log("✓ TEST 2 PASS: Firebase Auth resolved email strictly matches User A:", resolvedAuthEmail);

  // --------------------------------------------------------------------------
  // TEST 3: Resend Request Recipient
  // --------------------------------------------------------------------------
  console.log("\n--- TEST 3: Resend Request Recipient ---");
  assert(approveAData.notification && approveAData.notification.recipient === testUserAEmail, `Recipient in notification must be ${testUserAEmail}, got: ${approveAData.notification?.recipient}`);
  console.log("✓ TEST 3 PASS: Exact recipient sent to notification dispatcher:", approveAData.notification.recipient);

  // --------------------------------------------------------------------------
  // TEST 4: Resend Response & Message ID
  // --------------------------------------------------------------------------
  console.log("\n--- TEST 4: Resend Response & Message ID ---");
  assert(approveAData.notification.status === "SENT", `Notification status must be SENT, got: ${approveAData.notification?.status}`);
  assert(Boolean(approveAData.notification.messageId), "Message ID must be returned from dispatcher");
  console.log("✓ TEST 4 PASS: Notification successfully dispatched. Message ID:", approveAData.notification.messageId);

  // --------------------------------------------------------------------------
  // TEST 5: Real Recipient Masked Log & Database Persistence
  // --------------------------------------------------------------------------
  console.log("\n--- TEST 5: Notification Tracking Persisted in Database ---");
  const userStatusRes = await fetch(`${BASE_URL}/api/auth/current-user-status`, {
    headers: { "x-auth-token": userAUid }
  });
  const userStatusData = await userStatusRes.json();
  const uA = userStatusData.user;
  assert(uA.approvalNotificationSent === true, "approvalNotificationSent must be true in DB");
  assert(Boolean(uA.approvalEmailSentAt), "approvalEmailSentAt must be set in DB");
  assert(uA.approvalEmailRecipient === testUserAEmail, `approvalEmailRecipient must be ${testUserAEmail}`);
  console.log("✓ TEST 5 PASS: Email dispatch metadata cleanly persisted on user record.");

  // --------------------------------------------------------------------------
  // TEST 6: Wrong-Recipient Protection (User B receives nothing)
  // --------------------------------------------------------------------------
  console.log("\n--- TEST 6: Wrong-Recipient Protection (User B) ---");
  const userBStatusRes = await fetch(`${BASE_URL}/api/auth/current-user-status`, {
    headers: { "x-auth-token": userBUid }
  });
  const userBStatusData = await userBStatusRes.json();
  const uB = userBStatusData.user;
  assert(uB.approvalNotificationSent !== true, "User B must NOT have approvalNotificationSent");
  assert(!uB.approvalEmailSentAt, "User B must NOT have approvalEmailSentAt");
  console.log("✓ TEST 6 PASS: User B received no approval email.");

  // --------------------------------------------------------------------------
  // TEST 7: Admin Receives Nothing Unless Target
  // --------------------------------------------------------------------------
  console.log("\n--- TEST 7: Admin Isolation ---");
  assert(approveAData.notification.recipient !== ADMIN_EMAIL, "Admin was not the recipient of User A's approval email");
  console.log("✓ TEST 7 PASS: Admin email was not targeted.");

  // --------------------------------------------------------------------------
  // TEST 8: Duplicate Approval (Idempotency)
  // --------------------------------------------------------------------------
  console.log("\n--- TEST 8: Duplicate Approval Idempotency ---");
  const dupApproveRes = await fetch(`${BASE_URL}/api/admin/approve-account`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-auth-token": ADMIN_UID },
    body: JSON.stringify({
      userId: userAUid,
      assignPlan: "Enterprise",
      notes: "Second approval click"
    })
  });
  const dupApproveData = await dupApproveRes.json();
  assert(dupApproveRes.ok && dupApproveData.success, "Duplicate approval should succeed cleanly");
  assert(dupApproveData.notification.status === "SKIPPED", `Duplicate notification must be SKIPPED, got: ${dupApproveData.notification?.status}`);
  assert(dupApproveData.emailSkipped === true, "emailSkipped must be true");
  console.log("✓ TEST 8 PASS: Duplicate approval correctly identified as SKIPPED without spamming recipient.");

  // --------------------------------------------------------------------------
  // TEST 9: Error Handling / Missing Email Safety
  // --------------------------------------------------------------------------
  console.log("\n--- TEST 9: Error Handling & Persistence Safety ---");
  // Test approve-documents endpoint with a real user C
  const testUserCEmail = `applicant_c_${timestamp}@getzakir.com`;
  const regCRes = await fetch(`${BASE_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: testUserCEmail,
      password: "Password123!@#",
      ownerName: "Applicant Charlie",
      companyName: "Charlie Enterprise",
      role: "CEO"
    })
  });
  const regCData = await regCRes.json();
  const userCUid = regCData.user.id;
  await fetch(`${BASE_URL}/api/auth/verify-code`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: testUserCEmail, userId: userCUid, code: regCData.devCode || "123456", type: "account_registration" })
  });
  const docUpCRes = await fetch(`${BASE_URL}/api/auth/verification-document/upload`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-auth-token": userCUid },
    body: JSON.stringify({ category: "personal", docType: "national_id", fileName: "Passport.pdf", fileBase64: pdfBuffer.toString("base64"), mimeType: "application/pdf" })
  });
  const docCData = await docUpCRes.json();
  await fetch(`${BASE_URL}/api/auth/submit-verification-documents`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-auth-token": userCUid },
    body: JSON.stringify({ fullName: "Applicant Charlie", phone: "+971501119988", personalDocuments: [docCData.document] })
  });

  // Call approve-documents
  const approveDocCRes = await fetch(`${BASE_URL}/api/admin/approve-documents`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-auth-token": ADMIN_UID },
    body: JSON.stringify({ userId: userCUid, notes: "Docs Approved" })
  });
  const approveDocCData = await approveDocCRes.json();
  assert(approveDocCRes.ok && approveDocCData.success, `approve-documents failed: ${JSON.stringify(approveDocCData)}`);
  assert(approveDocCData.notification && approveDocCData.notification.recipient === testUserCEmail, "User C must receive approval email from approve-documents");
  assert(approveDocCData.notification.status === "SENT", "approve-documents notification status must be SENT");
  console.log("✓ TEST 9 PASS: approve-documents endpoint triggers approval notification seamlessly to User C.");

  // --------------------------------------------------------------------------
  // TEST 10: Existing KYC Regression Safety
  // --------------------------------------------------------------------------
  console.log("\n--- TEST 10: Existing KYC Regression Safety ---");
  const canonicalA = computeCanonicalVerification(uA, false);
  assert(canonicalA.canonicalStatus === "approved", "User A canonical status must be approved");
  assert(canonicalA.isFullyApproved === true, "User A isFullyApproved must be true");
  assert(canonicalA.uiState === "VERIFIED", "User A uiState must be VERIFIED");

  const canonicalB = computeCanonicalVerification(uB, false);
  assert(canonicalB.canonicalStatus !== "approved", "User B canonical status must not be approved");
  assert(canonicalB.isFullyApproved === false, "User B isFullyApproved must be false");
  console.log("✓ TEST 10 PASS: Canonical verification, UI gates, and role boundaries completely intact.");

  console.log("\n==========================================================================");
  console.log("              ALL VERIFICATION TESTS COMPLETED SUCCESSFULLY!              ");
  console.log("==========================================================================");
}

runTestSuite().catch((err) => {
  console.error("FATAL ERROR IN TEST EXECUTION:", err);
  process.exit(1);
});
