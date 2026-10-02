import { getUserProfileServer, isUserAdminServer } from "../src/middleware/auth.js";
import { adminDb } from "../src/lib/firebase-admin.js";

async function runAccountNameIsolationVerification() {
  console.log("=================================================");
  console.log("ZAKIR ACCOUNT NAME ISOLATION & IDENTITY VERIFIER");
  console.log("=================================================\n");

  const testAccounts = [
    {
      uid: "usr_a",
      email: "user_a@zakir.ai",
      expectedRole: "CEO",
      isUserA: true
    },
    {
      uid: "usr_b",
      email: "user_b@zakir.ai",
      expectedRole: "CEO",
      isUserB: true
    },
    {
      uid: "SYhfciebGFUj29gqGaa0pqNunrk2",
      email: "mohamedvadel60@gmail.com",
      expectedRole: "Admin",
      isAdmin: true
    }
  ];

  let allPassed = true;
  const matrixResults: Array<{ account: string; expectedName: string; actualName: string; result: string }> = [];

  for (const acc of testAccounts) {
    console.log(`--- Testing Profile Isolation for UID: ${acc.uid} (${acc.email}) ---`);
    
    // Check server profile resolution
    const profile = await getUserProfileServer(acc.uid, acc.email);
    
    if (!profile) {
      console.error(`❌ FAIL: No profile returned for UID ${acc.uid}`);
      allPassed = false;
      matrixResults.push({ account: acc.email, expectedName: "Valid Profile", actualName: "NULL", result: "FAIL" });
      continue;
    }

    const resolvedUid = profile.id || profile.uid;
    const resolvedName = profile.ownerName || profile.fullName || profile.companyName || "";
    const resolvedEmail = profile.email;

    console.log(`Resolved UID   : ${resolvedUid}`);
    console.log(`Resolved Name  : "${resolvedName}"`);
    console.log(`Resolved Email : ${resolvedEmail}`);

    // Check UID integrity
    if (resolvedUid !== acc.uid) {
      console.error(`❌ FAIL: Mismatched UID in profile! Expected ${acc.uid}, got ${resolvedUid}`);
      allPassed = false;
    }

    // Check Admin isolation
    const isAdmin = await isUserAdminServer(acc.uid, acc.email);
    if (acc.isAdmin) {
      if (!isAdmin) {
        console.error(`❌ FAIL: Admin account ${acc.email} failed isUserAdminServer check!`);
        allPassed = false;
      }
    } else {
      if (isAdmin) {
        console.error(`❌ FAIL: Non-admin account ${acc.email} incorrectly marked as Admin!`);
        allPassed = false;
      }
    }

    // Check for profile name cross-contamination
    if (acc.isUserA) {
      if (resolvedName.toLowerCase().includes("user b") || resolvedName.toLowerCase().includes("admin") || resolvedEmail === "mohamedvadel60@gmail.com") {
        console.error(`❌ FAIL: User A profile contaminated with another user's name: ${resolvedName}`);
        allPassed = false;
      }
    }

    if (acc.isUserB) {
      if (resolvedName.toLowerCase().includes("user a") || resolvedName.toLowerCase().includes("admin") || resolvedEmail === "mohamedvadel60@gmail.com") {
        console.error(`❌ FAIL: User B profile contaminated with another user's name: ${resolvedName}`);
        allPassed = false;
      }
    }

    if (acc.isAdmin) {
      if (resolvedName.toLowerCase().includes("user a") || resolvedName.toLowerCase().includes("user b")) {
        console.error(`❌ FAIL: Admin profile contaminated with user name: ${resolvedName}`);
        allPassed = false;
      }
    }

    matrixResults.push({
      account: acc.email,
      expectedName: acc.isAdmin ? "Admin Profile Name" : (acc.isUserA ? "User A Name" : "User B Name"),
      actualName: resolvedName,
      result: "PASS"
    });

    console.log(`✔ PASS: Account ${acc.email} profile strictly isolated to UID ${acc.uid}\n`);
  }

  console.log("=================================================");
  console.log("ACCOUNT ISOLATION MATRIX");
  console.log("=================================================");
  console.table(matrixResults);

  if (allPassed) {
    console.log("\n🎉 ALL ACCOUNT NAME ISOLATION TESTS PASSED PERFECTLY!");
    process.exit(0);
  } else {
    console.error("\n❌ SOME ACCOUNT NAME ISOLATION TESTS FAILED!");
    process.exit(1);
  }
}

runAccountNameIsolationVerification().catch((err) => {
  console.error("Verification script execution error:", err);
  process.exit(1);
});
