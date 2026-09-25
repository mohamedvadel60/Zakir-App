import { computeStrictVerificationState } from "../src/middleware/auth.js";
import { computeUserVerificationBreakdown } from "../src/lib/firebaseServices.js";

async function runScenarioTests() {
  console.log("=== STARTING SCENARIO VERIFICATION TESTS ===");
  let allPassed = true;

  // SCENARIO A: New User (0 docs, no request, inactive)
  console.log("\n--- Scenario A: New user (inactive, 0 docs, no request) ---");
  const userA = {
    id: "usr_test_a",
    email: "test_a@example.com",
    accountStatus: "PENDING_EMAIL_VERIFICATION",
    documentVerificationStatus: "NOT_SUBMITTED",
    verificationDocuments: [],
    documents: [],
    isVerified: false,
    isEmailVerified: false,
  };

  const stateA = computeStrictVerificationState(userA);
  const breakdownA = computeUserVerificationBreakdown(userA);

  const passA1 = stateA.effectiveStatus === "PENDING_EMAIL_VERIFICATION";
  const passA2 = stateA.isVerified === false;
  const passA3 = breakdownA.kycStatus === "NOT_VERIFIED";
  const passA4 = breakdownA.uiState === "NO_REQUEST";
  const passA5 = breakdownA.canApproveKyc === false;
  const passA = passA1 && passA2 && passA3 && passA4 && passA5;

  console.log(`Scenario A result: ${passA ? "PASS" : "FAIL"}`);
  console.log(`- effectiveStatus: ${stateA.effectiveStatus} (expected: PENDING_EMAIL_VERIFICATION)`);
  console.log(`- isVerified: ${stateA.isVerified} (expected: false)`);
  console.log(`- kycStatus: ${breakdownA.kycStatus} (expected: NOT_VERIFIED)`);
  console.log(`- uiState: ${breakdownA.uiState} (expected: NO_REQUEST)`);
  console.log(`- canApproveKyc: ${breakdownA.canApproveKyc} (expected: false)`);
  if (!passA) allPassed = false;

  // SCENARIO B: Same user after Account Activation (accountStatus: APPROVED, 0 docs, no request)
  console.log("\n--- Scenario B: Activated account with 0 docs (approved, 0 docs, no request) ---");
  const userB = {
    id: "usr_test_b",
    email: "test_b@example.com",
    accountStatus: "APPROVED",
    approvedAt: new Date().toISOString(),
    documentVerificationStatus: "NOT_SUBMITTED",
    verificationDocuments: [],
    documents: [],
    isVerified: false,
    isEmailVerified: true,
  };

  const stateB = computeStrictVerificationState(userB);
  const breakdownB = computeUserVerificationBreakdown(userB);

  const passB1 = stateB.effectiveStatus === "APPROVED";
  const passB2 = stateB.isVerified === false;
  const passB3 = breakdownB.accountApprovalStatus === "APPROVED";
  const passB4 = breakdownB.kycStatus === "NOT_VERIFIED";
  const passB5 = breakdownB.uiState === "NO_REQUEST";
  const passB6 = breakdownB.canApproveKyc === false;
  const passB = passB1 && passB2 && passB3 && passB4 && passB5 && passB6;

  console.log(`Scenario B result: ${passB ? "PASS" : "FAIL"}`);
  console.log(`- effectiveStatus (Access Allowed): ${stateB.effectiveStatus} (expected: APPROVED)`);
  console.log(`- isVerified (KYC): ${stateB.isVerified} (expected: false)`);
  console.log(`- accountApprovalStatus: ${breakdownB.accountApprovalStatus} (expected: APPROVED)`);
  console.log(`- kycStatus: ${breakdownB.kycStatus} (expected: NOT_VERIFIED)`);
  console.log(`- uiState (Queue exclusion): ${breakdownB.uiState} (expected: NO_REQUEST)`);
  console.log(`- canApproveKyc: ${breakdownB.canApproveKyc} (expected: false)`);
  if (!passB) allPassed = false;

  // SCENARIO C: User with 1+ uploaded document & pending verification request
  console.log("\n--- Scenario C: User with uploaded document (approved account, 1 doc, under review) ---");
  const userC = {
    id: "usr_test_c",
    email: "test_c@example.com",
    accountStatus: "APPROVED",
    documentVerificationStatus: "UNDER_REVIEW",
    verificationRequestStatus: "UNDER_REVIEW",
    verificationDocuments: [
      {
        documentId: "doc_123",
        fileName: "commercial_registry.pdf",
        status: "PENDING",
      }
    ],
    isVerified: false,
    isEmailVerified: true,
  };

  const stateC = computeStrictVerificationState(userC);
  const breakdownC = computeUserVerificationBreakdown(userC);

  const passC1 = stateC.effectiveStatus === "APPROVED"; // Access still allowed
  const passC2 = stateC.isVerified === false; // KYC not yet verified
  const passC3 = breakdownC.documentCount === 1;
  const passC4 = breakdownC.uiState === "PENDING_REVIEW";
  const passC5 = breakdownC.canApproveKyc === true;
  const passC = passC1 && passC2 && passC3 && passC4 && passC5;

  console.log(`Scenario C result: ${passC ? "PASS" : "FAIL"}`);
  console.log(`- effectiveStatus: ${stateC.effectiveStatus} (expected: APPROVED)`);
  console.log(`- isVerified: ${stateC.isVerified} (expected: false)`);
  console.log(`- documentCount: ${breakdownC.documentCount} (expected: 1)`);
  console.log(`- uiState (In Review Queue): ${breakdownC.uiState} (expected: PENDING_REVIEW)`);
  console.log(`- canApproveKyc: ${breakdownC.canApproveKyc} (expected: true)`);
  if (!passC) allPassed = false;

  // SCENARIO D: Documents approved by admin
  console.log("\n--- Scenario D: Documents approved by admin ---");
  const userD = {
    id: "usr_test_d",
    email: "test_d@example.com",
    accountStatus: "APPROVED",
    documentVerificationStatus: "APPROVED",
    verificationRequestStatus: "APPROVED",
    kycStatus: "VERIFIED",
    verificationDocuments: [
      {
        documentId: "doc_123",
        fileName: "commercial_registry.pdf",
        status: "APPROVED",
        verificationStatus: "APPROVED"
      }
    ],
    isVerified: true,
    isEmailVerified: true,
  };

  const stateD = computeStrictVerificationState(userD);
  const breakdownD = computeUserVerificationBreakdown(userD);

  const passD1 = stateD.effectiveStatus === "APPROVED";
  const passD2 = stateD.isVerified === true;
  const passD3 = breakdownD.kycStatus === "VERIFIED";
  const passD4 = breakdownD.uiState === "VERIFIED";
  const passD5 = breakdownD.documentCount === 1;
  const passD = passD1 && passD2 && passD3 && passD4 && passD5;

  console.log(`Scenario D result: ${passD ? "PASS" : "FAIL"}`);
  console.log(`- effectiveStatus: ${stateD.effectiveStatus} (expected: APPROVED)`);
  console.log(`- isVerified: ${stateD.isVerified} (expected: true)`);
  console.log(`- kycStatus: ${breakdownD.kycStatus} (expected: VERIFIED)`);
  console.log(`- uiState: ${breakdownD.uiState} (expected: VERIFIED)`);
  if (!passD) allPassed = false;

  console.log(`\n=== OVERALL SCENARIOS VERIFICATION: ${allPassed ? "ALL TESTS PASSED" : "TESTS FAILED"} ===\n`);
}

runScenarioTests();
