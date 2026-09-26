import "../src/lib/env.js";

const BASE_URL = "http://localhost:3000";

async function runRealUiVerification() {
  console.log("=================================================================");
  console.log(" STARTING REAL E2E SCENARIO VERIFICATION ");
  console.log("=================================================================\n");

  let test1Pass = false;
  let test2Pass = false;

  // =========================================================================
  // PROBLEM 1 REAL SCENARIO: New User & Workspace Creation -> Persistence -> Login
  // =========================================================================
  console.log("--- PROBLEM 1 TEST: Real User & Workspace Creation Lifecycle ---");
  const test1Email = `ui_workspace_test_${Date.now()}@zakir.ai`;
  const test1Passwd = "RealWorkspacePass2026!#";
  const test1Company = "Real UI Workspace Enterprise";
  const test1Owner = "Real UI Founder";

  try {
    // 1. Submit registration / workspace creation form
    const regRes = await fetch(`${BASE_URL}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ownerName: test1Owner,
        companyName: test1Company,
        email: test1Email,
        password: test1Passwd,
        role: "CEO",
        lang: "ar"
      })
    });

    console.log("Register HTTP Status:", regRes.status);
    const regData = await regRes.json();
    console.log("Register Success:", regData.success);
    console.log("Register customToken present:", Boolean(regData.customToken));

    if (regRes.status === 201 && regData.success && regData.user && regData.customToken) {
      const createdUid = regData.user.id || regData.user.uid;
      const workspaceId = regData.user.workspaceId || regData.user.workspace?.id;

      console.log("Created UID:", createdUid);
      console.log("Created Workspace ID:", workspaceId);
      console.log("Created Company Name:", regData.user.companyName);

      // 2. Verify Current User Status API
      const statusRes = await fetch(`${BASE_URL}/api/auth/current-user-status?uid=${createdUid}&email=${encodeURIComponent(test1Email)}`, {
        headers: { "X-Auth-Token": createdUid }
      });
      const statusData = await statusRes.json();
      console.log("Current User Status API Success:", statusData.success);
      console.log("Retrieved Workspace ID:", statusData.user?.workspaceId);

      // 3. Test Logout & Login
      const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: test1Email,
          password: test1Passwd
        })
      });

      const loginData = await loginRes.json();
      console.log("Login HTTP Status:", loginRes.status);
      console.log("Login Success:", loginData.success);
      console.log("Login User Workspace:", loginData.user?.workspaceId);

      if (
        statusData.success &&
        statusData.user?.workspaceId === workspaceId &&
        loginRes.status === 200 &&
        loginData.user?.id === createdUid &&
        loginData.user?.workspaceId === workspaceId
      ) {
        test1Pass = true;
        console.log("[PASS] Problem 1 Lifecycle Verification Succeeded!");
      } else {
        console.error("[FAIL] Problem 1 Lifecycle Verification Failed!");
      }
    } else {
      console.error("[FAIL] Problem 1 Registration Failed:", regData);
    }
  } catch (e: any) {
    console.error("[FAIL] Problem 1 Exception:", e.message);
  }

  console.log("\n-----------------------------------------------------------------");

  // =========================================================================
  // PROBLEM 2 REAL SCENARIO: Existing Admin Account Login & Identity Integrity
  // =========================================================================
  console.log("--- PROBLEM 2 TEST: Existing Admin Account Login ---");
  const adminTestEmail = "sarasara222341@gmail.com";
  const adminTestPass = "Chow._.9i";

  try {
    // 1. Execute Login with Correct Credentials
    const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: adminTestEmail,
        password: adminTestPass
      })
    });

    const loginData = await loginRes.json();
    console.log("Admin Login Status:", loginRes.status);
    console.log("Admin Login Success:", loginData.success);
    console.log("Admin Login UID:", loginData.user?.id);
    console.log("Admin Login Role:", loginData.user?.role);
    console.log("Custom Token Returned:", Boolean(loginData.customToken));

    // 2. Test Login with WRONG Password (Must fail)
    const wrongRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: adminTestEmail,
        password: "WrongPassword123!"
      })
    });
    const wrongData = await wrongRes.json();
    console.log("Wrong Password Status:", wrongRes.status, "Rejected:", wrongRes.status === 401);

    if (
      loginRes.status === 200 &&
      loginData.success &&
      loginData.user?.role === "Admin" &&
      loginData.customToken &&
      wrongRes.status === 401 &&
      !wrongData.success
    ) {
      test2Pass = true;
      console.log("[PASS] Problem 2 Admin Account Verification Succeeded!");
    } else {
      console.error("[FAIL] Problem 2 Admin Account Verification Failed!");
    }
  } catch (e: any) {
    console.error("[FAIL] Problem 2 Exception:", e.message);
  }

  console.log("\n=================================================================");
  console.log(` SUMMARY: Problem 1 = ${test1Pass ? "PASS" : "FAIL"} | Problem 2 = ${test2Pass ? "PASS" : "FAIL"}`);
  console.log("=================================================================");

  if (test1Pass && test2Pass) {
    console.log("\nFINAL STATUS: PASS\n");
  } else {
    console.log("\nFINAL STATUS: FAIL\n");
    process.exit(1);
  }
}

runRealUiVerification().catch((e) => {
  console.error("Fatal runner error:", e);
  process.exit(1);
});
