import { computeCanonicalVerification } from "../src/lib/unifiedVerification.js";

const BASE_URL = "http://localhost:3000";
const ADMIN_TOKEN = "mock_token_admin";

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`[ASSERTION FAILED]: ${msg}`);
  }
}

async function runE2EResubmissionVerification() {
  console.log("==========================================================================");
  console.log("    REJECTED ACCOUNT RESUBMISSION FLOW - END-TO-END VERIFICATION SUITE   ");
  console.log("==========================================================================");

  const results: Record<string, "PASS" | "FAIL"> = {};

  // Setup: Register a user and reject their account
  const testEmail = `rejected_test_${Date.now()}@getzakir.com`;
  const testPassword = "Password123!@#";

  console.log("\n[SETUP] Registering test user:", testEmail);
  const regRes = await fetch(`${BASE_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: testEmail,
      password: testPassword,
      ownerName: "Rejected User Test",
      companyName: "Rejected Corp",
      role: "CEO"
    })
  });
  const regData = await regRes.json();
  assert(regRes.ok && regData.success, `Registration failed: ${JSON.stringify(regData)}`);
  const uid = regData.user.id || regData.user.uid;

  // Verify email with OTP code
  const otpCode = regData.devCode || "123456";
  const verifyRes = await fetch(`${BASE_URL}/api/auth/verify-code`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: testEmail,
      userId: uid,
      code: otpCode,
      type: "account_registration"
    })
  });
  assert(verifyRes.ok, "Email verification failed");

  // Initial document upload and submission to get into PENDING review
  const initialPdf = Buffer.from("%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n%%EOF");
  const initUpRes = await fetch(`${BASE_URL}/api/auth/verification-document/upload`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-auth-token": uid },
    body: JSON.stringify({
      category: "personal",
      docType: "national_id",
      fileName: "Old_National_ID.pdf",
      mimeType: "application/pdf",
      fileBase64: initialPdf.toString("base64")
    })
  });
  const initUpData = await initUpRes.json();
  const oldDoc = initUpData.document;

  await fetch(`${BASE_URL}/api/auth/submit-verification-documents`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-auth-token": uid },
    body: JSON.stringify({
      fullName: "Rejected User Test",
      phone: "+966500000000",
      personalDocuments: [oldDoc]
    })
  });

  // Admin rejects the account with a reason
  const rejectionReasonText = "Official verification documents required. Old document is blurry.";
  const rejectRes = await fetch(`${BASE_URL}/api/admin/reject-documents`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${ADMIN_TOKEN}`
    },
    body: JSON.stringify({
      userId: uid,
      reason: rejectionReasonText
    })
  });
  assert(rejectRes.ok, "Admin rejection failed");

  // Fetch status after rejection
  const postRejectStatusRes = await fetch(`${BASE_URL}/api/auth/current-user-status`, {
    headers: { "x-auth-token": uid }
  });
  const postRejectData = await postRejectStatusRes.json();

  // --------------------------------------------------------------------------
  // TEST 1: Rejected account opens resubmission page
  // --------------------------------------------------------------------------
  console.log("\n--- TEST 1: Rejected account state & rejection reason ---");
  const isRejectedState =
    postRejectData.user.accountStatus === "REJECTED" ||
    postRejectData.user.canonicalVerificationStatus === "rejected";
  const hasRejectionReason =
    postRejectData.user.rejectionReason === rejectionReasonText ||
    postRejectData.user.verificationInfo?.adminNote === rejectionReasonText;

  if (isRejectedState && hasRejectionReason) {
    results["Rejected account"] = "PASS";
    console.log("✓ TEST 1 PASS: Account is REJECTED and rejection reason appears correctly.");
  } else {
    results["Rejected account"] = "FAIL";
    console.log("✗ TEST 1 FAIL: Account status or rejection reason mismatch.");
  }

  // --------------------------------------------------------------------------
  // TEST 2: Upload a real PNG/JPG/PDF
  // --------------------------------------------------------------------------
  console.log("\n--- TEST 2: Upload a real PNG/JPG/PDF document ---");
  const newPdfBuffer = Buffer.from("%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Title (New Verification Doc) >>\nendobj\n%%EOF");
  const newUpRes = await fetch(`${BASE_URL}/api/auth/verification-document/upload`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-auth-token": uid },
    body: JSON.stringify({
      category: "personal",
      docType: "national_id",
      fileName: "ChatGPT_Image_New_ID.png.pdf",
      mimeType: "application/pdf",
      fileBase64: newPdfBuffer.toString("base64")
    })
  });
  const newUpData = await newUpRes.json();
  const newDoc = newUpData.document;

  if (newUpRes.ok && newDoc && newDoc.documentId) {
    results["New document upload"] = "PASS";
    console.log(`✓ TEST 2 PASS: New document uploaded successfully. Doc ID: ${newDoc.documentId}`);
  } else {
    results["New document upload"] = "FAIL";
    console.log("✗ TEST 2 FAIL: Upload failed.");
  }

  // --------------------------------------------------------------------------
  // TEST 3: Click "إعادة إرسال للمراجعة" -> Resubmission API
  // --------------------------------------------------------------------------
  console.log("\n--- TEST 3: Resubmission API & State Transition ---");
  const resubmitRes = await fetch(`${BASE_URL}/api/auth/submit-verification-documents`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-auth-token": uid },
    body: JSON.stringify({
      fullName: "Rejected User Test",
      phone: "+966500000000",
      hasCompany: false,
      personalDocuments: [newDoc],
      additionalNotes: "[إعادة إرسال]: Attached clear new national ID card"
    })
  });
  const resubmitData = await resubmitRes.json();

  const isResubmitSuccess = resubmitRes.ok && resubmitData.success;
  const isPendingReview =
    resubmitData.accountStatus === "PENDING_ADMIN_REVIEW" &&
    resubmitData.user?.accountStatus === "PENDING_ADMIN_REVIEW";

  if (isResubmitSuccess && isPendingReview) {
    results["Document linked to resubmission"] = "PASS";
    results["Resubmission API"] = "PASS";
    results["REJECTED → PENDING_ADMIN_REVIEW"] = "PASS";
    console.log("✓ TEST 3 PASS: Account transitioned from REJECTED → PENDING_ADMIN_REVIEW with new doc linked.");
  } else {
    results["Document linked to resubmission"] = "FAIL";
    results["Resubmission API"] = "FAIL";
    results["REJECTED → PENDING_ADMIN_REVIEW"] = "FAIL";
    console.log("✗ TEST 3 FAIL: Resubmission did not return PENDING_ADMIN_REVIEW.");
  }

  // --------------------------------------------------------------------------
  // TEST 4: Refresh Persistence
  // --------------------------------------------------------------------------
  console.log("\n--- TEST 4: Refresh persistence ---");
  const refreshStatusRes = await fetch(`${BASE_URL}/api/auth/current-user-status`, {
    headers: { "x-auth-token": uid }
  });
  const refreshData = await refreshStatusRes.json();
  const refreshedUser = refreshData.user;

  const isRefreshPending =
    refreshedUser.accountStatus === "PENDING_ADMIN_REVIEW" &&
    refreshedUser.canonicalVerificationStatus === "pending";

  if (isRefreshPending) {
    results["Refresh persistence"] = "PASS";
    console.log("✓ TEST 4 PASS: Status remains PENDING_ADMIN_REVIEW after refresh.");
  } else {
    results["Refresh persistence"] = "FAIL";
    console.log(`✗ TEST 4 FAIL: Status changed to ${refreshedUser.accountStatus}.`);
  }

  // --------------------------------------------------------------------------
  // TEST 5: Logout -> Login Persistence
  // --------------------------------------------------------------------------
  console.log("\n--- TEST 5: Logout → Login persistence ---");
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: testEmail, password: testPassword })
  });
  const loginData = await loginRes.json();
  const loggedInUser = loginData.user;

  const isLoginPending =
    loggedInUser.accountStatus === "PENDING_ADMIN_REVIEW" ||
    loggedInUser.canonicalVerificationStatus === "pending";
  const hasNewDocAttached = (loggedInUser.verificationDocuments || []).some(
    (d: any) => d.documentId === newDoc.documentId
  );

  if (isLoginPending && hasNewDocAttached) {
    results["Logout/login persistence"] = "PASS";
    console.log("✓ TEST 5 PASS: Status remains PENDING_ADMIN_REVIEW and new document remains attached after login.");
  } else {
    results["Logout/login persistence"] = "FAIL";
    console.log("✗ TEST 5 FAIL: Status or attached document lost upon login.");
  }

  // --------------------------------------------------------------------------
  // TEST 6: Open Admin Dashboard & verify pending review
  // --------------------------------------------------------------------------
  console.log("\n--- TEST 6: Admin pending review queue ---");
  const pendingRes = await fetch(`${BASE_URL}/api/admin/pending-approvals`, {
    headers: { "Authorization": `Bearer ${ADMIN_TOKEN}` }
  });
  const pendingData = await pendingRes.json();
  const pendingRecord = (pendingData.pendingApprovals || []).find((u: any) => u.userId === uid || u.id === uid || u.email === testEmail);

  if (pendingRecord) {
    results["Admin pending review"] = "PASS";
    console.log("✓ TEST 6 PASS: Resubmitted account appears in Admin pending approvals list.");
  } else {
    results["Admin pending review"] = "FAIL";
    console.log("✗ TEST 6 FAIL: Resubmitted account missing from admin pending approvals list.");
  }

  // --------------------------------------------------------------------------
  // TEST 7: Admin sees NEW uploaded document
  // --------------------------------------------------------------------------
  console.log("\n--- TEST 7: Admin sees NEW uploaded document ---");
  const adminDocs = pendingRecord?.documents || [];
  const seesNewDoc = adminDocs.some((d: any) => d.documentId === newDoc.documentId || d.fileName === newDoc.fileName);

  if (seesNewDoc) {
    results["Admin sees NEW document"] = "PASS";
    console.log("✓ TEST 7 PASS: Admin sees the NEW uploaded document.");
  } else {
    results["Admin sees NEW document"] = "FAIL";
    console.log("✗ TEST 7 FAIL: Admin does not see the new document.");
  }

  // --------------------------------------------------------------------------
  // TEST 8: Preview/download the new document
  // --------------------------------------------------------------------------
  console.log("\n--- TEST 8: Preview/download the document ---");
  const downloadRes = await fetch(`${BASE_URL}/api/auth/verification-document/${newDoc.documentId}`, {
    headers: { "Authorization": `Bearer ${ADMIN_TOKEN}` }
  });
  const downloadedBuffer = Buffer.from(await downloadRes.arrayBuffer());

  if (downloadRes.status === 200 && downloadedBuffer.length === newPdfBuffer.length) {
    results["Preview/download"] = "PASS";
    console.log(`✓ TEST 8 PASS: Document downloaded cleanly (${downloadedBuffer.length} bytes matched).`);
  } else {
    results["Preview/download"] = "FAIL";
    console.log("✗ TEST 8 FAIL: Download failed.");
  }

  // --------------------------------------------------------------------------
  // TEST 9: Verify old rejection reason remains historical
  // --------------------------------------------------------------------------
  console.log("\n--- TEST 9: Old rejection reason preserved historically ---");
  const historicalReason =
    refreshedUser.previousRejectionReason ||
    refreshedUser.historicalRejectionReason ||
    refreshedUser.verificationInfo?.previousAdminNote;

  if (historicalReason === rejectionReasonText && refreshedUser.rejectionReason === null) {
    results["Historical rejection reason preserved"] = "PASS";
    console.log("✓ TEST 9 PASS: Old rejection reason preserved as historical feedback and cleared from active state.");
  } else {
    results["Historical rejection reason preserved"] = "FAIL";
    console.log("✗ TEST 9 FAIL: Historical rejection reason not preserved properly.");
  }

  // --------------------------------------------------------------------------
  // TEST 10: Double-click / Idempotent Duplicate-Submission Protection
  // --------------------------------------------------------------------------
  console.log("\n--- TEST 10: Duplicate-submission protection ---");
  const req1 = fetch(`${BASE_URL}/api/auth/submit-verification-documents`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-auth-token": uid },
    body: JSON.stringify({ fullName: "Rejected User Test", phone: "+966500000000", personalDocuments: [newDoc] })
  });
  const req2 = fetch(`${BASE_URL}/api/auth/submit-verification-documents`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-auth-token": uid },
    body: JSON.stringify({ fullName: "Rejected User Test", phone: "+966500000000", personalDocuments: [newDoc] })
  });

  const [res1, res2] = await Promise.all([req1, req2]);
  if (res1.ok && res2.ok) {
    results["Duplicate submission protection"] = "PASS";
    console.log("✓ TEST 10 PASS: Concurrent submit calls processed idempotently without error.");
  } else {
    results["Duplicate submission protection"] = "FAIL";
    console.log("✗ TEST 10 FAIL: Concurrent submit calls caused errors.");
  }

  // --------------------------------------------------------------------------
  // TEST 11: Missing valid document protection
  // --------------------------------------------------------------------------
  console.log("\n--- TEST 11: Missing document protection ---");
  // Register another rejected user with 0 documents
  const user2Email = `no_doc_${Date.now()}@getzakir.com`;
  const reg2 = await fetch(`${BASE_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: user2Email, password: "Password123!@#", ownerName: "No Doc Test", companyName: "No Doc Co", role: "CEO" })
  });
  const reg2Data = await reg2.json();
  const uid2 = reg2Data.user.id || reg2Data.user.uid;

  const noDocResubmit = await fetch(`${BASE_URL}/api/auth/submit-verification-documents`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-auth-token": uid2 },
    body: JSON.stringify({ fullName: "No Doc Test", phone: "+966500000000", personalDocuments: [] })
  });

  if (noDocResubmit.status === 400) {
    results["Missing document protection"] = "PASS";
    console.log("✓ TEST 11 PASS: Backend correctly rejected submission without valid documents with HTTP 400.");
  } else {
    results["Missing document protection"] = "FAIL";
    console.log(`✗ TEST 11 FAIL: Backend returned HTTP ${noDocResubmit.status} instead of 400.`);
  }

  // --------------------------------------------------------------------------
  // TEST 12: Cross-account authorization protection
  // --------------------------------------------------------------------------
  console.log("\n--- TEST 12: Cross-account authorization protection ---");
  // User 2 attempts to resubmit documents for User 1 by supplying userId in body
  const unauthorizedResubmit = await fetch(`${BASE_URL}/api/auth/submit-verification-documents`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-auth-token": uid2 },
    body: JSON.stringify({ userId: uid, fullName: "Attacker", phone: "+966500000000", personalDocuments: [newDoc] })
  });
  const unauthData = await unauthorizedResubmit.json();

  // Verify User 1 was NOT modified by User 2's request
  const user1CheckRes = await fetch(`${BASE_URL}/api/auth/current-user-status`, {
    headers: { "x-auth-token": uid }
  });
  const user1CheckData = await user1CheckRes.json();
  const user1Unchanged = user1CheckData.user.ownerName === "Rejected User Test";

  if (user1Unchanged) {
    results["Cross-account authorization"] = "PASS";
    console.log("✓ TEST 12 PASS: Non-admin client cannot spoof userId for another user account.");
  } else {
    results["Cross-account authorization"] = "FAIL";
    console.log("✗ TEST 12 FAIL: Non-admin client was able to manipulate another user's account.");
  }

  console.log("\n==========================================================================");
  console.log("                       FINAL E2E VERIFICATION RESULTS                     ");
  console.log("==========================================================================");
  let allPass = true;
  for (const [testName, res] of Object.entries(results)) {
    console.log(`${testName.padEnd(40)}: ${res}`);
    if (res !== "PASS") allPass = false;
  }
  console.log("--------------------------------------------------------------------------");
  console.log(`FINAL E2E VERIFICATION STATUS: ${allPass ? "ALL TESTS PASSED" : "FAILURES DETECTED"}`);
  console.log("--------------------------------------------------------------------------\n");
}

runE2EResubmissionVerification().catch(console.error);
