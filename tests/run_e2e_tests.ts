import { computeCanonicalVerification, normalizeUserDocuments } from "../src/lib/unifiedVerification.js";
import { computeUserVerificationBreakdown } from "../src/lib/firebaseServices.js";
import { deriveAccountAndVerificationState } from "../src/middleware/auth.js";

async function executeE2ETests() {
  console.log("=================================================================");
  console.log("     STARTING COMPREHENSIVE E2E VERIFICATION SUITE              ");
  console.log("=================================================================\n");

  let totalTests = 0;
  let passedTests = 0;

  function assert(condition: boolean, testName: string, detail: string) {
    totalTests++;
    if (condition) {
      passedTests++;
      console.log(`[PASS] ${testName}: ${detail}`);
    } else {
      console.error(`[FAIL] ${testName}: ${detail}`);
    }
  }

  // =========================================================================
  // TEST 1 — CONFIRMED EMAIL → KYC UPLOAD
  // =========================================================================
  console.log("--- TEST 1 — CONFIRMED EMAIL → KYC UPLOAD ---");
  {
    // Step 1: User completes email verification
    const verifiedUser = {
      id: "usr_e2e_t1",
      email: "user_t1@example.com",
      emailVerified: true,
      isEmailVerified: true,
      emailVerifiedAt: new Date().toISOString(),
      accountStatus: "PENDING_DOCUMENT_VERIFICATION",
      documentVerificationStatus: "NOT_SUBMITTED",
      documents: [],
      verificationDocuments: []
    };

    const statusInitial = computeCanonicalVerification(verifiedUser, false);
    assert(
      statusInitial.isEmailVerified === true && statusInitial.accountStatus !== "PENDING_EMAIL_VERIFICATION",
      "Test 1.1 Initial Email State",
      `isEmailVerified=${statusInitial.isEmailVerified}, accountStatus=${statusInitial.accountStatus}`
    );

    // Step 2: Upload document during KYC
    const updatedUserWithDoc = {
      ...verifiedUser,
      verificationDocuments: [
        {
          documentId: "doc_e2e_1",
          fileName: "national_id.pdf",
          status: "PENDING",
          category: "personal",
          uploadedAt: new Date().toISOString()
        }
      ],
      documentVerificationStatus: "UNDER_REVIEW",
      accountStatus: "PENDING_ADMIN_REVIEW"
    };

    const statusAfterUpload = computeCanonicalVerification(updatedUserWithDoc, false);
    assert(
      statusAfterUpload.isEmailVerified === true,
      "Test 1.2 Email Verified Remains True After Upload",
      `isEmailVerified=${statusAfterUpload.isEmailVerified}`
    );
    assert(
      statusAfterUpload.accountStatus !== "PENDING_EMAIL_VERIFICATION",
      "Test 1.3 Account Status Is Not Reverted To Email Verification",
      `accountStatus=${statusAfterUpload.accountStatus}`
    );
    assert(
      statusAfterUpload.documentVerificationStatus === "UNDER_REVIEW",
      "Test 1.4 KYC Status Is Under Review",
      `documentVerificationStatus=${statusAfterUpload.documentVerificationStatus}`
    );
  }
  console.log("");

  // =========================================================================
  // TEST 2 — KYC SUBMISSION
  // =========================================================================
  console.log("--- TEST 2 — KYC SUBMISSION ---");
  {
    const submissionUser = {
      id: "usr_e2e_t2",
      email: "user_t2@example.com",
      emailVerified: true,
      isEmailVerified: true,
      emailVerifiedAt: new Date().toISOString(),
      accountStatus: "PENDING_ADMIN_REVIEW",
      documentVerificationStatus: "UNDER_REVIEW",
      verificationRequestStatus: "UNDER_REVIEW",
      verificationDocuments: [
        { documentId: "doc_sub_1", fileName: "commercial_license.pdf", status: "PENDING" }
      ]
    };

    const canonicalSub = computeCanonicalVerification(submissionUser, false);
    const breakdownSub = computeUserVerificationBreakdown(submissionUser);

    assert(
      canonicalSub.isEmailVerified === true,
      "Test 2.1 Email Verified Remains True After Submission",
      `isEmailVerified=${canonicalSub.isEmailVerified}`
    );
    assert(
      canonicalSub.canonicalStatus === "pending",
      "Test 2.2 Canonical Status is Pending Admin Review",
      `canonicalStatus=${canonicalSub.canonicalStatus}`
    );
    assert(
      breakdownSub.uiState === "PENDING_REVIEW",
      "Test 2.3 UI Breakdown shows PENDING_REVIEW",
      `uiState=${breakdownSub.uiState}`
    );
    assert(
      breakdownSub.canApproveKyc === true,
      "Test 2.4 Admin Can Approve KYC Request",
      `canApproveKyc=${breakdownSub.canApproveKyc}`
    );
  }
  console.log("");

  // =========================================================================
  // TEST 3 — LOGOUT → LOGIN → CHECK KYC STATUS
  // =========================================================================
  console.log("--- TEST 3 — LOGOUT → LOGIN → CHECK KYC STATUS ---");
  {
    // Simulate user payload retrieved upon re-login after logout
    const reLoggedInUser = {
      id: "usr_e2e_t3",
      email: "user_t3@example.com",
      emailVerified: true,
      isEmailVerified: true,
      emailVerifiedAt: new Date().toISOString(),
      accountStatus: "PENDING_ADMIN_REVIEW",
      documentVerificationStatus: "UNDER_REVIEW",
      documents: [{ id: "doc_1", name: "id.png" }]
    };

    const derivedAuthProfileState = deriveAccountAndVerificationState(reLoggedInUser, false);
    const canonicalState = computeCanonicalVerification(reLoggedInUser, false);

    assert(
      derivedAuthProfileState.emailVerified === true,
      "Test 3.1 Auth Derived Profile preserves email verification on re-login",
      `emailVerified=${derivedAuthProfileState.emailVerified}`
    );
    assert(
      canonicalState.isEmailVerified === true,
      "Test 3.2 Canonical verification confirms email verified on re-login",
      `isEmailVerified=${canonicalState.isEmailVerified}`
    );
    assert(
      canonicalState.accountStatus !== "PENDING_EMAIL_VERIFICATION",
      "Test 3.3 Account status does NOT revert to PENDING_EMAIL_VERIFICATION",
      `accountStatus=${canonicalState.accountStatus}`
    );
  }
  console.log("");

  // =========================================================================
  // TEST 4 — SKIP KYC
  // =========================================================================
  console.log("--- TEST 4 — SKIP KYC ---");
  {
    // User verified email and skipped KYC
    const skippedUser = {
      id: "usr_e2e_t4",
      email: "user_t4@example.com",
      emailVerified: true,
      isEmailVerified: true,
      accountStatus: "APPROVED",
      documentVerificationStatus: "NOT_SUBMITTED",
      documents: [],
      verificationDocuments: [],
      kycSkipped: true
    };

    const canonicalSkipped = computeCanonicalVerification(skippedUser, false);

    assert(
      canonicalSkipped.isEmailVerified === true,
      "Test 4.1 Skipping KYC preserves email verification state",
      `isEmailVerified=${canonicalSkipped.isEmailVerified}`
    );
    assert(
      canonicalSkipped.accountStatus !== "PENDING_EMAIL_VERIFICATION",
      "Test 4.2 Skipping KYC does NOT trigger Email Verification screen",
      `accountStatus=${canonicalSkipped.accountStatus}`
    );

    // Simulate re-login after skipping KYC
    const reLoginSkippedUser = { ...skippedUser };
    const reLoginCanonical = computeCanonicalVerification(reLoginSkippedUser, false);

    assert(
      reLoginCanonical.isEmailVerified === true,
      "Test 4.3 Re-login after skipping KYC maintains verified email",
      `isEmailVerified=${reLoginCanonical.isEmailVerified}`
    );
    assert(
      reLoginCanonical.accountStatus !== "PENDING_EMAIL_VERIFICATION",
      "Test 4.4 Re-login after skipping KYC never requests OTP or Email Verification",
      `accountStatus=${reLoginCanonical.accountStatus}`
    );
  }
  console.log("");

  // =========================================================================
  // TEST 5 — REFRESH / NEW SESSION
  // =========================================================================
  console.log("--- TEST 5 — REFRESH / NEW SESSION ---");
  {
    const sessionUser = {
      id: "usr_e2e_t5",
      email: "user_t5@example.com",
      emailVerified: true,
      isEmailVerified: true,
      emailVerifiedAt: new Date().toISOString(),
      accountStatus: "PENDING_ADMIN_REVIEW",
      verificationDocuments: [{ documentId: "doc_sess", fileName: "passport.pdf" }]
    };

    // Simulate multiple fast page reloads / token refreshes
    for (let i = 1; i <= 3; i++) {
      const canonical = computeCanonicalVerification(sessionUser, false);
      const derived = deriveAccountAndVerificationState(sessionUser, false);

      assert(
        canonical.isEmailVerified === true && derived.emailVerified === true,
        `Test 5.${i} Session refresh ${i} keeps emailVerified = true`,
        `canonical.isEmailVerified=${canonical.isEmailVerified}, derived.emailVerified=${derived.emailVerified}`
      );
    }
  }
  console.log("");

  // =========================================================================
  // TEST 6 — DOCUMENT UPLOAD FAILURE (MUST NOT RESET EMAIL VERIFICATION)
  // =========================================================================
  console.log("--- TEST 6 — DOCUMENT UPLOAD FAILURE ---");
  {
    const failedUploadUser = {
      id: "usr_e2e_t6",
      email: "user_t6@example.com",
      emailVerified: true,
      isEmailVerified: true,
      emailVerifiedAt: new Date().toISOString(),
      accountStatus: "PENDING_DOCUMENT_VERIFICATION",
      documentVerificationStatus: "FAILED_UPLOAD",
      lastUploadError: "Network timeout or invalid file format",
      verificationDocuments: []
    };

    const canonicalFailed = computeCanonicalVerification(failedUploadUser, false);

    assert(
      canonicalFailed.isEmailVerified === true,
      "Test 6.1 Upload failure DOES NOT reset emailVerified",
      `isEmailVerified=${canonicalFailed.isEmailVerified}`
    );
    assert(
      canonicalFailed.accountStatus !== "PENDING_EMAIL_VERIFICATION",
      "Test 6.2 Upload failure DOES NOT redirect user to Email Verification screen",
      `accountStatus=${canonicalFailed.accountStatus}`
    );
  }
  console.log("");

  // =========================================================================
  // TEST 7 — ADMIN RE-VERIFICATION REQUEST (ONLY ALLOWED EXCEPTION)
  // =========================================================================
  console.log("--- TEST 7 — ADMIN RE-VERIFICATION REQUEST ---");
  {
    // Normal user without admin request
    const normalUser = {
      id: "usr_e2e_t7_1",
      email: "user_t7_1@example.com",
      emailVerified: true,
      isEmailVerified: true,
      adminRequestedEmailReverification: false
    };

    const canonicalNormal = computeCanonicalVerification(normalUser, false);
    assert(
      canonicalNormal.isEmailVerified === true,
      "Test 7.1 Normal verified user is NOT requested to re-verify email",
      `isEmailVerified=${canonicalNormal.isEmailVerified}`
    );

    // User where Admin explicitly requested email re-verification
    const adminRequestedUser = {
      id: "usr_e2e_t7_2",
      email: "user_t7_2@example.com",
      emailVerified: true,
      isEmailVerified: true,
      adminRequestedEmailReverification: true
    };

    const canonicalAdminReq = computeCanonicalVerification(adminRequestedUser, false);
    assert(
      canonicalAdminReq.isEmailVerified === false || canonicalAdminReq.accountStatus === "PENDING_EMAIL_VERIFICATION",
      "Test 7.2 Explicit Admin re-verification request triggers Email Verification requirement",
      `isEmailVerified=${canonicalAdminReq.isEmailVerified}, accountStatus=${canonicalAdminReq.accountStatus}`
    );
  }
  console.log("");

  // =========================================================================
  // TEST 8 — MULTIPLE KYC RE-SUBMISSIONS
  // =========================================================================
  console.log("--- TEST 8 — MULTIPLE KYC RE-SUBMISSIONS ---");
  {
    let userState: any = {
      id: "usr_e2e_t8",
      email: "user_t8@example.com",
      emailVerified: true,
      isEmailVerified: true,
      emailVerifiedAt: new Date().toISOString(),
      accountStatus: "PENDING_DOCUMENT_VERIFICATION",
      documentVerificationStatus: "NOT_SUBMITTED",
      verificationDocuments: []
    };

    // First submission
    userState = {
      ...userState,
      accountStatus: "PENDING_ADMIN_REVIEW",
      documentVerificationStatus: "UNDER_REVIEW",
      verificationDocuments: [{ documentId: "v1", fileName: "id_v1.pdf" }]
    };
    let c1 = computeCanonicalVerification(userState, false);
    assert(
      c1.isEmailVerified === true && c1.accountStatus === "PENDING_ADMIN_REVIEW",
      "Test 8.1 First submission maintains email verification",
      `isEmailVerified=${c1.isEmailVerified}, accountStatus=${c1.accountStatus}`
    );

    // Resubmission after document update
    userState = {
      ...userState,
      verificationDocuments: [
        { documentId: "v1", fileName: "id_v1.pdf" },
        { documentId: "v2", fileName: "id_v2_clear.pdf" }
      ]
    };
    let c2 = computeCanonicalVerification(userState, false);
    assert(
      c2.isEmailVerified === true && c2.accountStatus === "PENDING_ADMIN_REVIEW",
      "Test 8.2 Document update/resubmission maintains email verification",
      `isEmailVerified=${c2.isEmailVerified}, documentCount=${normalizeUserDocuments(userState).documentCount}`
    );
  }
  console.log("");

  console.log("=================================================================");
  console.log(` SUMMARY: ${passedTests}/${totalTests} TESTS PASSED`);
  console.log("=================================================================");

  if (passedTests === totalTests) {
    console.log("ALL E2E SCENARIOS VERIFIED SUCCESSFULLY! NO REGRESSIONS FOUND.");
  } else {
    console.error("SOME TESTS FAILED! PLEASE REVIEW THE LOGS ABOVE.");
    process.exit(1);
  }
}

executeE2ETests().catch((err) => {
  console.error("Fatal error executing E2E test runner:", err);
  process.exit(1);
});
