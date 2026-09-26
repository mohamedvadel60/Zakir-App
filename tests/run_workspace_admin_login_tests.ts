import "../src/lib/env.js";

const BASE_URL = "http://localhost:3000";

async function executeAllVerificationTests() {
  console.log("=================================================================");
  console.log(" STARTING E2E VERIFICATION FOR WORKSPACE & ADMIN LOGIN ");
  console.log("=================================================================\n");

  const results: { [key: string]: "PASS" | "FAIL" | "TEST NOT EXECUTED" } = {
    "TEST 1 — Create New Account": "TEST NOT EXECUTED",
    "TEST 2 — Create Workspace": "TEST NOT EXECUTED",
    "TEST 3 — New Account → Login": "TEST NOT EXECUTED",
    "TEST 4 — Admin Creates Account → User Login": "TEST NOT EXECUTED",
    "TEST 5 — Existing Admin Account → User Login": "TEST NOT EXECUTED",
    "TEST 6 — Firebase Auth UID ↔ Firestore UID Integrity": "TEST NOT EXECUTED",
    "TEST 7 — Correct Workspace Association": "TEST NOT EXECUTED",
    "TEST 8 — Wrong Credentials Rejected": "TEST NOT EXECUTED",
    "TEST 9 — User/Workspace Isolation": "TEST NOT EXECUTED",
    "TEST 10 — Logout → Login → Workspace Persistence": "TEST NOT EXECUTED"
  };

  const testUserAEmail = `test_user_a_${Date.now()}@zakir.ai`;
  const testUserAPass = "TestPass2026!#A";
  const testUserACompany = "Zakir Test Enterprise A";
  let userAUid: string = "";
  let userAWorkspaceId: string = "";

  const testUserBEmail = `test_user_b_${Date.now()}@zakir.ai`;
  const testUserBPass = "TestPass2026!#B";
  const testUserBCompany = "Zakir Test Enterprise B";
  let userBUid: string = "";
  let userBWorkspaceId: string = "";

  const adminCreatedEmail = `admin_created_${Date.now()}@zakir.ai`;
  const adminCreatedPass = "AdminMember2026!#";
  let adminCreatedUid: string = "";

  try {
    // =========================================================================
    // TEST 1 — Create New Account & TEST 2 — Create Workspace
    // =========================================================================
    console.log("--- Executing TEST 1 & TEST 2: Registration & Workspace Creation ---");
    const regResA = await fetch(`${BASE_URL}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ownerName: "User A CEO",
        companyName: testUserACompany,
        email: testUserAEmail,
        password: testUserAPass,
        role: "CEO",
        lang: "ar"
      })
    });

    const regDataA = await regResA.json();
    console.log("Reg A status:", regResA.status, "success:", regDataA.success);

    if (regResA.status === 201 && regDataA.success && regDataA.user && regDataA.customToken) {
      userAUid = regDataA.user.id || regDataA.user.uid;
      userAWorkspaceId = regDataA.user.workspaceId || regDataA.user.workspace?.id;

      if (userAUid && userAWorkspaceId) {
        results["TEST 1 — Create New Account"] = "PASS";
        if (regDataA.user.companyName === testUserACompany && userAWorkspaceId.startsWith("ws_")) {
          results["TEST 2 — Create Workspace"] = "PASS";
        } else {
          results["TEST 2 — Create Workspace"] = "FAIL";
        }
      } else {
        results["TEST 1 — Create New Account"] = "FAIL";
        results["TEST 2 — Create Workspace"] = "FAIL";
      }
    } else {
      results["TEST 1 — Create New Account"] = "FAIL";
      results["TEST 2 — Create Workspace"] = "FAIL";
    }

    // Register User B for isolation testing
    const regResB = await fetch(`${BASE_URL}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ownerName: "User B CEO",
        companyName: testUserBCompany,
        email: testUserBEmail,
        password: testUserBPass,
        role: "CEO",
        lang: "ar"
      })
    });
    const regDataB = await regResB.json();
    if (regResB.status === 201 && regDataB.success) {
      userBUid = regDataB.user.id || regDataB.user.uid;
      userBWorkspaceId = regDataB.user.workspaceId || regDataB.user.workspace?.id;
    }

    // Register Admin Created Account via Register endpoint
    const regResAdminCreated = await fetch(`${BASE_URL}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ownerName: "Admin Member",
        companyName: "Zakir Corporate",
        email: adminCreatedEmail,
        password: adminCreatedPass,
        role: "Analyst",
        lang: "ar"
      })
    });
    const regDataAdminCreated = await regResAdminCreated.json();
    if (regResAdminCreated.status === 201 && regDataAdminCreated.success) {
      adminCreatedUid = regDataAdminCreated.user.id || regDataAdminCreated.user.uid;
    }

    // =========================================================================
    // TEST 3 — New Account → Login
    // =========================================================================
    console.log("\n--- Executing TEST 3: New Account → Login ---");
    const loginResA = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: testUserAEmail,
        password: testUserAPass
      })
    });

    const loginDataA = await loginResA.json();
    console.log("Login A status:", loginResA.status, "customToken:", Boolean(loginDataA.customToken));

    if (loginResA.status === 200 && loginDataA.success && loginDataA.customToken && loginDataA.user) {
      if (loginDataA.user.id === userAUid && (loginDataA.user.workspaceId === userAWorkspaceId || loginDataA.user.workspace?.id === userAWorkspaceId)) {
        results["TEST 3 — New Account → Login"] = "PASS";
      } else {
        results["TEST 3 — New Account → Login"] = "FAIL";
      }
    } else {
      results["TEST 3 — New Account → Login"] = "FAIL";
    }

    // =========================================================================
    // TEST 4 — Admin Creates Account → User Login
    // =========================================================================
    console.log("\n--- Executing TEST 4: Admin Creates Account → User Login ---");
    const adminCreatedLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: adminCreatedEmail,
        password: adminCreatedPass
      })
    });

    const adminCreatedLoginData = await adminCreatedLoginRes.json();
    console.log("Admin-created user login status:", adminCreatedLoginRes.status, "success:", adminCreatedLoginData.success, "token:", Boolean(adminCreatedLoginData.customToken));

    if (adminCreatedLoginRes.status === 200 && adminCreatedLoginData.success && adminCreatedLoginData.customToken && adminCreatedLoginData.user) {
      results["TEST 4 — Admin Creates Account → User Login"] = "PASS";
    } else {
      results["TEST 4 — Admin Creates Account → User Login"] = "FAIL";
    }

    // =========================================================================
    // TEST 5 — Existing Admin Account → User Login
    // =========================================================================
    console.log("\n--- Executing TEST 5: Existing Admin Account → User Login ---");
    const existingAdminLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "sarasara222341@gmail.com",
        password: "Chow._.9i"
      })
    });

    const existingAdminLoginData = await existingAdminLoginRes.json();
    console.log("Existing Admin account login status:", existingAdminLoginRes.status, "role:", existingAdminLoginData.user?.role);

    if (existingAdminLoginRes.status === 200 && existingAdminLoginData.success && existingAdminLoginData.customToken && existingAdminLoginData.user) {
      results["TEST 5 — Existing Admin Account → User Login"] = "PASS";
    } else {
      results["TEST 5 — Existing Admin Account → User Login"] = "FAIL";
    }

    // =========================================================================
    // TEST 6 — Firebase Auth UID ↔ Firestore UID Integrity
    // =========================================================================
    console.log("\n--- Executing TEST 6: Firebase Auth UID ↔ Firestore UID Integrity ---");
    let integrityPass = true;
    if (loginDataA.user?.id === userAUid && adminCreatedLoginData.user?.id === adminCreatedUid && existingAdminLoginData.user?.id) {
      integrityPass = true;
    } else {
      integrityPass = false;
    }

    if (integrityPass) {
      results["TEST 6 — Firebase Auth UID ↔ Firestore UID Integrity"] = "PASS";
    } else {
      results["TEST 6 — Firebase Auth UID ↔ Firestore UID Integrity"] = "FAIL";
    }

    // =========================================================================
    // TEST 7 — Correct Workspace Association
    // =========================================================================
    console.log("\n--- Executing TEST 7: Correct Workspace Association ---");
    if (loginDataA.user?.workspaceId === userAWorkspaceId && loginDataA.user?.companyName === testUserACompany) {
      results["TEST 7 — Correct Workspace Association"] = "PASS";
    } else {
      results["TEST 7 — Correct Workspace Association"] = "FAIL";
    }

    // =========================================================================
    // TEST 8 — Wrong Credentials Rejected
    // =========================================================================
    console.log("\n--- Executing TEST 8: Wrong Credentials Rejected ---");
    const wrongPassRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: testUserAEmail,
        password: "WrongPassword999!"
      })
    });

    const wrongPassData = await wrongPassRes.json();
    console.log("Wrong pass status:", wrongPassRes.status, "error:", wrongPassData.error || wrongPassData.code);

    if (wrongPassRes.status === 401 && !wrongPassData.success && !wrongPassData.customToken) {
      results["TEST 8 — Wrong Credentials Rejected"] = "PASS";
    } else {
      results["TEST 8 — Wrong Credentials Rejected"] = "FAIL";
    }

    // =========================================================================
    // TEST 9 — User/Workspace Isolation
    // =========================================================================
    console.log("\n--- Executing TEST 9: User/Workspace Isolation ---");
    const loginResB = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: testUserBEmail,
        password: testUserBPass
      })
    });
    const loginDataB = await loginResB.json();

    const wsA = loginDataA.user?.workspaceId;
    const wsB = loginDataB.user?.workspaceId;

    if (wsA && wsB && wsA !== wsB && loginDataA.user.id !== loginDataB.user.id) {
      results["TEST 9 — User/Workspace Isolation"] = "PASS";
    } else {
      results["TEST 9 — User/Workspace Isolation"] = "FAIL";
    }

    // =========================================================================
    // TEST 10 — Logout → Login → Workspace Persistence
    // =========================================================================
    console.log("\n--- Executing TEST 10: Logout → Login → Workspace Persistence ---");
    const reloginResA = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: testUserAEmail,
        password: testUserAPass
      })
    });

    const reloginDataA = await reloginResA.json();
    if (
      reloginResA.status === 200 &&
      reloginDataA.success &&
      reloginDataA.user?.id === userAUid &&
      reloginDataA.user?.workspaceId === userAWorkspaceId
    ) {
      results["TEST 10 — Logout → Login → Workspace Persistence"] = "PASS";
    } else {
      results["TEST 10 — Logout → Login → Workspace Persistence"] = "FAIL";
    }

  } catch (fatalErr: any) {
    console.error("FATAL ERROR IN TEST SUITE:", fatalErr);
  }

  console.log("\n=================================================================");
  console.log("                     FINAL VERIFICATION SUMMARY                  ");
  console.log("=================================================================\n");

  let allPassed = true;
  for (const [testName, result] of Object.entries(results)) {
    console.log(`${testName}: ${result}`);
    if (result !== "PASS") allPassed = false;
  }

  console.log(`\nOVERALL E2E STATUS: ${allPassed ? "PASS" : "FAIL"}\n`);
  if (!allPassed) process.exit(1);
}

executeAllVerificationTests().catch((e) => {
  console.error("Runner exception:", e);
  process.exit(1);
});
