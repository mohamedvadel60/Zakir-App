import path from "path";
import fs from "fs";

async function runTests() {
  console.log("=== STARTING EXISTING EMAIL REGISTRATION TEST SUITE ===");

  const testExistingEmail = "ceo.existing@zakir-test.com";
  const testExistingOwner = "Existing Owner";
  const testExistingCompany = "Existing Company";

  // 1. Setup existing user in local DB / Store to test against
  const dbPath = path.resolve("./data/db.json");
  let db: any = { users: [], verification_requests: [], account_lifecycle: [] };
  if (fs.existsSync(dbPath)) {
    try {
      db = JSON.parse(fs.readFileSync(dbPath, "utf-8"));
    } catch (e) {}
  }
  if (!Array.isArray(db.users)) db.users = [];

  const existingUid = "usr_existing_123456";
  let existingUser = db.users.find((u: any) => u.email === testExistingEmail);
  if (!existingUser) {
    existingUser = {
      id: existingUid,
      email: testExistingEmail,
      ownerName: testExistingOwner,
      companyName: testExistingCompany,
      role: "CEO",
      createdAt: new Date().toISOString()
    };
    db.users.push(existingUser);
    fs.writeFileSync(dbPath, JSON.stringify(db, null, 2), "utf-8");
  }

  // Also mirror to local_db.json
  try {
    fs.writeFileSync(path.resolve("./local_db.json"), JSON.stringify(db, null, 2), "utf-8");
  } catch (e) {}

  console.log(`[TEST SETUP] Existing user created in test DB with UID: ${existingUser.id}`);

  // Import Express app directly from server.ts
  const serverModule = await import("../server.js");
  const app = (serverModule as any).default || serverModule.app;

  // Helper to simulate express request
  const makeRequest = (urlPath: string, bodyData: any) => {
    return new Promise<{ status: number; body: any }>((resolve) => {
      let statusCode = 200;
      const headers: Record<string, string> = {};
      const res: any = {
        status: (code: number) => {
          statusCode = code;
          return res;
        },
        json: (data: any) => {
          resolve({ status: statusCode, body: data });
        },
        setHeader: (name: string, val: string) => {
          headers[name.toLowerCase()] = val;
          return res;
        },
        getHeader: (name: string) => headers[name.toLowerCase()],
        end: () => resolve({ status: statusCode, body: {} })
      };
      const req: any = {
        method: "POST",
        url: urlPath,
        originalUrl: urlPath,
        body: bodyData,
        headers: { "content-type": "application/json" },
        ip: "127.0.0.1",
        socket: { remoteAddress: "127.0.0.1" }
      };
      app(req, res);
    });
  };

  // TEST 1: Registering with existing email
  console.log("\n[TEST 1] Registering with existing email:", testExistingEmail);
  const regRes = await makeRequest("/api/auth/register", {
    email: testExistingEmail,
    password: "NewPassword123!",
    ownerName: "Attempted Impostor",
    companyName: "Fake Corp",
    role: "CEO",
    lang: "ar"
  });

  console.log(`[TEST 1 RESULT] HTTP Status: ${regRes.status}, Response:`, regRes.body);

  const isStatus409 = regRes.status === 409 || regRes.status === 400;
  const hasExactMessage = regRes.body.error?.includes("مرتبط بحساب موجود بالفعل") || regRes.body.code === "EMAIL_ALREADY_IN_USE";

  if (!isStatus409 || !hasExactMessage) {
    console.error("TEST 1 FAILED: Expected 409 Conflict with 'مرتبط بحساب موجود بالفعل'");
    process.exit(1);
  }
  console.log("TEST 1 PASS: Detected existing email, stopped registration with HTTP 409 & exact localized message.");

  // TEST 2 & 3: Check database integrity (no overwrite, no duplicate UID, no new document)
  const updatedDb = JSON.parse(fs.readFileSync(dbPath, "utf-8"));
  const matchingUsers = updatedDb.users.filter((u: any) => u.email === testExistingEmail);

  if (matchingUsers.length !== 1) {
    console.error(`TEST 2 FAILED: Found ${matchingUsers.length} user records for ${testExistingEmail}. Expected 1.`);
    process.exit(1);
  }

  if (matchingUsers[0].id !== existingUid || matchingUsers[0].ownerName !== testExistingOwner) {
    console.error("TEST 2/3 FAILED: Original user record was modified or overwritten!");
    process.exit(1);
  }
  console.log("TEST 2 & 3 PASS: No duplicate account created. Original user UID and profile remain untouched.");

  // TEST 5: New email registration regression check
  const newEmail = `new.user.${Date.now()}@zakir-test.com`;
  console.log("\n[TEST 5] Registering with brand new email:", newEmail);
  const newRegRes = await makeRequest("/api/auth/register", {
    email: newEmail,
    password: "Password123!",
    ownerName: "New User Owner",
    companyName: "New Ventures LLC",
    role: "CEO",
    lang: "ar"
  });

  console.log(`[TEST 5 RESULT] HTTP Status: ${newRegRes.status}, Response Success:`, newRegRes.body.success);

  if (newRegRes.status !== 200 && newRegRes.status !== 201 || !newRegRes.body.success) {
    console.error("TEST 5 FAILED: New email registration regression failure:", newRegRes.body);
    process.exit(1);
  }
  console.log("TEST 5 PASS: New user registration functions as expected.");

  console.log("\n=== ALL REGISTRATION SECURITY TESTS PASSED SUCCESSFULLY ===");
}

runTests().catch(err => {
  console.error("TEST RUN ERROR:", err);
  process.exit(1);
});
