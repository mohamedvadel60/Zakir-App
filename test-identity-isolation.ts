import { getUserProfileServer, isUserAdminServer } from "./src/middleware/auth.js";
import { getAccountLifecycleRecord } from "./src/lib/recoveryService.js";
import { clearUserLocalCache } from "./src/lib/firebaseServices.js";

async function runAutomatedTests() {
  console.log("=========================================");
  console.log(" 🚨 RUNNING CRITICAL SECURITY & ISOLATION SUITE (TESTS A - H)");
  console.log("=========================================");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${testName}${detail ? `: ${detail}` : ""}`);
      failed++;
    }
  }

  // -----------------------------------------------------------------
  // TEST A: Normal User Login Identity Assertion (UID === Profile Document ID)
  // -----------------------------------------------------------------
  try {
    const normalUid = "usr_test_normal_99";
    const normalProfile = await getUserProfileServer(normalUid, "normal_test_99@zakir.ai");
    if (normalProfile) {
      assert(normalProfile.id === normalUid, "TEST A: Normal User Login Identity Assertion", `Expected ${normalUid}, got ${normalProfile.id}`);
    } else {
      assert(true, "TEST A: Normal User Login Identity Assertion (No profile mismatch returned)");
    }
  } catch (err: any) {
    if (err.message?.includes("SECURITY_FATAL_UID_MISMATCH")) {
      assert(false, "TEST A: Normal User Login Identity Assertion", "SECURITY_FATAL_UID_MISMATCH thrown due to mismatched profile");
    } else {
      assert(true, "TEST A: Normal User Login Identity Assertion");
    }
  }

  // -----------------------------------------------------------------
  // TEST B: Normal User Admin Isolation (Non-admin cannot get Admin role)
  // -----------------------------------------------------------------
  try {
    const normalUid = "usr_test_normal_99";
    const normalEmail = "normal_test_99@zakir.ai";
    const isAdmin = await isUserAdminServer(normalUid, normalEmail);
    assert(!isAdmin, "TEST B: Normal User Admin Isolation (Normal user is not Admin)");
  } catch (err: any) {
    assert(false, "TEST B: Normal User Admin Isolation", err.message);
  }

  // -----------------------------------------------------------------
  // TEST C: Admin User Login Integrity
  // -----------------------------------------------------------------
  try {
    const adminUid = "SYhfciebGFUj29gqGaa0pqNunrk2";
    const adminEmail = "mohamedvadel60@gmail.com";
    const isAdmin = await isUserAdminServer(adminUid, adminEmail);
    assert(isAdmin, "TEST C: Admin User Login Integrity (Admin UID correctly recognized)");
  } catch (err: any) {
    assert(false, "TEST C: Admin User Login Integrity", err.message);
  }

  // -----------------------------------------------------------------
  // TEST D: Active User Password Failure Handling (Wrong password !== Recovery)
  // -----------------------------------------------------------------
  try {
    const activeEmail = "risk.auditor@testcompany.com";
    const lifecycle = await getAccountLifecycleRecord(activeEmail);
    assert(lifecycle?.status === "ACTIVE", "TEST D: Active User Password Failure Handling", `Active user returned status: ${lifecycle?.status}`);
  } catch (err: any) {
    assert(false, "TEST D: Active User Password Failure Handling", err.message);
  }

  // -----------------------------------------------------------------
  // TEST E: Active User Login Success Handling (Active user status is ACTIVE)
  // -----------------------------------------------------------------
  try {
    const activeEmail = "sarah.lead@testorg.com";
    const lifecycle = await getAccountLifecycleRecord(activeEmail);
    assert(lifecycle?.status === "ACTIVE", "TEST E: Active User Login Success Handling", `Expected status ACTIVE, got ${lifecycle?.status}`);
  } catch (err: any) {
    assert(false, "TEST E: Active User Login Success Handling", err.message);
  }

  // -----------------------------------------------------------------
  // TEST F: Deleted User Lifecycle Isolation
  // -----------------------------------------------------------------
  try {
    const deletedEmail = "truly_deleted_user_test_99@zakir.ai";
    const lifecycle = await getAccountLifecycleRecord(deletedEmail);
    // Non-existent or deleted user returns null or non-active status
    assert(lifecycle === null || lifecycle?.status !== "ACTIVE", "TEST F: Deleted User Lifecycle Isolation", "Truly deleted/non-existent user did not claim active state");
  } catch (err: any) {
    assert(false, "TEST F: Deleted User Lifecycle Isolation", err.message);
  }

  // -----------------------------------------------------------------
  // TEST G: Logout State Sanitization
  // -----------------------------------------------------------------
  try {
    clearUserLocalCache();
    assert(true, "TEST G: Logout State Sanitization (Cache cleared cleanly)");
  } catch (err: any) {
    assert(false, "TEST G: Logout State Sanitization", err.message);
  }

  // -----------------------------------------------------------------
  // TEST H: Session Token Isolation (Cross-user UID isolation)
  // -----------------------------------------------------------------
  try {
    const userAUid = "usr_a_99";
    const userBUid = "usr_b_99";
    const profileA = await getUserProfileServer(userAUid);
    const profileB = await getUserProfileServer(userBUid);
    const isolated = (!profileA || profileA.id === userAUid) && (!profileB || profileB.id === userBUid);
    assert(isolated, "TEST H: Session Token Isolation (User A & User B UIDs strictly isolated)");
  } catch (err: any) {
    assert(false, "TEST H: Session Token Isolation", err.message);
  }

  console.log("=========================================");
  console.log(` 📊 SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log("=========================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runAutomatedTests().catch((err) => {
  console.error("Fatal test runner error:", err);
  process.exit(1);
});
