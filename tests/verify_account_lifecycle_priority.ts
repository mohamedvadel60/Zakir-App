import { resolveAccountLifecycle, getAccountLifecycleRecord } from "../server.ts";

async function runTests() {
  console.log("==================================================");
  console.log("STARTING COMPREHENSIVE ACCOUNT LIFECYCLE PRIORITY SUITE");
  console.log("==================================================");

  let allPassed = true;

  // Helper assertion
  function assert(condition: boolean, testName: string, details?: any) {
    if (condition) {
      console.log(`[PASS] ${testName}`);
    } else {
      console.error(`[FAIL] ${testName}`, details || "");
      allPassed = false;
    }
  }

  // -------------------------------------------------------------------------
  // TEST 1 — CURRENT PROBLEM: mohamedvadhil0@gmail.com / MwlaEvpmSUYQl5oopJOj7Gc3dd52
  // Active user exists in users collection + old retained_users record exists
  // Expected: ACTIVE, NOT SELF_RESTORE_AVAILABLE
  // -------------------------------------------------------------------------
  console.log("\n--- TEST 1: CURRENT PROBLEM (Active User + Old Retained Record) ---");
  const test1Lifecycle = await resolveAccountLifecycle("mohamedvadhil0@gmail.com", "MwlaEvpmSUYQl5oopJOj7Gc3dd52");
  const test1Record = await getAccountLifecycleRecord("mohamedvadhil0@gmail.com", "MwlaEvpmSUYQl5oopJOj7Gc3dd52");

  assert(
    test1Lifecycle.status === "ACTIVE",
    "Test 1.1: resolveAccountLifecycle status is ACTIVE",
    test1Lifecycle
  );
  assert(
    test1Lifecycle.accountState === "ACTIVE_ACCOUNT",
    "Test 1.2: resolveAccountLifecycle accountState is ACTIVE_ACCOUNT",
    test1Lifecycle.accountState
  );
  assert(
    test1Lifecycle.isDeleted === false,
    "Test 1.3: resolveAccountLifecycle isDeleted is FALSE",
    test1Lifecycle.isDeleted
  );
  assert(
    test1Lifecycle.canRestore === false,
    "Test 1.4: resolveAccountLifecycle canRestore is FALSE",
    test1Lifecycle.canRestore
  );
  assert(
    test1Record !== null && test1Record.status === "ACTIVE",
    "Test 1.5: getAccountLifecycleRecord returns ACTIVE record (never SELF_DELETED)",
    test1Record
  );
  assert(
    test1Lifecycle.status !== "SELF_RESTORE_AVAILABLE" && test1Lifecycle.status !== "SELF_DELETED",
    "Test 1.6: SELF_RESTORE_AVAILABLE and SELF_DELETED MUST BE ABSENT",
    test1Lifecycle.status
  );

  // -------------------------------------------------------------------------
  // TEST 2 — REAL DELETED USER
  // User does NOT exist as active user + valid retained/deleted record exists
  // Expected: SELF_RESTORE_AVAILABLE / DELETED
  // -------------------------------------------------------------------------
  console.log("\n--- TEST 2: REAL DELETED USER ---");
  // Check that real deleted accounts in local store or test deleted user triggers SELF_RESTORE_AVAILABLE
  const fs = await import("fs");
  const path = await import("path");
  const dbPath = path.join(process.cwd(), "src", "db_store.json");
  const dbData = JSON.parse(fs.readFileSync(dbPath, "utf-8"));
  
  // Create a transient deleted account in memory for testing
  const tempDeletedEmail = "test_truly_deleted_account_123@zakir.ai";
  if (!dbData.account_lifecycle) dbData.account_lifecycle = [];
  const thirtyOneDaysMs = 31 * 24 * 60 * 60 * 1000;
  dbData.account_lifecycle = dbData.account_lifecycle.filter((x: any) => x.emailNormalized !== tempDeletedEmail);
  dbData.account_lifecycle.push({
    accountId: tempDeletedEmail,
    emailNormalized: tempDeletedEmail,
    status: "SELF_DELETED",
    deletionType: "self",
    deletedAt: new Date().toISOString(),
    restoreUntil: new Date(Date.now() + thirtyOneDaysMs).toISOString(),
    originalUserId: "usr_temp_deleted",
    adminApprovalRequired: false
  });
  // Ensure not in users
  dbData.users = (dbData.users || []).filter((u: any) => u.email !== tempDeletedEmail);
  fs.writeFileSync(dbPath, JSON.stringify(dbData, null, 2), "utf-8");

  const test2Resolution = await resolveAccountLifecycle(tempDeletedEmail);
  assert(
    test2Resolution.status === "SELF_DELETED" || test2Resolution.status === "SELF_RESTORE_AVAILABLE",
    "Test 2.1: Real deleted user status is SELF_DELETED / SELF_RESTORE_AVAILABLE",
    test2Resolution.status
  );
  assert(
    test2Resolution.isDeleted === true,
    "Test 2.2: Real deleted user isDeleted is TRUE",
    test2Resolution.isDeleted
  );
  assert(
    test2Resolution.canRestore === true,
    "Test 2.3: Real deleted user canRestore is TRUE (within 31 days)",
    test2Resolution.canRestore
  );
  assert(
    test2Resolution.accountState === "DELETED_ACCOUNT_NO_RECOVERY_REQUEST",
    "Test 2.4: Real deleted user accountState is DELETED_ACCOUNT_NO_RECOVERY_REQUEST",
    test2Resolution.accountState
  );

  // Clean up transient test deleted account
  const freshDb = JSON.parse(fs.readFileSync(dbPath, "utf-8"));
  freshDb.account_lifecycle = freshDb.account_lifecycle.filter((x: any) => x.emailNormalized !== tempDeletedEmail);
  fs.writeFileSync(dbPath, JSON.stringify(freshDb, null, 2), "utf-8");

  // -------------------------------------------------------------------------
  // TEST 3 — ACTIVE USER WITHOUT RETAINED RECORD
  // Expected: ACTIVE
  // -------------------------------------------------------------------------
  console.log("\n--- TEST 3: ACTIVE USER WITHOUT RETAINED RECORD ---");
  const test3Resolution = await resolveAccountLifecycle("mohamedvadhil0@gmail.com");
  assert(
    test3Resolution.status === "ACTIVE" && test3Resolution.accountState === "ACTIVE_ACCOUNT",
    "Test 3: Active user lookup by email only is ACTIVE_ACCOUNT",
    test3Resolution
  );

  // -------------------------------------------------------------------------
  // TEST 4 — UNKNOWN USER
  // No active user + no deletion record
  // Expected: NO_ACCOUNT / NEW
  // -------------------------------------------------------------------------
  console.log("\n--- TEST 4: UNKNOWN USER ---");
  const unknownEmail = `unknown_${Date.now()}@example.org`;
  const test4Resolution = await resolveAccountLifecycle(unknownEmail);
  assert(
    test4Resolution.status === "NEW" && test4Resolution.accountState === "NO_ACCOUNT" && !test4Resolution.isDeleted,
    "Test 4: Unknown user returns NO_ACCOUNT / NEW",
    test4Resolution
  );

  // -------------------------------------------------------------------------
  // TEST 5 — UID VS EMAIL CONFLICT
  // Verified Firebase UID maps to an active user, even if old retained_users record has the email
  // Expected: ACTIVE (The verified UID must win)
  // -------------------------------------------------------------------------
  console.log("\n--- TEST 5: UID VS EMAIL CONFLICT ---");
  const test5Resolution = await resolveAccountLifecycle("mohamedvadhil0@gmail.com", "MwlaEvpmSUYQl5oopJOj7Gc3dd52");
  assert(
    test5Resolution.status === "ACTIVE" && test5Resolution.originalUserId === "MwlaEvpmSUYQl5oopJOj7Gc3dd52",
    "Test 5: Verified UID takes precedence and returns ACTIVE with matching UID",
    test5Resolution
  );

  // -------------------------------------------------------------------------
  // TEST 6 — /api/auth/resolve-account HTTP ENDPOINT TEST
  // Direct HTTP request to dev server
  // -------------------------------------------------------------------------
  console.log("\n--- TEST 6: /api/auth/resolve-account HTTP ENDPOINT TEST ---");
  try {
    const res = await fetch("http://localhost:3000/api/auth/resolve-account", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "mohamedvadhil0@gmail.com", uid: "MwlaEvpmSUYQl5oopJOj7Gc3dd52" })
    });
    const data = await res.json() as any;
    assert(res.status === 200, "Test 6.1: HTTP status is 200 (not 403)", res.status);
    assert(data.success === true, "Test 6.2: success is true", data);
    assert(data.accountState === "ACTIVE_ACCOUNT", "Test 6.3: accountState is ACTIVE_ACCOUNT", data.accountState);
    assert(data.lifecycleStatus === "ACTIVE", "Test 6.4: lifecycleStatus is ACTIVE", data.lifecycleStatus);
    assert(data.canRestore === false, "Test 6.5: canRestore is false", data.canRestore);
    assert(data.code !== "SELF_RESTORE_AVAILABLE", "Test 6.6: code is NOT SELF_RESTORE_AVAILABLE", data.code);
  } catch (err: any) {
    console.error("[FAIL] Test 6 fetch error:", err.message);
    allPassed = false;
  }

  // -------------------------------------------------------------------------
  // TEST 7 — /api/auth/login HTTP ENDPOINT TEST
  // Ensure that /api/auth/login NEVER returns 403 SELF_RESTORE_AVAILABLE for active user
  // -------------------------------------------------------------------------
  console.log("\n--- TEST 7: /api/auth/login HTTP ENDPOINT TEST ---");
  try {
    const res = await fetch("http://localhost:3000/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "mohamedvadhil0@gmail.com", password: "test_non_matching_password" })
    });
    const data = await res.json() as any;
    // With wrong password, it MUST return 401 INVALID_CREDENTIALS, and MUST NEVER return 403 SELF_RESTORE_AVAILABLE!
    assert(
      res.status !== 403,
      `Test 7.1: Status is ${res.status} (MUST NOT be 403 SELF_RESTORE_AVAILABLE)`,
      res.status
    );
    assert(
      data.code !== "SELF_RESTORE_AVAILABLE" && data.error !== "SELF_RESTORE_AVAILABLE",
      "Test 7.2: Response code is NOT SELF_RESTORE_AVAILABLE",
      data
    );
    assert(
      data.message !== "تم العثور على حسابك المحذوف سابقاً، وهو متاح للاستعادة.",
      "Test 7.3: Deletion recovery message MUST NOT appear for active user",
      data.message
    );
  } catch (err: any) {
    console.error("[FAIL] Test 7 fetch error:", err.message);
    allPassed = false;
  }

  console.log("\n==================================================");
  if (allPassed) {
    console.log("ALL TEST CASES PASSED SUCCESSFULLY!");
  } else {
    console.error("SOME TESTS FAILED! INSPECT OUTPUT ABOVE.");
    process.exit(1);
  }
  console.log("==================================================");
}

runTests().catch((e) => {
  console.error("Unhandled error in test runner:", e);
  process.exit(1);
});
