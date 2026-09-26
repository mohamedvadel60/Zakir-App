import { readFileSync } from "fs";
import { resolve } from "path";

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

const BASE_URL = "http://localhost:3000";

async function runSuite() {
  console.log("=================================================");
  console.log("RUNNING MANDATORY REPRODUCTION & VERIFICATION SUITE");
  console.log("=================================================");

  const timestamp = Date.now();
  const testEmail = `applicant_${timestamp}@getzakir.com`;
  const testPassword = "Password123!@#";
  const testOwner = "Applicant Test";
  const testCompany = "Zakira Corp";

  // ----------------------------------------------------
  // STEP 1: Register User
  // ----------------------------------------------------
  console.log("\n[STEP 1] Registering test user:", testEmail);
  const regRes = await fetch(`${BASE_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: testEmail,
      password: testPassword,
      ownerName: testOwner,
      companyName: testCompany,
      role: "CEO"
    })
  });
  const regData = await regRes.json();
  assert(regRes.ok && regData.success, `Registration failed: ${JSON.stringify(regData)}`);
  const registeredUser = regData.user;
  const uid = registeredUser.id || registeredUser.uid;
  console.log("✓ User registered. UID:", uid);

  // ----------------------------------------------------
  // STEP 2: Verify Email with OTP
  // ----------------------------------------------------
  console.log("\n[STEP 2] Verifying Email with OTP for:", testEmail);
  let otpCode = regData.devCode;
  if (!otpCode) {
    console.log("Requesting fresh verification code...");
    const sendRes = await fetch(`${BASE_URL}/api/auth/send-verification-code`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: testEmail,
        userId: uid,
        type: "account_registration"
      })
    });
    const sendData = await sendRes.json();
    otpCode = sendData.devCode || "123456";
  }

  console.log("Using verification code:", otpCode);
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
  const verifyData = await verifyRes.json();
  assert(verifyRes.ok && verifyData.success, `Email OTP verification failed: ${JSON.stringify(verifyData)}`);
  const verifiedUser = verifyData.user;

  assert(verifiedUser.isEmailVerified === true || verifiedUser.emailVerified === true, "User must be email verified!");
  console.log("✓ Email verified successfully. isEmailVerified:", verifiedUser.isEmailVerified);

  // ----------------------------------------------------
  // STEP 3: Check Current User Status in KYC stage
  // ----------------------------------------------------
  console.log("\n[STEP 3] Checking current user status post-email verification");
  const statusRes1 = await fetch(`${BASE_URL}/api/auth/current-user-status`, {
    headers: { "x-auth-token": uid }
  });
  const statusData1 = await statusRes1.json();
  assert(statusRes1.ok && statusData1.success, `Status check failed: ${JSON.stringify(statusData1)}`);
  assert(statusData1.user.isEmailVerified === true, "isEmailVerified must be TRUE in status check");
  console.log("✓ Current user status: isEmailVerified = true, accountStatus =", statusData1.user.accountStatus);

  // ----------------------------------------------------
  // STEP 4: Upload KYC Document
  // ----------------------------------------------------
  console.log("\n[STEP 4] Uploading personal identification document for KYC...");
  const dummyPdfBuffer = Buffer.from("%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj 3 0 obj<</Type/Page/MediaBox[0 0 612 792]>>endobj\nxref\n0 4\n0000000000 65535 f\n0000000009 00000 n\n0000000052 00000 n\n0000000101 00000 n\ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n162\n%%EOF");
  const base64Pdf = dummyPdfBuffer.toString("base64");

  const uploadRes = await fetch(`${BASE_URL}/api/auth/verification-document/upload`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-auth-token": uid
    },
    body: JSON.stringify({
      category: "personal",
      docType: "national_id",
      fileName: "National_ID_Card.pdf",
      mimeType: "application/pdf",
      fileBase64: base64Pdf
    })
  });
  const uploadData = await uploadRes.json();
  assert(uploadRes.ok && uploadData.success, `Document upload failed: ${JSON.stringify(uploadData)}`);
  const uploadedDoc = uploadData.document;
  console.log("✓ Document uploaded successfully:", uploadedDoc.fileName, "ID:", uploadedDoc.documentId);

  // ----------------------------------------------------
  // STEP 5: Verify Email Status is NOT lost after Document Upload
  // ----------------------------------------------------
  console.log("\n[STEP 5] Verifying user status AFTER document upload (must NOT return to Email Verification)...");
  const statusRes2 = await fetch(`${BASE_URL}/api/auth/current-user-status`, {
    headers: { "x-auth-token": uid }
  });
  const statusData2 = await statusRes2.json();
  assert(statusRes2.ok && statusData2.success, `Status check after upload failed: ${JSON.stringify(statusData2)}`);
  assert(statusData2.user.isEmailVerified === true, "CRITICAL: isEmailVerified MUST REMAIN TRUE after upload!");
  assert(statusData2.user.emailVerified === true, "CRITICAL: emailVerified MUST REMAIN TRUE after upload!");
  console.log("✓ PASS: User isEmailVerified remains TRUE after document upload!");

  // ----------------------------------------------------
  // STEP 6: Submit Verification Documents
  // ----------------------------------------------------
  console.log("\n[STEP 6] Submitting full KYC verification request...");
  const submitRes = await fetch(`${BASE_URL}/api/auth/submit-verification-documents`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-auth-token": uid
    },
    body: JSON.stringify({
      fullName: testOwner,
      phone: "+966500000000",
      jobTitle: "CEO",
      hasCompany: true,
      companyName: testCompany,
      sector: "Technology",
      country: "Saudi Arabia",
      personalDocuments: [uploadedDoc],
      companyDocuments: [],
      additionalNotes: "KYC Verification Test"
    })
  });
  const submitData = await submitRes.json();
  assert(submitRes.ok && submitData.success, `Submit verification documents failed: ${JSON.stringify(submitData)}`);
  console.log("✓ Verification documents submitted successfully. Status:", submitData.accountStatus);

  // ----------------------------------------------------
  // STEP 7: Verify User Status post-submission
  // ----------------------------------------------------
  console.log("\n[STEP 7] Verifying user status AFTER submission...");
  const statusRes3 = await fetch(`${BASE_URL}/api/auth/current-user-status`, {
    headers: { "x-auth-token": uid }
  });
  const statusData3 = await statusRes3.json();
  assert(statusRes3.ok && statusData3.success, `Status check after submission failed: ${JSON.stringify(statusData3)}`);
  assert(statusData3.user.isEmailVerified === true, "CRITICAL: isEmailVerified MUST REMAIN TRUE after submission!");
  assert(statusData3.user.accountStatus === "PENDING_ADMIN_REVIEW", "accountStatus must be PENDING_ADMIN_REVIEW");
  assert(statusData3.user.documentVerificationStatus === "UNDER_REVIEW", "documentVerificationStatus must be UNDER_REVIEW");
  console.log("✓ PASS: User is in PENDING_ADMIN_REVIEW and isEmailVerified remains TRUE!");

  // ----------------------------------------------------
  // STEP 8: Logout and Login check
  // ----------------------------------------------------
  console.log("\n[STEP 8] Testing Logout and Login again with credentials...");
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: testEmail,
      password: testPassword
    })
  });
  const loginData = await loginRes.json();
  assert(loginRes.ok && (loginData.user || loginData.id), `Login failed: ${JSON.stringify(loginData)}`);
  const reloadedUser = loginData.user || loginData;
  assert(reloadedUser.isEmailVerified === true || reloadedUser.emailVerified === true, "User must still be email verified on login!");
  console.log("✓ PASS: Login successful and emailVerified is strictly preserved!");

  // ----------------------------------------------------
  // STEP 9: Public Routes Integrity Check
  // ----------------------------------------------------
  console.log("\n[STEP 9] Checking Public Routes & HTML for /dashboard leakage...");
  const indexHtml = readFileSync(resolve("./index.html"), "utf8");
  assert(!indexHtml.includes('href="/dashboard"'), "index.html must not contain href=/dashboard");
  assert(indexHtml.includes('<link rel="canonical" href="https://getzakir.com/" />'), "Canonical URL on root must be https://getzakir.com/");
  console.log("✓ PASS: Public routes have proper canonicals and no unwanted /dashboard leak!");

  console.log("\n=================================================");
  console.log("ALL MANDATORY TESTS PASSED 100%");
  console.log("=================================================");
}

runSuite().catch((err) => {
  console.error("\n❌ SUITE FAILED:", err);
  process.exit(1);
});
