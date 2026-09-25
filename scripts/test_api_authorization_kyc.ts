import fetch from "node-fetch";
import fs from "fs";

const BASE_URL = "http://localhost:3000";

interface TestResult {
  endpoint: string;
  method: string;
  scenario: string;
  expectedStatus: number;
  actualStatus: number;
  code?: string;
  pass: boolean;
  details: string;
}

async function runTests() {
  console.log("=== STARTING DIRECT API KYC AUTHORIZATION TEST SUITE ===");

  const results: TestResult[] = [];

  // Define the test endpoints specified in the prompt
  const endpoints = [
    { method: "GET", path: "/api/memories", body: undefined },
    { method: "POST", path: "/api/smart-evolution", body: { query: "market trend analysis" } },
    { method: "POST", path: "/api/market-intelligence", body: { topic: "Financial Services Growth Analysis", industry: "Financial Services" } },
    { method: "POST", path: "/api/database/schema", body: { query: "SELECT 1" } }
  ];

  // 1. UNAUTHENTICATED TESTS (No session) -> Must return 401
  console.log("\n--- Scenario 1: Unauthenticated (No Token) ---");
  for (const ep of endpoints) {
    try {
      const res = await fetch(`${BASE_URL}${ep.path}`, {
        method: ep.method,
        headers: { "Content-Type": "application/json" },
        body: ep.body ? JSON.stringify(ep.body) : undefined
      });
      const data = await res.json().catch(() => ({}));
      const pass = res.status === 401;
      results.push({
        endpoint: ep.path,
        method: ep.method,
        scenario: "No Session (Unauthenticated)",
        expectedStatus: 401,
        actualStatus: res.status,
        code: (data as any).code || (data as any).error,
        pass,
        details: JSON.stringify(data)
      });
      console.log(`[${pass ? "PASS" : "FAIL"}] ${ep.method} ${ep.path} -> Status ${res.status} (Expected 401)`);
    } catch (e: any) {
      console.error(`Error testing ${ep.path}:`, e.message);
    }
  }

  // Find or create test users in db_store.json to represent PENDING, REJECTED, and APPROVED states
  const dbStorePath = "./src/db_store.json";
  const db = JSON.parse(fs.readFileSync(dbStorePath, "utf8"));
  if (!db.users) db.users = [];

  // 1. PENDING User
  let pendingUser = db.users.find((u: any) => u.id === "test_pending_user_kyc");
  const pendingData = {
    id: "test_pending_user_kyc",
    uid: "test_pending_user_kyc",
    email: "pending.user@getzakir.com",
    name: "Pending Test User",
    role: "CEO",
    emailVerified: true,
    isEmailVerified: true,
    accountStatus: "PENDING_APPROVAL",
    status: "pending",
    kycStatus: "SUBMITTED",
    documentVerificationStatus: "UNDER_REVIEW",
    verificationStatus: "pending",
    verificationDocuments: [
      {
        id: "doc_pending_1",
        fileName: "commercial_reg.pdf",
        fileUrl: "https://storage.googleapis.com/getzakir/doc_pending_1.pdf",
        documentType: "commercial_register",
        status: "PENDING",
        verificationStatus: "PENDING",
        uploadedAt: new Date().toISOString()
      }
    ],
    powers: { memoryVault: true, marketIntel: true, fileVault: true },
    subscriptionPlan: "Enterprise",
    subscriptionStatus: "Active"
  };
  if (!pendingUser) {
    db.users.push(pendingData);
  } else {
    Object.assign(pendingUser, pendingData);
  }

  // 2. REJECTED User
  let rejectedUser = db.users.find((u: any) => u.id === "test_rejected_user_kyc");
  const rejectedData = {
    id: "test_rejected_user_kyc",
    uid: "test_rejected_user_kyc",
    email: "rejected.user@getzakir.com",
    name: "Rejected Test User",
    role: "CEO",
    emailVerified: true,
    isEmailVerified: true,
    accountStatus: "REJECTED",
    status: "rejected",
    kycStatus: "REJECTED",
    documentVerificationStatus: "REJECTED",
    verificationStatus: "rejected",
    rejectionReason: "المستند غير واضح وبحاجة لإعادة رفع بدقة أعلى",
    verificationDocuments: [
      {
        id: "doc_rej_1",
        fileName: "expired_license.pdf",
        fileUrl: "https://storage.googleapis.com/getzakir/doc_rej_1.pdf",
        documentType: "commercial_register",
        status: "REJECTED",
        verificationStatus: "REJECTED",
        rejectionReason: "منتهي الصلاحية",
        uploadedAt: new Date().toISOString()
      }
    ],
    powers: { memoryVault: true, marketIntel: true, fileVault: true },
    subscriptionPlan: "Enterprise",
    subscriptionStatus: "Active"
  };
  if (!rejectedUser) {
    db.users.push(rejectedData);
  } else {
    Object.assign(rejectedUser, rejectedData);
  }

  // 3. APPROVED User
  let approvedUser = db.users.find((u: any) => u.id === "test_approved_user_kyc");
  const approvedData = {
    id: "test_approved_user_kyc",
    uid: "test_approved_user_kyc",
    email: "approved.user@getzakir.com",
    name: "Approved Test User",
    role: "CEO",
    emailVerified: true,
    isEmailVerified: true,
    accountStatus: "APPROVED",
    status: "approved",
    kycStatus: "VERIFIED",
    documentVerificationStatus: "APPROVED",
    verificationStatus: "verified",
    approvedAt: new Date().toISOString(),
    approvedBy: "SYhfciebGFUj29gqGaa0pqNunrk2",
    subscriptionPlan: "Enterprise",
    subscriptionStatus: "Active",
    verificationDocuments: [
      {
        id: "doc_app_1",
        fileName: "commercial_reg_valid.pdf",
        fileUrl: "https://storage.googleapis.com/getzakir/doc_app_1.pdf",
        documentType: "commercial_register",
        status: "APPROVED",
        verificationStatus: "APPROVED",
        uploadedAt: new Date().toISOString()
      }
    ],
    powers: { memoryVault: true, marketIntel: true, fileVault: true }
  };
  if (!approvedUser) {
    db.users.push(approvedData);
  } else {
    Object.assign(approvedUser, approvedData);
  }

  fs.writeFileSync(dbStorePath, JSON.stringify(db, null, 2), "utf8");

  // 2. PENDING USER TESTS -> Must return 403 with code VERIFICATION_REQUIRED
  console.log("\n--- Scenario 2: Valid Session with PENDING Account ---");
  for (const ep of endpoints) {
    try {
      const res = await fetch(`${BASE_URL}${ep.path}`, {
        method: ep.method,
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer test_pending_user_kyc`
        },
        body: ep.body ? JSON.stringify(ep.body) : undefined
      });
      const data = await res.json().catch(() => ({}));
      const isCodeMatch = (data as any).code === "VERIFICATION_REQUIRED";
      const pass = res.status === 403 && isCodeMatch;
      results.push({
        endpoint: ep.path,
        method: ep.method,
        scenario: "Valid Session (PENDING Status)",
        expectedStatus: 403,
        actualStatus: res.status,
        code: (data as any).code,
        pass,
        details: JSON.stringify(data)
      });
      console.log(`[${pass ? "PASS" : "FAIL"}] ${ep.method} ${ep.path} -> Status ${res.status}, Code: ${(data as any).code} (Expected 403 / VERIFICATION_REQUIRED)`);
    } catch (e: any) {
      console.error(`Error testing ${ep.path}:`, e.message);
    }
  }

  // 3. REJECTED USER TESTS -> Must return 403 with code VERIFICATION_REQUIRED
  console.log("\n--- Scenario 3: Valid Session with REJECTED Account ---");
  for (const ep of endpoints) {
    try {
      const res = await fetch(`${BASE_URL}${ep.path}`, {
        method: ep.method,
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer test_rejected_user_kyc`
        },
        body: ep.body ? JSON.stringify(ep.body) : undefined
      });
      const data = await res.json().catch(() => ({}));
      const isCodeMatch = (data as any).code === "VERIFICATION_REQUIRED";
      const pass = res.status === 403 && isCodeMatch;
      results.push({
        endpoint: ep.path,
        method: ep.method,
        scenario: "Valid Session (REJECTED Status)",
        expectedStatus: 403,
        actualStatus: res.status,
        code: (data as any).code,
        pass,
        details: JSON.stringify(data)
      });
      console.log(`[${pass ? "PASS" : "FAIL"}] ${ep.method} ${ep.path} -> Status ${res.status}, Code: ${(data as any).code} (Expected 403 / VERIFICATION_REQUIRED)`);
    } catch (e: any) {
      console.error(`Error testing ${ep.path}:`, e.message);
    }
  }

  // 4. APPROVED USER TESTS -> Must return 200 (ALLOWED)
  console.log("\n--- Scenario 4: Valid Session with APPROVED Account ---");
  for (const ep of endpoints) {
    try {
      const res = await fetch(`${BASE_URL}${ep.path}`, {
        method: ep.method,
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer test_approved_user_kyc`
        },
        body: ep.body ? JSON.stringify(ep.body) : undefined
      });
      const data = await res.json().catch(() => ({}));
      const pass = res.status >= 200 && res.status < 300;
      results.push({
        endpoint: ep.path,
        method: ep.method,
        scenario: "Valid Session (APPROVED Status)",
        expectedStatus: 200,
        actualStatus: res.status,
        code: (data as any).code || "OK",
        pass,
        details: JSON.stringify(data).slice(0, 100)
      });
      console.log(`[${pass ? "PASS" : "FAIL"}] ${ep.method} ${ep.path} -> Status ${res.status} (Expected 200 OK)`);
    } catch (e: any) {
      console.error(`Error testing ${ep.path}:`, e.message);
    }
  }

  console.log("\n=== TEST SUMMARY ===");
  const allPassed = results.every(r => r.pass);
  console.log(`Overall Result: ${allPassed ? "ALL TESTS PASSED (PASS)" : "SOME TESTS FAILED (FAIL)"}`);
  console.log(`Total tests: ${results.length}, Passed: ${results.filter(r => r.pass).length}, Failed: ${results.filter(r => !r.pass).length}`);

  return { allPassed, results };
}

runTests().then(({ allPassed }) => {
  if (!allPassed) process.exit(1);
}).catch(err => {
  console.error("Test runner error:", err);
  process.exit(1);
});
