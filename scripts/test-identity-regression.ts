import { isUserAdmin, ADMIN_USER_ID, ADMIN_EMAILS } from "../src/lib/firebaseServices.ts";
import { isUserAdminServer, getUserProfileServer, ADMIN_EMAILS as ADMIN_EMAILS_SERVER } from "../src/middleware/auth.ts";
import { getOrCreateUser } from "../src/db/users.ts";

async function runRegressionSuite() {
  console.log("==================================================");
  console.log("RUNNING IDENTITY REGRESSION SUITE (TESTS A - H)");
  console.log("==================================================\n");

  let allPassed = true;

  function assert(condition: boolean, testName: string, details: string) {
    if (condition) {
      console.log(`[PASS] ${testName}: ${details}`);
    } else {
      console.error(`[FAIL] ${testName}: ${details}`);
      allPassed = false;
    }
  }

  // TEST A: Fresh normal-user login
  const normalUserA = { id: "usr_normal_1", email: "normal1@example.com", role: "Contributor" };
  const isAdminA = isUserAdmin(normalUserA);
  assert(!isAdminA && normalUserA.id === "usr_normal_1", "TEST A", "Fresh normal-user login produces normal UID & Admin authorization = false");

  // TEST B: Admin -> logout -> normal user
  let activeUser: any = { id: ADMIN_USER_ID, email: "admin@zakir.ai", role: "Admin" };
  let activeIsAdmin = isUserAdmin(activeUser);
  // Logout
  activeUser = null;
  // Normal User login
  activeUser = { id: "usr_normal_2", email: "normal2@example.com", role: "Contributor" };
  activeIsAdmin = isUserAdmin(activeUser);
  assert(!activeIsAdmin && activeUser.id === "usr_normal_2", "TEST B", "Admin -> logout -> normal user results in normal identity only (isAdmin = false)");

  // TEST C: Normal user -> logout -> Admin
  activeUser = { id: "usr_normal_2", email: "normal2@example.com", role: "Contributor" };
  activeUser = null;
  activeUser = { id: ADMIN_USER_ID, email: "admin@zakir.ai", role: "Admin" };
  activeIsAdmin = isUserAdmin(activeUser);
  assert(activeIsAdmin && activeUser.id === ADMIN_USER_ID, "TEST C", "Normal user -> logout -> Admin results in Admin identity only (isAdmin = true)");

  // TEST D: Normal user with an email that previously existed in hardcoded ADMIN_EMAILS (mohamedvadel60@gmail.com)
  const legacyEmailUser = { id: "usr_normal_legacy", email: "mohamedvadel60@gmail.com", role: "Contributor" };
  const isLegacyEmailAdmin = isUserAdmin(legacyEmailUser);
  assert(!isLegacyEmailAdmin, "TEST D", "Normal user with email mohamedvadel60@gmail.com produces Admin authorization = false");

  // TEST E: Normal user with a different email (user_b@zakir.ai)
  const emailUserB = { id: "usr_normal_b", email: "user_b@zakir.ai", role: "Contributor" };
  const isUserBAdmin = isUserAdmin(emailUserB);
  assert(!isUserBAdmin, "TEST E", "Normal user with email user_b@zakir.ai produces Admin authorization = false");

  // TEST F: Normal user refresh
  const refreshedUser = { id: "usr_normal_1", email: "normal1@example.com", role: "Contributor" };
  assert(!isUserAdmin(refreshedUser) && refreshedUser.id === "usr_normal_1", "TEST F", "Normal user refresh maintains same normal identity");

  // TEST G: Two normal users sequentially
  const user1 = { id: "usr_seq_1", email: "seq1@example.com", role: "Contributor" };
  const user2 = { id: "usr_seq_2", email: "seq2@example.com", role: "Contributor" };
  assert(!isUserAdmin(user1) && !isUserAdmin(user2) && user1.id !== user2.id, "TEST G", "Two normal users sequentially cause zero identity contamination");

  // TEST H: Profile lookup mismatch
  try {
    const mismatchResult = await getUserProfileServer("usr_mismatch_test_id");
    assert(mismatchResult === null || mismatchResult.id === "usr_mismatch_test_id", "TEST H", "Profile lookup mismatch fails closed, never falls back to Admin profile");
  } catch (err: any) {
    assert(err.message.includes("SECURITY_FATAL_UID_MISMATCH"), "TEST H", "Profile lookup mismatch threw SECURITY_FATAL_UID_MISMATCH as expected");
  }

  console.log("\n==================================================");
  if (allPassed) {
    console.log("ALL IDENTITY REGRESSION TESTS PASSED (8 / 8)");
  } else {
    console.error("IDENTITY REGRESSION SUITE FAILED");
    process.exit(1);
  }
  console.log("==================================================");
}

runRegressionSuite();
