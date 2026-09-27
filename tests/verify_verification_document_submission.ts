import path from "path";
import fs from "fs";

async function runSubmissionTest() {
  console.log("=== STARTING VERIFICATION SUBMISSION & TRANSITION TEST ===");

  const serverModule: any = await import("../server.js");
  const app = serverModule.default || serverModule.app;

  const testUserId = `test_verification_user_${Date.now()}`;
  const testEmail = `verification.test.${Date.now()}@zakir-test.com`;

  // 1. Setup user in test DB with NOT_SUBMITTED verification status
  const dbPath = path.resolve("./data/db.json");
  let db: any = { users: [] };
  if (fs.existsSync(dbPath)) {
    try { db = JSON.parse(fs.readFileSync(dbPath, "utf-8")); } catch (e) {}
  }
  if (!Array.isArray(db.users)) db.users = [];

  const initialUser = {
    id: testUserId,
    email: testEmail,
    ownerName: "Verification Tester",
    companyName: "Test Org",
    role: "CEO",
    accountStatus: "VERIFICATION_REQUIRED",
    documentVerificationStatus: "NOT_SUBMITTED",
    createdAt: new Date().toISOString()
  };
  db.users.push(initialUser);
  fs.writeFileSync(dbPath, JSON.stringify(db, null, 2), "utf-8");

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
        headers: {
          "content-type": "application/json",
          "authorization": "Bearer token_test_verification"
        },
        user: { uid: testUserId, email: testEmail },
        ip: "127.0.0.1",
        socket: { remoteAddress: "127.0.0.1" }
      };
      app(req, res);
    });
  };

  // 2. Submit verification documents
  console.log("[TEST SUBMIT] Submitting verification documents for user:", testUserId);
  const submitRes = await makeRequest("/api/auth/submit-verification-documents", {
    fullName: "Verification Tester",
    phone: "+966 50 123 4567",
    jobTitle: "CEO",
    hasCompany: true,
    companyName: "Test Org Enterprise",
    sector: "Technology",
    country: "Saudi Arabia",
    registrationNumber: "1234567890",
    personalDocuments: [{
      documentId: `doc_p_${Date.now()}`,
      fileName: "national_id.png",
      mimeType: "image/png",
      size: 102400,
      category: "personal"
    }],
    companyDocuments: [{
      documentId: `doc_c_${Date.now()}`,
      fileName: "cr_license.pdf",
      mimeType: "application/pdf",
      size: 204800,
      category: "company"
    }]
  });

  console.log(`[TEST SUBMIT RESULT] HTTP Status: ${submitRes.status}, Code: ${submitRes.body.code}`);

  if (submitRes.status !== 200 || !submitRes.body.success) {
    console.error("TEST SUBMIT FAILED:", submitRes.body);
    process.exit(1);
  }

  // 3. Verify user status returned
  if (
    submitRes.body.accountStatus !== "PENDING_ADMIN_REVIEW" ||
    submitRes.body.documentVerificationStatus !== "UNDER_REVIEW"
  ) {
    console.error("TEST SUBMIT FAILED: Incorrect account/document status returned!", submitRes.body);
    process.exit(1);
  }

  // 4. Test current-user-status endpoint GET request
  console.log("[TEST STATUS GET] Fetching current user status from server endpoint...");
  const statusRes = await new Promise<{ status: number; body: any }>((resolve) => {
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
      method: "GET",
      url: "/api/auth/current-user-status",
      originalUrl: "/api/auth/current-user-status",
      headers: {
        "content-type": "application/json",
        "authorization": "Bearer token_test_verification"
      },
      user: { uid: testUserId, email: testEmail },
      ip: "127.0.0.1",
      socket: { remoteAddress: "127.0.0.1" }
    };
    app(req, res);
  });

  console.log(`[TEST STATUS RESULT] Account Status: ${statusRes.body.user?.accountStatus}, Document Verification Status: ${statusRes.body.user?.documentVerificationStatus}`);

  if (
    statusRes.body.user?.accountStatus !== "PENDING_ADMIN_REVIEW" ||
    statusRes.body.user?.documentVerificationStatus !== "UNDER_REVIEW"
  ) {
    console.error("TEST STATUS GET FAILED: Current user status endpoint returned stale status!", statusRes.body);
    process.exit(1);
  }

  console.log("=== VERIFICATION SUBMISSION & TRANSITION TEST PASSED 100% ===");
}

runSubmissionTest().catch(err => {
  console.error("TEST ERROR:", err);
  process.exit(1);
});
